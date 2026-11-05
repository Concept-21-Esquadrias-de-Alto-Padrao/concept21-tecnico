import type { TechnicalContractOverview } from "./types";
import { releasePlan } from "./release-planning";
import { buildTechnicalWorkItems } from "./technical-work-items";
import { visitRequiresReport } from "./technical-rules";
import { readReceipt } from "./commercial-receipt";
export function workPortfolio(overview: TechnicalContractOverview, today: string) {
 const plan=releasePlan(overview.pieces,today);
 const sum=(items:typeof plan)=>items.reduce((s,p)=>s+p.units,0);
 const total=sum(plan), released=sum(plan.filter(p=>p.released)), emitted=sum(plan.filter(p=>p.emitted));
 const pending=plan.filter(p=>!p.released), missing=sum(pending.filter(p=>!p.piece.forecast_date)), revise=sum(pending.filter(p=>p.replan));
 const visits=overview.visits.filter(v=>v.status==='agendada'&&v.scheduled_date>=today).sort((a,b)=>a.scheduled_date.localeCompare(b.scheduled_date)||(a.scheduled_time??'24').localeCompare(b.scheduled_time??'24'));
 const prods=overview.prodBatches.filter(p=>!p.deleted_at&&p.status!=='cancelado');
 const items=buildTechnicalWorkItems(overview.actions,overview.corrections).filter(i=>!i.closed&&i.status!=='validada');
 const overdue=items.filter(i=>i.due_date&&i.due_date.slice(0,10)<today).length;
 const reports=overview.visits.filter(visitRequiresReport).length;
 const receipt=readReceipt(overview.technical?.commercial_data);
 const alerts:Array<{label:string;urgent:boolean}>=[];
 if(overdue)alerts.push({label:overdue+' atividade(s) vencida(s)',urgent:true});
 if(items.some(i=>i.blocking||i.critical))alerts.push({label:'Pendência bloqueante ou crítica',urgent:true});
 if(reports)alerts.push({label:reports+' relatório(s) pendente(s)',urgent:false});
 if(!total)alerts.push({label:'Peças não cadastradas',urgent:false});
 if(missing)alerts.push({label:missing+' peça(s) sem previsão',urgent:false});
 if(revise)alerts.push({label:revise+' previsão(ões) a revisar',urgent:false});
 if(total>released&&!visits.length)alerts.push({label:'Sem visita agendada',urgent:false});
 if(receipt&&receipt.status!=='completed')alerts.push({label:'Conferência do recebimento pendente',urgent:false});
 const corrections=items.filter(i=>i.kind==='correction').length;
 if(corrections)alerts.push({label:corrections+' correção(ões) aberta(s)',urgent:false});
 if(overview.technical?.risk_status==='atrasado')alerts.push({label:'Atraso sinalizado na obra',urgent:true});
 return {overview,total,released,emitted,balance:total-released,ready:released-emitted,percent:total?Math.round(released/total*100):0,prods,nextVisit:visits[0],alerts,receipt};
}
export type PortfolioRow=ReturnType<typeof workPortfolio>;
export type PortfolioSort='obra'|'liberacao'|'prod'|'visita'|'atencao';
export function sortPortfolio(rows:PortfolioRow[],sort:PortfolioSort,descending:boolean){
 return [...rows].sort((a,b)=>{
  if(sort==='visita'&&(!a.nextVisit||!b.nextVisit))return Number(!a.nextVisit)-Number(!b.nextVisit);
  const value=sort==='obra'?a.overview.contract.contract_number.localeCompare(b.overview.contract.contract_number,'pt-BR',{numeric:true}):sort==='liberacao'?a.percent-b.percent:sort==='prod'?a.ready-b.ready:sort==='atencao'?a.alerts.length-b.alerts.length:(a.nextVisit?.scheduled_date??'').localeCompare(b.nextVisit?.scheduled_date??'');
  return (descending?-value:value)||a.overview.contract.contract_number.localeCompare(b.overview.contract.contract_number,'pt-BR',{numeric:true});
 });
}
