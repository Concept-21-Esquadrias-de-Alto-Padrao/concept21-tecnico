"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermissionAccess } from "@/lib/server-access";
import { readReceipt, receiptDraftSchema, validateReceiptCompletion, type CommercialReceipt } from "@/lib/commercial-receipt";
import { toUserFriendlyErrorMessage } from "@/lib/errors";

const inputSchema = z.object({contractId:z.string().uuid(), version:z.number().int().min(0), intent:z.enum(["save","continue","finish"]), draft:receiptDraftSchema});
export async function saveCommercialReceiptAction(raw: unknown): Promise<{ok:boolean; message:string; receipt?:CommercialReceipt}> {
  let held: CommercialReceipt | undefined;
  try {
    const input = inputSchema.parse(raw);
    const reader = await requirePermissionAccess("technical.contracts.view");
    const companyId = reader.profile.company_id;
    const admin = reader.admin;
    const {data: technical, error} = await admin.from("technical_contracts").select("*").eq("company_id",companyId).eq("contract_id",input.contractId).is("deleted_at",null).maybeSingle();
    if (error) throw error;
    if (!technical) throw new Error("Obra não encontrada.");
    const current = readReceipt(technical.commercial_data);
    if (!current) throw new Error("Esta obra não possui recebimento iniciado neste fluxo.");
    await requirePermissionAccess(technical.commercial_data.origem_cadastro === "pdf" ? "technical.contracts.import_pdf" : "technical.contracts.manual_create");
    if (current.status === "completed") return {ok:true,message:"Conferência já concluída. Nenhuma duplicação foi realizada.",receipt:current};
    if (current.version !== input.version) throw new Error("A conferência foi atualizada em outra sessão. Reabra a página antes de continuar.");
    if (technical.technical_status !== "aguardando_reuniao" || technical.commercial_folder_received) throw new Error("A obra já avançou de etapa. Não é permitido sobrescrever o recebimento.");
    if (current.status === "applying" && input.intent !== "finish") throw new Error("A conclusão está em processamento. Use Tentar concluir novamente.");
    const draft = current.status === "applying" ? current.draft : input.draft;
    if (draft.data.contract_number !== current.draft.data.contract_number) throw new Error("O número do contrato não pode ser alterado durante a conferência.");
    const validation = input.intent === "finish" ? validateReceiptCompletion(draft) : null;
    const {data: existing, error: pieceError} = await admin.from("technical_contract_pieces").select("id, released_at, active_prod_batch_id, cem_registered, cem_checked, measured_width_mm, measured_height_mm").eq("company_id",companyId).eq("contract_id",input.contractId).is("deleted_at",null);
    if (pieceError) throw pieceError;
    if ((existing ?? []).some(p=>p.released_at || p.active_prod_batch_id || p.cem_registered || p.cem_checked || p.measured_width_mm || p.measured_height_mm)) throw new Error("Há peças com andamento técnico. O recebimento não pode sobrescrever essas informações.");
    if ((existing ?? []).some(p=>!draft.pieces.some(d=>d.id===p.id))) throw new Error("Uma peça já cadastrada não pode ser removida por esta conferência.");
    const ids = new Set(draft.pieces.map(p=>p.id));
    if (ids.size !== draft.pieces.length) throw new Error("Há identificadores repetidos de peças.");
    const now = new Date().toISOString();
    const next: CommercialReceipt = {...current, draft, version:current.version+1, updatedAt:now,
      status: input.intent === "finish" ? "applying" : "pending",
      history:[...current.history,{at:now,by:reader.profile.id,event:input.intent === "finish" ? "Conclusão iniciada" : "Progresso guardado",version:current.version+1}]};
    const {data: changed, error: saveError} = await admin.from("technical_contracts").update({commercial_data:{...technical.commercial_data,receipt:next}}).eq("company_id",companyId).eq("contract_id",input.contractId).eq("commercial_data->receipt->>version",String(current.version)).select("contract_id").maybeSingle();
    if (saveError) throw saveError;
    if (!changed) throw new Error("Outra sessão salvou primeiro. Reabra a conferência para preservar os dados.");
    held = next;
    if (validation) {
      const data = validation.data;
      if (data.contract_number !== current.draft.data.contract_number) throw new Error("O número do contrato não pode ser alterado durante a conferência.");
      const {data: base, error: baseError} = await admin.from("production_contracts").select("client_id").eq("company_id",companyId).eq("id",input.contractId).single();
      if (baseError) throw baseError;
      let clientId = base.client_id;
      const {data: client, error: clientError} = await admin.from("clients").select("name").eq("company_id",companyId).eq("id",clientId).single();
      if (clientError) throw clientError;
      if (client.name !== data.client_name) {
        const {data: matches, error: matchError} = await admin.from("clients").select("id").eq("company_id",companyId).eq("name",data.client_name).limit(1);
        if (matchError) throw matchError;
        if (matches?.length) clientId = matches[0].id;
        else { const created = await admin.from("clients").insert({company_id:companyId,name:data.client_name,active:true,created_by:reader.authUserId}).select("id").single(); if (created.error) throw created.error; clientId=created.data.id; }
      }
      // Stable IDs make a retry safe if a previous completion stopped between writes.
      for (const [index,piece] of draft.pieces.entries()) {
        const {data: owned, error: ownedError} = await admin.from("technical_contract_pieces").select("id,company_id,contract_id").eq("id",piece.id).maybeSingle();
        if (ownedError) throw ownedError;
        if (owned && (owned.company_id!==companyId || owned.contract_id!==input.contractId)) throw new Error("Peça vinculada a outra obra.");
        const values = {...piece,company_id:companyId,contract_id:input.contractId,sort_order:index+1};
        const result = owned
          ? await admin.from("technical_contract_pieces").update(values).eq("company_id",companyId).eq("contract_id",input.contractId).eq("id",piece.id)
          : await admin.from("technical_contract_pieces").insert({...values,status:"aguardando_avaliacao",source:technical.commercial_data.origem_cadastro,created_by:reader.authUserId});
        if (result.error) throw result.error;
      }
      const updatedContract = await admin.from("production_contracts").update({client_id:clientId,work_name:data.work_name,full_address:data.full_address,city:data.city,state:data.state,notes:data.description,general_delivery_forecast:validation.commercial.deliveryDate}).eq("company_id",companyId).eq("id",input.contractId);
      if (updatedContract.error) throw updatedContract.error;
      const completed: CommercialReceipt = {...next,status:"completed",completedAt:new Date().toISOString(),completedBy:reader.profile.id,version:next.version+1,history:[...next.history,{at:new Date().toISOString(),by:reader.profile.id,event:"Conferência concluída e encaminhada ao alinhamento comercial",version:next.version+1}]};
      const done = await admin.from("technical_contracts").update({contract_date:data.contract_date,contractual_deadline_value:data.contractual_deadline_value,contractual_deadline_unit:data.contractual_deadline_unit,authorized_contacts:validation.commercial.contacts,technical_notes:data.description,commercial_data:{...technical.commercial_data,delivery_date_unknown:validation.commercial.dateUnknown,receipt:completed}}).eq("company_id",companyId).eq("contract_id",input.contractId).eq("commercial_data->receipt->>version",String(next.version)).select("contract_id").maybeSingle();
      if (done.error) throw done.error;
      if (!done.data) throw new Error("A conclusão foi atualizada em outra sessão. Reabra a obra para conferir.");
      held=completed;
    }
    for (const path of ["/tecnico","/tecnico/contratos","/tecnico/minhas-atividades",`/tecnico/contratos/${input.contractId}`,`/tecnico/contratos/${input.contractId}/recebimento`]) revalidatePath(path);
    return {ok:true,message:held.status === "completed" ? "Conferência concluída. Obra disponível para o alinhamento comercial." : "Progresso guardado. Você pode sair e retomar pelo Meu trabalho ou por Obras.",receipt:held};
  } catch (error) { return {ok:false,message:toUserFriendlyErrorMessage(error,"Não foi possível guardar a conferência."),...(held ? {receipt:held} : {})}; }
}
