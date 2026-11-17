import {fabricationEnvironment} from '@/lib/fabrication-environment';
import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {requirePermissionAccess,HttpError,getHttpStatus} from '@/lib/server-access';
import {readCemPdf} from '@/lib/cem-items';
import {validateSetDraft,validateFabricationReport} from '@/lib/fabrication-set-validation';
export const runtime='nodejs';
async function context(){
 if(!fabricationEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.VERCEL_ENV,process.env.FABRICATION_SETS_ENABLED))throw new HttpError(403,'Conjuntos de fabricação ainda não estão habilitados neste ambiente.');
 const ctx=await requirePermissionAccess('technical.prods.manage');
 const {data,error}=await ctx.admin.from('production_contracts').select('id,contract_number').eq('company_id',ctx.profile.company_id).eq('contract_number',process.env.VERCEL_ENV==='production'?'26-0651':'HML-MADEIRA-1611').eq('active',true).single();
 if(error||!data)throw new HttpError(404,'Contrato Rafael 26-0651 não localizado.');
 return {...ctx,contract:data};
}
function failure(e:unknown){return NextResponse.json({error:e instanceof Error?e.message:'Falha na operação.'},{status:e instanceof HttpError?getHttpStatus(e):400});}
export async function GET(){try{
 const {admin,profile,contract}=await context();
 const {data:set,error}=await admin.from('technical_fabrication_sets').select('*').eq('company_id',profile.company_id).eq('contract_id',contract.id).maybeSingle();if(error)throw error;
 const {data:imports,error:ie}=set?await admin.from('technical_fabrication_imports').select('id,prod_batch_id,report,created_at').eq('set_id',set.id):{data:[],error:null};if(ie)throw ie;
 const {data:services,error:se}=await admin.from('technical_piece_external_services').select('*').eq('company_id',profile.company_id).eq('contract_id',contract.id).order('name');if(se)throw se;
 const {data:confirmation,error:ce}=set?await admin.from('audit_logs').select('after_data,created_at').eq('company_id',profile.company_id).eq('entity','technical_fabrication_sets').eq('entity_id',set.id).eq('action','fabrication_scope_confirmed').order('created_at',{ascending:false}).limit(1).maybeSingle():{data:null,error:null};if(ce)throw ce;
 return NextResponse.json({set,imports,services,confirmation,contractId:contract.id});
 }catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const {admin,profile,authUserId,contract}=await context();
 if(request.headers.get('content-type')?.includes('application/json')){
  const body=await request.json();
  if(body.intent==='confirm-scope'){
   const {data:set,error}=await admin.from('technical_fabrication_sets').select('id,version,draft').eq('company_id',profile.company_id).eq('contract_id',contract.id).single();
   if(error||!set||set.version!==body.version)throw new HttpError(409,'Conjunto alterado. Recarregue.');
   validateSetDraft(set.draft);if(set.draft.coverage!=='total')throw new HttpError(400,'Confira a cobertura integral antes de confirmar.');
   const {error:ae}=await admin.from('audit_logs').insert({company_id:profile.company_id,entity:'technical_fabrication_sets',entity_id:set.id,action:'fabrication_scope_confirmed',user_id:authUserId,after_data:{coverage:'total',finishConfirmed:true,setVersion:set.version,originLinks:set.draft.links},notes:'Responsável confirmou cobertura integral e acabamento Imbuia cód. 05 — Metaperfil.'});if(ae)throw ae;
   return NextResponse.json({confirmed:true});
  }
  if(body.intent==='prepare-workflow'){
   const {data:set,error:se}=await admin.from('technical_fabrication_sets').select('id').eq('company_id',profile.company_id).eq('contract_id',contract.id).single();if(se||!set)throw new HttpError(400,'Conjunto não localizado.');
   const {data,error}=await admin.rpc('technical_prepare_fabrication_prod',{co:profile.company_id,cid:contract.id,sid:set.id,actor:authUserId});if(error)throw new HttpError(409,error.message);
   return NextResponse.json({prodId:data});
  }
  if(body.intent==='external-service'){
   if(typeof body.id!=='string'||!Number.isInteger(body.version)||body.version<1)throw new HttpError(400,'Serviço inválido.');
   const c=body.changes;if(!c||['status','owner_name','supplier','due_date','notes'].some(k=>typeof c[k]!=='string'||c[k].length>2000))throw new HttpError(400,'Campos do serviço inválidos.');
   const {data,error}=await admin.rpc('technical_save_external_service',{co:profile.company_id,cid:contract.id,sid:body.id,actor:authUserId,expected_version:body.version,changes:c});if(error)throw new HttpError(409,error.message);
   return NextResponse.json({service:data});
  }
  const draft=validateSetDraft(body.draft);
  if(!Number.isInteger(body.version)||body.version<0)throw new HttpError(400,'Versão inválida.');
  const {data,error}=await admin.rpc('technical_save_fabrication_set',{co:profile.company_id,cid:contract.id,actor:authUserId,p_draft:draft,p_version:body.version});if(error)throw new HttpError(409,error.message);
  return NextResponse.json({set:data});
 }
 const form=await request.formData(),file=form.get('file');
 if(!(file instanceof File)||!file.size||file.size>4*1024*1024)throw new HttpError(400,'Selecione o PDF de até 4 MB.');
 const bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-')throw new HttpError(400,'Arquivo inválido.');
 const report=await readCemPdf(bytes);
 const {data:set,error}=await admin.from('technical_fabrication_sets').select('*').eq('company_id',profile.company_id).eq('contract_id',contract.id).single();if(error||!set)throw new HttpError(400,'Salve o conjunto antes de importar.');
 validateFabricationReport(report,validateSetDraft(set.draft));
 const digest=createHash('sha256').update(bytes).digest('hex');
 if(form.get('intent')!=='confirm')return NextResponse.json({report,digest,version:set.version});
 if(form.get('digest')!==digest||Number(form.get('version'))!==set.version)throw new HttpError(409,'Arquivo ou conjunto alterado. Refaça a leitura.');
 const {data:result,error:ie}=await admin.rpc('technical_import_fabrication_set',{co:profile.company_id,cid:contract.id,actor:authUserId,sid:set.id,p_version:set.version,num:report.batchNumber,report:{...report,digest}});
 if(ie)throw new HttpError(409,ie.message);
 return NextResponse.json({result});
 }catch(e){return failure(e);}}
