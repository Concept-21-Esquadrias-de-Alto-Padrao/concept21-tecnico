import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { readCemPdf } from "@/lib/cem-items";
import { getHttpStatus, HttpError, requirePermissionAccess } from "@/lib/server-access";

export const runtime="nodejs";
export async function POST(request:Request) {
  try {
    const {admin,profile,authUserId}=await requirePermissionAccess("technical.prods.manage");
    const form=await request.formData(), file=form.get("file");
    if (!(file instanceof File) || !file.size || file.size>4*1024*1024) throw new HttpError(400,"Envie um PDF de até 4 MB.");
    const buffer=Buffer.from(await file.arrayBuffer());
    if (buffer.subarray(0,5).toString()!=="%PDF-") throw new HttpError(400,"Arquivo PDF inválido.");
    const report=await readCemPdf(buffer);
    const {data:contract,error}=await admin.from("production_contracts").select("id,contract_number").eq("company_id",profile.company_id)
      .eq("id",String(form.get("contract_id"))).eq("active",true).maybeSingle();
    if(error) throw error;
    if(!contract || contract.contract_number!==report.contractNumber) throw new HttpError(400,"O número da obra no PDF é "+report.contractNumber+". Selecione o contrato correspondente.");
    const {data:pieces,error:pieceError}=await admin.from("technical_contract_pieces")
      .select("id,code,quantity,status,active_prod_batch_id,cem_registered,cem_checked,released_at").eq("company_id",profile.company_id)
      .eq("contract_id",contract.id).is("deleted_at",null).neq("status","cancelada");
    if(pieceError) throw pieceError;
    const number=String(form.get("batch_number")||report.batchNumber).trim();
    const {data:batches,error:batchError}=await admin.from("technical_prod_batches").select("id,batch_number,status,deleted_at")
      .eq("company_id",profile.company_id).eq("contract_id",contract.id);
    if(batchError) throw batchError;
    const existing=(batches??[]).find(b=>b.batch_number.trim().toUpperCase()===number.toUpperCase());
    const rows=report.rows.map(row=>{
      const candidates=(pieces??[]).filter(p=>p.code.trim().toUpperCase()===row.code.trim().toUpperCase());
      const p=candidates[0];
      const problem=candidates.length!==1?"Código ausente ou ambíguo na obra":
        p.quantity!==row.quantity?"Quantidade diferente do cadastro":
        existing && (existing.deleted_at || existing.status==="cancelado")?"Código de PROD cancelado":
        p.active_prod_batch_id && existing?.id!==p.active_prod_batch_id?"Já vinculada a outra PROD":
        existing && p.active_prod_batch_id!==existing.id?"PROD existente contém peças diferentes":
        !existing && (!p.released_at || p.status!=="liberada")?"Liberação de medidas pendente":"";
      return {...row,pieceId:p?.id,problem};
    });
    const digest=createHash("sha256").update(buffer).digest("hex");
    if(form.get("intent")!=="confirm") return NextResponse.json({...report,rows,digest});
    if(form.get("digest")!==digest || !number || number.length>100 || rows.some(r=>r.problem)) throw new HttpError(400,"Confira o número da PROD e resolva as divergências antes de confirmar.");
    if(report.batchNumber && number!==report.batchNumber) throw new HttpError(400,"O código da PROD deve corresponder ao relatório.");
    const {data:result,error:saveError}=await admin.rpc("technical_import_cem_items",{
      co:profile.company_id,cid:contract.id,actor:authUserId,num:number,report:{issued:report.issued,digest,rows}
    });
    if(saveError) throw new HttpError(409,saveError.message);
    for(const path of ["/tecnico","/tecnico/prods","/tecnico/contratos/"+contract.id]) revalidatePath(path);
    return NextResponse.json({message:result});
  } catch(error) {
    return NextResponse.json({error:error instanceof Error ? error.message:"Falha ao conferir o relatório."},{status:error instanceof HttpError ? getHttpStatus(error):400});
  }
}
