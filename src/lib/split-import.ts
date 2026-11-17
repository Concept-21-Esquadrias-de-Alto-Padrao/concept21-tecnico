import type {CemItem} from './cem-items';
export type SourcePiece={code:string;quantity:number;environment:string|null;width:number|null;height:number|null;releaseDate:string|null;alreadyIssued:boolean};
export type LinkedItem=CemItem&{contractCode:string};
export type SplitReport={batchNumber:string;digest:string;issued:string;rows:LinkedItem[]};
export function summarizeSplit(report:SplitReport,origins:SourcePiece[],issuedCodes:string[]=[]){
 const problems:string[]=[]; const codes=[...new Set(report.rows.map(r=>r.contractCode))];
 if(!report.rows.length)problems.push('Relatório vazio.');
 if(new Set(report.rows.map(r=>r.code)).size!==report.rows.length)problems.push('Código de fabricação duplicado.');
 for(const row of report.rows){
  if(!Number.isInteger(row.quantity)||row.quantity<1||!Number.isFinite(row.width)||!Number.isFinite(row.height)||row.width<=0||row.height<=0)problems.push('Quantidade ou medidas inválidas: '+row.code);
  if(!origins.some(p=>p.code===row.contractCode))problems.push('Selecione a origem de '+row.code);
 }
 for(const code of codes){const p=origins.find(p=>p.code===code);if(p&&(p.alreadyIssued||issuedCodes.includes(code)))problems.push('Origem já atendida por outra PROD: '+code);}
 return {problems,sourceCodes:codes,sourceUnits:origins.filter(p=>codes.includes(p.code)).reduce((n,p)=>n+p.quantity,0),manufacturingUnits:report.rows.reduce((n,r)=>n+r.quantity,0)};
}
export function splitBalance(origins:SourcePiece[],reports:SplitReport[]){
 const consumed=new Set<string>();const seen=new Set<string>();
 for(const report of reports){
  if(seen.has(report.digest))continue;
  const result=summarizeSplit(report,origins,[...consumed]);
  if(result.problems.length)throw new Error(result.problems.join('; '));
  seen.add(report.digest);result.sourceCodes.forEach(c=>consumed.add(c));
 }
 const total=origins.reduce((n,p)=>n+p.quantity,0),initial=origins.filter(p=>p.alreadyIssued).reduce((n,p)=>n+p.quantity,0);
 const added=origins.filter(p=>consumed.has(p.code)).reduce((n,p)=>n+p.quantity,0);
 return {total,initial,added,remaining:total-initial-added,consumed:[...consumed]};
}
export function assertApprovedMapping(report:SplitReport,approved:SplitReport){
 if(report.digest!==approved.digest||report.batchNumber!==approved.batchNumber||report.rows.length!==approved.rows.length)throw new Error('Relatório diferente do aprovado para este ensaio.');
 for(const row of report.rows){const expected=approved.rows.find(r=>r.code===row.code);
 if(!expected||row.contractCode!==expected.contractCode||row.quantity!==expected.quantity||row.width!==expected.width||row.height!==expected.height)throw new Error('Correspondência ou medidas diferentes do aprovado: '+row.code);}
}
