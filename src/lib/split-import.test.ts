import {describe,it,expect} from 'vitest';
import data from './rony-hml-data.json';
import {summarizeSplit,splitBalance,assertApprovedMapping} from './split-import';
describe('Rony: desdobramento e saldo',()=>{
 it('consome 23 unidades vendidas para 26 fabricadas e deixa 17',()=>{const b=splitBalance(data.origins,data.reports);expect(b).toMatchObject({total:53,initial:13,added:23,remaining:17});expect(data.reports.reduce((n,r)=>n+summarizeSplit(r,data.origins).manufacturingUnits,0)).toBe(26);});
 it('J7: quatro unidades fabricadas consomem um conjunto',()=>{const report={...data.reports[1],rows:data.reports[1].rows.filter(r=>r.contractCode==='J7')};expect(summarizeSplit(report,data.origins)).toMatchObject({sourceUnits:1,manufacturingUnits:4,problems:[]});});
 it('repeticao do PDF nao consome saldo novamente',()=>expect(splitBalance(data.origins,[...data.reports,data.reports[0]]).remaining).toBe(17));
 it('bloqueia origem ja consumida por outro relatorio',()=>expect(()=>splitBalance(data.origins,[data.reports[0],{...data.reports[0],digest:'different'}])).toThrow('já atendida'));
 it('nao altera dados de campo nem inventa datas',()=>{const original=JSON.stringify(data.origins);splitBalance(data.origins,data.reports);expect(JSON.stringify(data.origins)).toBe(original);expect(data.origins.find(p=>p.code==='J21')?.releaseDate).toBeNull();});
 it('rejeita vinculos adulterados e medidas diferentes',()=>{const r=structuredClone(data.reports[0]);r.rows[0].contractCode='P6';expect(()=>assertApprovedMapping(r,data.reports[0])).toThrow();r.rows[0]=structuredClone(data.reports[0].rows[0]);r.rows[0].width++;expect(()=>assertApprovedMapping(r,data.reports[0])).toThrow();});
 it('rejeita origem inexistente, duplicidade e quantidade invalida',()=>{const r=structuredClone(data.reports[0]);r.rows[0].contractCode='NAO EXISTE';r.rows[0].quantity=0;r.rows.push(r.rows[0]);expect(summarizeSplit(r,data.origins).problems.length).toBeGreaterThanOrEqual(3);});
});
