import { describe, it, expect } from "vitest";
import type { TechnicalContractOverview } from "./types";
import { workPortfolio, sortPortfolio } from "./works-portfolio";
const base={contract:{id:'c',contract_number:'25-0064'},technical:{technical_status:'em_acompanhamento'},pieces:[],visits:[],prodBatches:[],actions:[],corrections:[]} as unknown as TechnicalContractOverview;
describe('works portfolio',()=>{
 it('sums quantity rather than rows and excludes cancelled/deleted pieces',()=>{
 const r=workPortfolio({...base,pieces:[{status:'medida',quantity:34},{status:'liberada',quantity:15},{status:'cancelada',quantity:20},{status:'medida',quantity:10,deleted_at:'2026-01-01'}] as TechnicalContractOverview['pieces']},'2026-11-05');
 expect([r.total,r.released,r.balance]).toEqual([49,15,34]);expect(r.alerts.some(a=>a.label==='34 peça(s) sem previsão')).toBe(true);
 });
 it('recognizes PROD links and does not offer an old or cancelled appointment as next visit',()=>{
 const r=workPortfolio({...base,pieces:[{status:'medida',quantity:2,active_prod_batch_id:'prod'}] as TechnicalContractOverview['pieces'],visits:[{status:'agendada',scheduled_date:'2026-11-01'},{status:'cancelada',scheduled_date:'2026-11-07'},{status:'agendada',scheduled_date:'2026-11-09'}] as TechnicalContractOverview['visits']},'2026-11-05');
 expect([r.released,r.emitted,r.ready]).toEqual([2,2,0]);expect(r.nextVisit?.scheduled_date).toBe('2026-11-09');
 });
 it('keeps missing visit dates last in both directions',()=>{const empty=workPortfolio(base,'2026-11-05');const dated=workPortfolio({...base,visits:[{status:'agendada',scheduled_date:'2026-11-09'}] as TechnicalContractOverview['visits']},'2026-11-05');expect(sortPortfolio([empty,dated],'visita',false)[1]).toBe(empty);expect(sortPortfolio([empty,dated],'visita',true)[1]).toBe(empty);});
});
