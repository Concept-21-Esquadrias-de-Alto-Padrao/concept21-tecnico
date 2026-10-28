import {describe,it,expect} from 'vitest';
import {alignmentDraftSchema,emptyAlignment,validateAlignment,validDate,type AlignmentTask} from './alignment-meeting';
const one='00000000-0000-4000-8000-000000000001',two='00000000-0000-4000-8000-000000000002';
const task:AlignmentTask={id:one,kind:'correction',pieceIds:[one,two],description:'Ajustar o acabamento',owner:one,due:'2026-10-30',block:'entrada_inicial'};
const draft=()=>({...emptyAlignment(),date:'2026-10-28',participants:'Comercial; Obras',tasks:[{...task}]});
describe('alignment meeting requirements',()=>{
 it('allows saving incomplete drafts, but cannot conclude them',()=>{expect(alignmentDraftSchema.safeParse(emptyAlignment()).success).toBe(true);expect(()=>validateAlignment(emptyAlignment())).toThrow('data');});
 it('one correction can link several pieces without becoming several tasks',()=>{expect(validateAlignment(draft()).tasks).toHaveLength(1);});
 it.each(['owner','due','description'] as const)('requires %s even for non-blocking tasks',key=>{const d=draft();d.tasks[0]={...task,block:'none',[key]:''};expect(()=>validateAlignment(d)).toThrow();});
 it('general actions do not require pieces but still require a deadline',()=>{const d=draft();d.tasks[0]={...task,kind:'general',pieceIds:[]};expect(validateAlignment(d)).toBe(d);d.tasks[0].due='';expect(()=>validateAlignment(d)).toThrow('prazo');});
 it('rejects identical content even with different task ids and piece order',()=>{const d=draft();d.tasks.push({...task,id:two,pieceIds:[two,one],description:'  AJUSTAR O ACABAMENTO  '});expect(()=>validateAlignment(d)).toThrow('já foi adicionada');});
 it('rejects correction without pieces and general action linked to pieces',()=>{const d=draft();d.tasks[0].pieceIds=[];expect(()=>validateAlignment(d)).toThrow('peça');d.tasks[0]={...task,kind:'general'};expect(()=>validateAlignment(d)).toThrow('gerais');});
 it('allows concluding a meeting without corrections',()=>{const d=draft();d.tasks=[];expect(validateAlignment(d)).toBe(d);});
 it('rejects invalid dates and does not silently normalize them',()=>{expect(validDate('2026-02-30')).toBe(false);expect(validDate('2026-10-30')).toBe(true);});
});

it('uses visible section numbering when corrections and general actions are interleaved',()=>{
 const d=draft();
 d.tasks.push({...task,id:two,kind:'general',pieceIds:[],description:'Contato da obra'});
 d.tasks.push({...task,id:'00000000-0000-4000-8000-000000000003',description:''});
 expect(()=>validateAlignment(d)).toThrow('Correção 2: preencha o campo “O que deve ser feito”.');
 d.tasks[2].description='Outro ajuste';d.tasks[1].due='';
 expect(()=>validateAlignment(d)).toThrow('Ação geral 1: informe o prazo de conclusão.');
});
