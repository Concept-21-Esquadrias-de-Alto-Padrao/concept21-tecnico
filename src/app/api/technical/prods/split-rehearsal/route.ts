import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';
import {revalidatePath} from 'next/cache';
import {requirePermissionAccess,HttpError,getHttpStatus} from '@/lib/server-access';
import {fabricationEnvironment} from '@/lib/fabrication-environment';
import {readCemPdf} from '@/lib/cem-items';
import data from '@/lib/rony-hml-data.json';
import {assertApprovedMapping,splitBalance,type SplitReport,type SourcePiece} from '@/lib/split-import';
export const runtime='nodejs';
async function access(){
 if(fabricationEnvironment(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.VERCEL_ENV,undefined)!=='test')throw new HttpError(403,'Disponível somente na homologação.');
 const ctx=await requirePermissionAccess('technical.prods.manage');
 const {data:contract,error}=await ctx.admin.from('production_contracts').select('id,contract_number').eq('company_id',ctx.profile.company_id).eq('contract_number','HML-RONY-1711').eq('active',true).single();
 if(error||!contract)throw new HttpError(404,'Cópia de homologação do Rony não localizada.');return {...ctx,contract};
}
async function load(ctx:Awaited<ReturnType<typeof access>>){
 const {data:pieces,error}=await ctx.admin.from('technical_contract_pieces').select('id,code,quantity,environment,measured_width_mm,measured_height_mm,released_at,active_prod_batch_id').eq('company_id',ctx.profile.company_id).eq('contract_id',ctx.contract.id).is('deleted_at',null).neq('status','cancelada');if(error)throw error;
 const {data:batches,error:be}=await ctx.admin.from('technical_prod_batches').select('id,batch_number,status,cem_report').eq('company_id',ctx.profile.company_id).eq('contract_id',ctx.contract.id).is('deleted_at',null).neq('status','cancelado');if(be)throw be;
 const names=new Set(data.reports.map(r=>r.batchNumber));const added=(batches??[]).filter(b=>names.has(b.batch_number));
 const addedIds=new Set(added.map(b=>b.id));
 const origins:SourcePiece[]=(pieces??[]).map(p=>({code:p.code,quantity:p.quantity,environment:p.environment,width:p.measured_width_mm,height:p.measured_height_mm,releaseDate:p.released_at?.slice(0,10)??null,alreadyIssued:!!p.active_prod_batch_id&&!addedIds.has(p.active_prod_batch_id)}));
 const reports=added.map(b=>b.cem_report as SplitReport);const balance=splitBalance(origins,reports);
 const actualRemaining=(pieces??[]).filter(p=>!p.active_prod_batch_id).reduce((n,p)=>n+p.quantity,0);
 if(actualRemaining!==balance.remaining)throw new Error('Saldo físico dos vínculos diverge do relatório.');
 return {contractId:ctx.contract.id,origins,reports,balance,prods:added.map(b=>({id:b.id,number:b.batch_number,status:b.status}))};
}
function failure(e:unknown){return NextResponse.json({error:e instanceof Error?e.message:'Falha na importação.'},{status:e instanceof HttpError?getHttpStatus(e):400});}
export async function GET(){try{return NextResponse.json(await load(await access()));}catch(e){return failure(e);}}
export async function POST(request:Request){try{
 const ctx=await access(),form=await request.formData(),intent=String(form.get('intent'));
 const approved=data.reports.find(r=>r.batchNumber===form.get('batch'));if(!approved)throw new Error('Selecione uma das quatro PRODs aprovadas.');
 let report:SplitReport=structuredClone(approved);const file=form.get('file');
 if(file instanceof File&&file.size){
  if(file.size>4*1024*1024)throw new Error('Limite de 4 MB por PDF.');
  const buffer=Buffer.from(await file.arrayBuffer());if(buffer.subarray(0,5).toString()!=='%PDF-')throw new Error('Envie um PDF.');
  const parsed=await readCemPdf(buffer);if(parsed.contractNumber!=='26-0555')throw new Error('PDF de outro contrato.');
  report={...parsed,digest:createHash('sha256').update(buffer).digest('hex'),rows:parsed.rows.map(r=>({...r,contractCode:approved.rows.find(a=>a.code===r.code)?.contractCode??''}))};
 }
 if(form.has('mapping')){const mapping=JSON.parse(String(form.get('mapping'))) as Record<string,string>;report.rows=report.rows.map(r=>({...r,contractCode:mapping[r.code]??''}));}
 assertApprovedMapping(report,approved);
 // Normalize both file upload and saved report to the same immutable, approved payload.
 const payload={...approved,rows:approved.rows.map(r=>({...r})),coverage:'total',contractNumber:ctx.contract.contract_number,sourceContractNumber:'26-0555',historical_regularization:true,historical_confirmation:'HOMOLOGAÇÃO: vínculos e cobertura integral confirmados por Eduardo. Datas conhecidas preservadas; demais liberações históricas sem data. Não representa conclusão física da fabricação.'} satisfies SplitReport & {coverage:string;contractNumber:string;sourceContractNumber:string;historical_regularization:boolean;historical_confirmation:string};
 report=payload; const existing=await load(ctx);const balance=splitBalance(existing.origins,[...existing.reports,report]);
 if(intent==='preview')return NextResponse.json({report,balance});
 if(intent!=='confirm'||form.get('coverage')!=='total')throw new Error('Confirme a cobertura integral antes de importar.');
 const {data:result,error}=await ctx.admin.rpc('technical_import_split_prod',{co:ctx.profile.company_id,cid:ctx.contract.id,actor:ctx.authUserId,num:report.batchNumber,report});
 if(error)throw new HttpError(409,error.message);
 for(const path of ['/tecnico','/tecnico/prods','/tecnico/contratos/'+ctx.contract.id])revalidatePath(path);
 return NextResponse.json({...await load(ctx),message:result?.duplicate?'Esta PROD já foi importada. Vínculos e saldo preservados.':'PROD gravada na base de homologação e encaminhada para conferência.',result});
 }catch(e){return failure(e);}}
