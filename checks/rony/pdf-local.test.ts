import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {it,expect} from 'vitest';
import {readCemPdf} from '../../src/lib/cem-items';
import data from '../../src/lib/rony-hml-data.json';
import {assertApprovedMapping} from '../../src/lib/split-import';
for(const n of [1,4,5,6])it('leitor real PDF Rony PROD '+n,async()=>{
 const p='//192.168.15.6/Arquivos/Contratos em Produção/Rony Peterson Dalbon - 26-0555/Tecnico/Listas e Ordens de Produção/PROD '+n+'/'+(n===4?'01. ITENS DA OBRA ATUALIZADO.pdf':'01. ITENS DA OBRA.pdf');
 const bytes=readFileSync(p);const parsed=await readCemPdf(bytes);const expected=data.reports.find(r=>r.batchNumber===parsed.batchNumber)!;
 expect(expected).toBeDefined();const report={...parsed,digest:createHash('sha256').update(bytes).digest('hex'),rows:parsed.rows.map(r=>({...r,contractCode:expected.rows.find(e=>e.code===r.code)!.contractCode}))};
 expect(()=>assertApprovedMapping(report,expected)).not.toThrow();expect(parsed.rows.reduce((n,r)=>n+r.quantity,0)).toBe(expected.rows.reduce((n,r)=>n+r.quantity,0));
});
