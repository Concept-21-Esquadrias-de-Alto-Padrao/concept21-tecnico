"use server";
import {z} from "zod";
import {revalidatePath} from "next/cache";
import {requirePermissionAccess} from "@/lib/server-access";
import {alignmentDraftSchema,validateAlignment,type AlignmentState} from "@/lib/alignment-meeting";
import {toUserFriendlyErrorMessage} from "@/lib/errors";
export async function saveAlignmentAction(raw:unknown):Promise<{ok:boolean;message:string;state?:AlignmentState}> {
 try {
 const input=z.object({contractId:z.string().uuid(),version:z.number().int().min(0),intent:z.enum(["save","finish"]),draft:alignmentDraftSchema}).parse(raw);
 const context=await requirePermissionAccess("technical.meetings.manage");
 if(input.intent==="finish")validateAlignment(input.draft);
 const {data,error}=await context.admin.rpc("technical_save_alignment",{p_company:context.profile.company_id,p_contract:input.contractId,p_profile:context.profile.id,p_user:context.authUserId,p_version:input.version,p_finish:input.intent==="finish",p_draft:input.draft});
 if(error)throw error;
 for(const path of ["/tecnico","/tecnico/contratos","/tecnico/acoes","/tecnico/minhas-atividades",`/tecnico/contratos/${input.contractId}`,`/tecnico/contratos/${input.contractId}/reuniao`])revalidatePath(path);
 return {ok:true,message:input.intent==="finish"?"Reunião concluída. As atividades foram encaminhadas aos responsáveis.":"Rascunho guardado. Você pode sair e continuar depois.",state:data as AlignmentState};
 }catch(error){return {ok:false,message:toUserFriendlyErrorMessage(error,"Não foi possível guardar a reunião.")};}
}
