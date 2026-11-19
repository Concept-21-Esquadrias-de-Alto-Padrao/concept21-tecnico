import {describe,it,expect} from 'vitest';
import {isolatedTechnicalTest} from './isolated-technical-test';
import {correctionChanges,type CorrectionValues} from './work-data-correction';
const base:CorrectionValues={client_name:'Cliente Original',work_name:'Residencial - Casa Árvore',full_address:'Rua A',city:'Goiânia',state:'GO',zip_code:null,site_contact:null,site_contact_phone:null,notes:'Original'};
const data=()=>{const d=new FormData();Object.entries(base).forEach(([k,v])=>d.set(k,v??''));return d;};
describe('Correção seletiva do cadastro',()=>{
 it('remove apenas prefixo inicial sem alterar outros campos',()=>{const d=data();d.set('work_name','Casa Árvore');expect(correctionChanges(base,d)).toEqual([{key:'work_name',label:'Obra',before:'Residencial - Casa Árvore',after:'Casa Árvore'}]);});
 it('ignora motivo, identificador e campos estranhos no resumo',()=>{const d=data();d.set('adjustment_reason','ajuste');d.set('classification','mudou');expect(correctionChanges(base,d)).toEqual([]);});
 it('registra remoção de valor opcional',()=>{const d=data();d.set('notes','');expect(correctionChanges(base,d)[0].after).toBeNull();});
 it('não normaliza campos intocados',()=>{const b={...base,client_name:' Cliente Original '};const d=data();d.set('client_name',b.client_name);d.set('work_name','Casa Árvore');expect(correctionChanges(b,d).map(c=>c.key)).toEqual(['work_name']);});
});
describe('Isolamento da homologação',()=>{
 const e={VERCEL_ENV:'preview',TECHNICAL_TEST_LOCAL_AUTH:'true',NEXT_PUBLIC_SUPABASE_URL:'https://rnuanogfbhhphnnqxugf.supabase.co'};
 it('exige três condições explícitas',()=>{expect(isolatedTechnicalTest(e)).toBe(true);for(const key of Object.keys(e))expect(isolatedTechnicalTest({...e,[key]:undefined})).toBe(false);});
 it('nunca habilita login de teste no oficial ou outra base',()=>{expect(isolatedTechnicalTest({...e,VERCEL_ENV:'production'})).toBe(false);expect(isolatedTechnicalTest({...e,NEXT_PUBLIC_SUPABASE_URL:'https://jothuhbhlnazyobobtnn.supabase.co'})).toBe(false);});
});
