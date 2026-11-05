import type { TechnicalContractOverview, TechnicalVisit } from './types';
import { releasePlan } from './release-planning';
export function agendaVisitLane(v: Pick<TechnicalVisit,'status'|'performed_at'|'report_generated_at'>) {
 if(v.status==='cancelada') return 'history';
 if(v.status==='agendada'&&!v.performed_at) return 'scheduled';
 if(!v.report_generated_at && ['realizada','aguardando_relatorio','agendada'].includes(v.status)) return 'return';
 return 'history';
}
export function agendaWorkBalance(work:TechnicalContractOverview,today:string) {
 const plan=releasePlan(work.pieces,today), pending=plan.filter(p=>!p.released);
 const sum=(items:typeof plan)=>items.reduce((n,p)=>n+p.units,0);
 const scheduled=work.visits.filter(v=>agendaVisitLane(v)==='scheduled'&&v.scheduled_date>=today);
 const outstanding=work.visits.filter(v=>agendaVisitLane(v)==='return'||(agendaVisitLane(v)==='scheduled'&&v.scheduled_date<today));
 return {work,plan,pending,total:sum(plan),released:sum(plan.filter(p=>p.released)),balance:sum(pending),
 missing:sum(pending.filter(p=>!p.piece.forecast_date)),revise:sum(pending.filter(p=>p.replan)),scheduled,outstanding,
 dates:[...new Set(pending.filter(p=>p.piece.forecast_date&&!p.replan).map(p=>p.piece.forecast_date!))].sort(),
 needsScheduling:pending.length>0&&!scheduled.length&&!['concluido','cancelado'].includes(work.technical?.technical_status??'')};
}
