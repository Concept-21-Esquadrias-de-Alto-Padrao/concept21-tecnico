import {setIssues,type SetDraft} from './fabrication-link-preview';
import type {CemItem} from './cem-items';
export function validateSetDraft(value:unknown):SetDraft {
 if(!value||typeof value!=='object')throw Error('Conjunto inválido.');
 const d=value as SetDraft;
 if(typeof d.name!=='string'||d.name.length>150||!Array.isArray(d.contractCodes)||!Array.isArray(d.fabricationCodes)||!d.contractCodes.every(c=>typeof c==='string')||!d.fabricationCodes.every(c=>typeof c==='string')||!['','partial','total'].includes(d.coverage)||typeof d.pending!=='string'||d.pending.length>2000||typeof d.projectReference!=='string'||d.projectReference.length>1000)throw Error('Formato do conjunto inválido.');
 if(!Array.isArray(d.links)||d.links.some(l=>!l||typeof l.contractCode!=='string'||typeof l.fabricationCode!=='string'))throw Error('Vínculos inválidos.');
 const issues=setIssues(d);
 if(d.coverage==='partial'&&!d.pending.trim())issues.push('Descreva o que falta detalhar.');
 if(issues.length)throw Error(issues.join(' '));
 return {links:d.links.map(l=>({...l})),name:d.name.trim(),contractCodes:[...d.contractCodes].sort(),fabricationCodes:[...d.fabricationCodes].sort(),coverage:d.coverage,pending:d.pending,projectReference:d.projectReference};
}
export function validateFabricationReport(report:{contractNumber:string;batchNumber:string;issued:string;rows:CemItem[]},draft:SetDraft){
 if(report.contractNumber!=='26-0651'||!report.batchNumber||!/MADEIRA/i.test(report.batchNumber))throw Error('Use a PROD MADEIRA do Rafael 26-0651.');
 const expected=[...draft.fabricationCodes,'P01','P11'];
 if(report.rows.length!==expected.length||new Set(report.rows.map(r=>r.code)).size!==expected.length||report.rows.some(r=>!expected.includes(r.code)))throw Error('O PDF não corresponde aos recortes selecionados e às peças P01/P11.');
 if(report.rows.some(r=>!Number.isInteger(r.quantity)||r.quantity<=0||![r.width,r.height].every(n=>Number.isFinite(n)&&n>0)||![r.area,r.weight].every(n=>Number.isFinite(n)&&n>=0)))throw Error('Quantidade ou medidas inválidas.');
}
