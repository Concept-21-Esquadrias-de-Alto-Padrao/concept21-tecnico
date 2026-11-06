import {FolderWorkflowBoard} from "@/components/folder-workflow-board";
import {buildFolderWorkflow} from "@/lib/folder-workflow";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  approveProdBatchAction,
  checkProdBatchAction,
  confirmDepartmentDeliveryAction,
  deliverDepartmentDocumentAction,
} from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { ProdCreationForm } from "@/components/prod-creation-form";
import { CemImportForm } from "@/components/cem-import-form";
import { PageHeader } from "@/components/page-header";

import { StatusBadge } from "@/components/status-badge";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalOperationalData } from "@/lib/technical-data";


import {ProdWorkspace} from '@/components/prod-workspace';
import {departmentDocuments,deliveryLabel,latestDepartmentDelivery} from '@/lib/prod-handoffs';
import {formatDate} from '@/lib/utils';
import {createSupabaseServerClient} from '@/lib/supabase/server';
const stamp=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
import tones from '../contratos/works-tones.module.css';

export default async function TechnicalProdsPage(){
 const access=await getCurrentPermissionFlags([...appNavigationPermissionKeys,...TECHNICAL_PERMISSIONS]);
 if(!canAccessModule(access,MODULE_ACCESS.prods))redirect(firstAllowedAppRoute(access)??'/login');
 const snapshot=await getTechnicalOperationalData();
 const canManage=access.isMaster||access.permissions['technical.prods.manage'];
 const canCheck=access.isMaster||access.permissions['technical.prods.check'];
 const canApprove=access.isMaster||access.permissions['technical.prods.approve'];
 const workflow=buildFolderWorkflow(snapshot);
 const db=await createSupabaseServerClient();
 const {data:confirmationRows}=snapshot.deliveries.length?await db.from('technical_department_confirmations').select('delivery_id,confirmed_by_profile_id,confirmed_at,status').in('delivery_id',snapshot.deliveries.map(d=>d.id)).order('confirmed_at',{ascending:false}):{data:[]};

 const rows=snapshot.prodBatches.filter(p=>!p.deleted_at&&p.status!=='cancelado').map(prod=>{
 const contract=snapshot.contracts.find(c=>c.id===prod.contract_id);
 const client=snapshot.clients.find(c=>c.id===contract?.client_id)?.name??contract?.work_name??'Cliente não vinculado';
 const links=snapshot.prodBatchPieces.filter(p=>p.prod_batch_id===prod.id);
 const pieces=snapshot.pieces.filter(p=>links.some(l=>l.piece_id===p.id));
 const deliveries=snapshot.deliveries.filter(d=>d.prod_batch_id===prod.id);
 const lots=workflow.filter(r=>r.contract.id===prod.contract_id&&r.pieces.some(p=>links.some(l=>l.piece_id===p.id)));
 const label=(id:string|null)=>snapshot.profiles.find(p=>p.id===id)?.name??'Não informado';
 const href='/tecnico/contratos/'+prod.contract_id;
 return {id:prod.id,title:prod.batch_number,contract:(contract?.contract_number??'Contrato')+' · '+client,search:[prod.batch_number,contract?.contract_number,client,...pieces.flatMap(p=>[p.code,p.environment,p.piece_type])].join(' '),status:prod.status,units:pieces.reduce((n,p)=>n+p.quantity,0),supplies:deliveryLabel(latestDepartmentDelivery(deliveries,'suprimentos')),production:deliveryLabel(latestDepartmentDelivery(deliveries,'producao')),content:<div className="space-y-6">
 <div className="flex flex-wrap items-center justify-between gap-3"><Link className="font-semibold text-accent underline" href={href+'#prods'}>{contract?.contract_number} · {client} → Abrir contrato</Link><StatusBadge status={prod.status} type="prod"/></div>
 <div className="grid gap-3 md:grid-cols-3"><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase text-muted-foreground">Itens da Obra</p><p className="mt-2 font-semibold">{prod.cem_report?'Importado · '+prod.cem_report.issued:'Sem relatório importado'}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase text-muted-foreground">Conferência técnica</p><p className="mt-2 font-semibold">{prod.checked_at?stamp(prod.checked_at)+' · '+label(prod.checked_by_profile_id):'Ainda não registrada'}</p></div><div className="rounded-lg bg-slate-50 p-4"><p className="text-xs uppercase text-muted-foreground">Aprovação técnica</p><p className="mt-2 font-semibold">{prod.approved_at?stamp(prod.approved_at)+' · '+label(prod.approved_by_profile_id):'Ainda não registrada'}</p></div></div>
 <div><h3 className="mb-3 font-semibold">Origem e prazo de emissão</h3>{lots.length?<div className="grid gap-3 md:grid-cols-2">{lots.map(l=><div key={l.release.id} className="rounded-lg border border-border p-4"><Link href={href+'#pecas'} className="font-semibold text-accent">{l.release.batch_number??'Lote de liberação'}</Link><p className="mt-2 text-sm">Liberado: {formatDate(l.release.release_date)} · Pasta recebida: {l.release.folder_handoff?.received_date?formatDate(l.release.folder_handoff.received_date):'Não registrado'}</p><p className="mt-1 text-sm">Emitir até: <strong>{l.issueDue?formatDate(l.issueDue):'Aguardando recebimento'}</strong> · {l.owner}</p></div>)}</div>:<p className="text-sm text-muted-foreground">Lote de origem não localizado. Confira o vínculo no contrato; nenhuma data foi presumida.</p>}</div>
 <div><h3 className="mb-3 font-semibold">Peças vinculadas · {pieces.length} itens / {pieces.reduce((n,p)=>n+p.quantity,0)} unidades</h3><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50"><tr>{['Peça / ambiente','Modelo','Quantidade','Campo L × A (mm)','Fabricação no relatório (mm)'].map(h=><th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{pieces.map(p=>{const item=prod.cem_report?.rows.find(r=>r.code===p.code);return <tr key={p.id} className="border-b border-border"><td className="p-3"><strong>{p.code}</strong><span className="block text-muted-foreground">{p.environment??'Sem ambiente'}</span></td><td className="p-3">{p.piece_type??p.description??'Não informado'}</td><td className="p-3">{p.quantity}</td><td className="p-3">{p.measured_width_mm&&p.measured_height_mm?p.measured_width_mm+' × '+p.measured_height_mm:'Não informada'}</td><td className="p-3">{item?item.width+' × '+item.height:'Não importada'}</td></tr>})}</tbody></table></div></div>
 {(canCheck&&prod.status==='aguardando_conferencia'||canApprove&&prod.status==='aguardando_aprovacao')&&<section className="rounded-xl border border-border bg-slate-50 p-4"><h3 className="font-semibold">Conferir antes de avançar</h3><p className="my-3 text-sm">Verifique vidro, cor, acessórios, ambiente, medidas de fabricação e necessidade de projeto. Mudança de tipologia ou medida que exija aditivo deve retornar ao Comercial. A importação não substitui esta conferência.</p>{canCheck&&prod.status==='aguardando_conferencia'&&<ActionForm action={checkProdBatchAction} submitLabel="Registrar conferência técnica"><input type="hidden" name="id" value={prod.id}/></ActionForm>}{canApprove&&prod.status==='aguardando_aprovacao'&&<ActionForm action={approveProdBatchAction} submitLabel="Aprovar PROD"><input type="hidden" name="id" value={prod.id}/></ActionForm>}</section>}
 <section><h3 className="font-semibold">Repasses de documentos</h3><p className="mb-4 mt-1 text-sm text-muted-foreground">Os arquivos permanecem no servidor. Registre o conteúdo de cada envio e acompanhe o recebimento por setor.</p><div className="grid gap-4 lg:grid-cols-2">{(['suprimentos','producao'] as const).map(department=>{
 const latest=latestDepartmentDelivery(deliveries,department);
 const confirmation=confirmationRows?.find(c=>c.delivery_id===latest?.id); 
 const canConfirm=access.isMaster||access.permissions[department==='suprimentos'?'technical.deliveries.suprimentos_confirm':'technical.deliveries.producao_confirm'];
 return <article key={department} className="rounded-xl border border-border p-4"><div className="mb-3 flex justify-between gap-2"><h4 className="font-semibold">{department==='suprimentos'?'Suprimentos · listas':'Produção · ordens'}</h4><span className="text-sm">{deliveryLabel(latest)}</span></div>
 {latest&&<div className="mb-4 text-sm"><p>Envio: {latest.delivered_at?stamp(latest.delivered_at):'Não informado'}</p>{latest.status==='entregue'&&<p>Receber até: {latest.confirmation_due_at?stamp(latest.confirmation_due_at):'Não informado'}</p>}<p className="mt-2 whitespace-pre-wrap text-muted-foreground">{latest.notes??'Conteúdo não detalhado neste envio.'}</p><small className="block mt-2">Envio identificado em {latest.delivered_at?new Date(latest.delivered_at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):'data não informada'}</small></div>}
 {latest?.status==='confirmado'&&<p className="mb-3 text-sm">{confirmation?'Recebido por '+label(confirmation.confirmed_by_profile_id)+' · '+stamp(confirmation.confirmed_at):'Recebimento registrado; identificação não disponível para esta consulta.'}</p>}
 {canConfirm&&latest?.status==='entregue'&&<ActionForm action={confirmDepartmentDeliveryAction} submitLabel="Confirmar recebimento dos documentos"><input type="hidden" name="id" value={latest.id}/><input type="hidden" name="department" value={department}/></ActionForm>}
 {canManage&&prod.status==='aprovado'&&latest?.status!=='entregue'&&<details className="mt-3"><summary className="cursor-pointer font-semibold text-accent">{latest?'Registrar novo envio / revisão':'Preparar envio'}</summary><ActionForm action={deliverDepartmentDocumentAction} submitLabel="Registrar envio dos documentos" className="mt-4"><input type="hidden" name="prod_batch_id" value={prod.id}/><input type="hidden" name="department" value={department}/><input type="hidden" name="delivery_type" value={department==='suprimentos'?'lista_materiais':'ordem_producao'}/><input type="hidden" name="manifest_required" value="true"/><fieldset className="space-y-2"><legend className="mb-2 text-sm font-semibold">Quais documentos estão neste envio?</legend>{departmentDocuments[department].map(doc=><label className="flex gap-2 text-sm" key={doc}><input type="checkbox" name="documents" value={doc}/>{doc}</label>)}</fieldset><label className="block text-sm">Referência no servidor, revisão ou observação<textarea name="notes" className="mt-2 min-h-20 w-full rounded-lg border border-border p-3"/></label><p className="text-xs text-muted-foreground">Selecione somente os documentos efetivamente entregues. Não registra compra nem entrega física de peças.</p></ActionForm></details>}
 {prod.status!=='aprovado'&&<p className="text-sm text-muted-foreground">Repasse disponível após aprovação da PROD.</p>}
 {deliveries.filter(d=>d.department===department&&d.id!==latest?.id).length>0&&<details className="mt-4 border-t border-border pt-3"><summary className="cursor-pointer text-sm">Envios anteriores</summary>{deliveries.filter(d=>d.department===department&&d.id!==latest?.id).map(d=><div key={d.id} className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">{d.delivered_at?stamp(d.delivered_at):'Sem data'} · {deliveryLabel(d)}<p className="whitespace-pre-wrap">{d.notes}</p></div>)}</details>}
 </article>})}</div></section>
 <div className="rounded-lg bg-slate-50 p-4 text-sm"><strong>Continuidade em Obras</strong><p className="mt-1">Contrato, lote e peças permanecem vinculados. O aceite destes documentos não confirma chegada, instalação ou disponibilidade física das peças.</p><Link href={href+'#pecas'} className="mt-2 inline-block font-semibold text-accent underline">Consultar liberações e saldo do contrato</Link></div>
 </div>};});
 return <div className={tones.works+' space-y-6'}><PageHeader title="PRODs e repasses" description="Da pasta recebida aos documentos entregues. Peças, prazos e responsáveis no mesmo lugar."/><ProdWorkspace rows={rows} folders={<FolderWorkflowBoard rows={workflow}/>} registration={canManage?<div>              <h3 className="mb-3 font-semibold">Importar Itens da Obra</h3>
              <CemImportForm contracts={snapshot.contracts.map(c=>({id:c.id,label:c.contract_number+" · "+(snapshot.clients.find(client=>client.id===c.client_id)?.name || c.work_name)}))}/>
              <details className="mt-5 border-t pt-3"><summary className="mb-3 cursor-pointer font-semibold">Montar PROD manualmente</summary>
              <ProdCreationForm
                contracts={snapshot.contracts.map((contract) => ({
                  id: contract.id,
                  number: contract.contract_number,
                  client: snapshot.clients.find((client) => client.id === contract.client_id)?.name ?? "Cliente não vinculado",
                  work: contract.work_name,
                }))}
                pieces={snapshot.pieces
                  .filter((piece) => piece.status === "liberada" && piece.cem_registered && piece.cem_checked && !piece.active_prod_batch_id && !piece.deleted_at)
                  .map((piece) => ({ id: piece.id, contractId: piece.contract_id, code: piece.code, environment: piece.environment ?? "Sem ambiente", model: piece.piece_type ?? piece.description ?? "Modelo não informado" }))}
              />
              </details>
</div>:null}/></div>;
}
