import {releaseFolderDeadlines} from './release-folder';
import type {TechnicalSnapshot} from './types';
export const folderStages = {send:'Encaminhar pasta',receive:'Confirmar recebimento',issue:'Emitir PROD',done:'Emissão concluída'};
export function buildFolderWorkflow(s:TechnicalSnapshot){
 const latest=new Map<string,string>();
 const releases=[...s.releases].filter(r=>r.status!=='cancelado').sort((a,b)=>b.release_date.localeCompare(a.release_date)||b.created_at.localeCompare(a.created_at));
 for(const r of releases) for(const l of s.releasePieces.filter(l=>l.release_id===r.id)) if(!latest.has(l.piece_id)) latest.set(l.piece_id,r.id);
 return releases.flatMap(r=>{
  const c=s.contracts.find(c=>c.id===r.contract_id&&c.company_id===r.company_id&&c.active!==false);
  const t=s.technicalContracts.find(t=>t.contract_id===r.contract_id);
  if(!c||t?.deleted_at||['concluido','cancelado'].includes(t?.technical_status??'')) return [];
  const pieces=s.pieces.filter(p=>p.contract_id===c.id&&!p.deleted_at&&p.status!=='cancelada'&&latest.get(p.id)===r.id);
  if(!pieces.length)return [];
  const pending=pieces.filter(p=>p.status==='liberada'&&!p.active_prod_batch_id);
  const d=releaseFolderDeadlines(r,(s.dashboardHolidays??[]).filter(h=>h.company_id===r.company_id).map(h=>({date:h.holiday_date})));
  const stage:keyof typeof folderStages=!pending.length?'done':d.status==='pending'?'send':d.status==='sent'?'receive':'issue';
  const ownerId=stage==='send'?r.released_by_profile_id:r.folder_handoff?.recipient;
  const owner=s.profiles.find(p=>p.id===ownerId)?.name??(stage==='send'?'Obras · responsável não informado':'Responsável não informado');
  const prods=s.prodBatches.filter(p=>!p.deleted_at&&p.status!=='cancelado'&&pieces.some(x=>x.active_prod_batch_id===p.id));
  return [{release:r,contract:c,client:s.clients.find(x=>x.id===c.client_id)?.name??c.work_name,pieces,pending,stage,ownerId,owner,due:stage==='send'?d.sendDue:stage==='issue'?d.issueDue:null,issueDue:d.issueDue,sendDue:d.sendDue,prods,href:'/tecnico/contratos/'+c.id+'#prods'}];
 });
}
export type FolderWorkflowRow=ReturnType<typeof buildFolderWorkflow>[number];
