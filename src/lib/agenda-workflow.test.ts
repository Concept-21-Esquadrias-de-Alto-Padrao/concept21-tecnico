import {describe,it,expect} from 'vitest';
import {agendaVisitLane,agendaWorkBalance} from './agenda-workflow';
import type {TechnicalContractOverview,TechnicalVisit} from './types';
const visit=(status:string,extra={})=>({status,performed_at:null,report_generated_at:null,...extra}) as TechnicalVisit;
describe('Agenda operational queues',()=>{
 it('keeps performed visits without reports in return queue and cancelled visits in history',()=>{
 expect(agendaVisitLane(visit('aguardando_relatorio',{performed_at:'2026-11-05'}))).toBe('return');
 expect(agendaVisitLane(visit('realizada'))).toBe('return');
 expect(agendaVisitLane(visit('agendada'))).toBe('scheduled');
 expect(agendaVisitLane(visit('relatorio_emitido',{report_generated_at:'2026-11-05'}))).toBe('history');
 expect(agendaVisitLane(visit('cancelada'))).toBe('history');
 });
 it('counts units, excludes released/cancelled pieces and does not treat forecast as appointment',()=>{
 const w={technical:{technical_status:'em_acompanhamento'},pieces:[{id:'p',quantity:3,status:'liberada'},{id:'q',quantity:2,status:'pendente',forecast_date:'2026-11-10'},{id:'r',quantity:8,status:'cancelada'}],visits:[]} as unknown as TechnicalContractOverview;
 const result=agendaWorkBalance(w,'2026-11-05');expect(result.total).toBe(5);expect(result.balance).toBe(2);expect(result.needsScheduling).toBe(true);
 w.visits=[visit('agendada',{scheduled_date:'2026-11-06'})];expect(agendaWorkBalance(w,'2026-11-05').needsScheduling).toBe(false);
 w.visits=[visit('agendada',{scheduled_date:'2026-11-04'})];expect(agendaWorkBalance(w,'2026-11-05').needsScheduling).toBe(true);expect(agendaWorkBalance(w,'2026-11-05').outstanding).toHaveLength(1);
 });
});