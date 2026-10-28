import { z } from "zod";
export const meetingBlockLabels = {none:"Não bloqueia",entrada_inicial:"Entrega da pasta",visitas:"Agendamento de visita",liberacao_peca:"Liberação de medidas",prods:"Emissão de PROD"} as const;
export const meetingTaskSchema = z.object({id:z.string().uuid(),kind:z.enum(["correction","general"]),pieceIds:z.array(z.string().uuid()).max(1000),description:z.string().max(240),owner:z.string().max(36),due:z.string().max(10),block:z.enum(["none","entrada_inicial","visitas","liberacao_peca","prods"])});
export const alignmentDraftSchema = z.object({date:z.string().max(10),time:z.string().max(5),participants:z.string().max(4000),summary:z.string().max(8000),decisions:z.string().max(8000),tasks:z.array(meetingTaskSchema).max(100)});
export type AlignmentDraft = z.infer<typeof alignmentDraftSchema>;
export type AlignmentTask = z.infer<typeof meetingTaskSchema>;
export type AlignmentState = {version:number;status:"draft"|"completed";draft:AlignmentDraft;meetingId?:string;updatedAt?:string;updatedBy?:string};
export function readAlignment(data:Record<string,unknown>|null|undefined):AlignmentState|null {const parsed=z.object({version:z.number().int(),status:z.enum(["draft","completed"]),draft:alignmentDraftSchema,meetingId:z.string().uuid().optional(),updatedAt:z.string().optional(),updatedBy:z.string().optional()}).safeParse(data?.alignment);return parsed.success?parsed.data:null;}
export function emptyAlignment():AlignmentDraft {return {date:"",time:"15:00",participants:"",summary:"",decisions:"",tasks:[]};}
export function validDate(value:string) {return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;}
export class AlignmentFieldError extends Error {
 constructor(message:string,public taskId:string,public field:string){super(message);this.name="AlignmentFieldError";}
}
export function validateAlignment(draft:AlignmentDraft) {
 if(!validDate(draft.date)) throw new Error("Informe uma data válida para a reunião.");
 if(draft.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) throw new Error("Informe um horário válido.");
 if(!draft.participants.trim()) throw new Error("Informe os participantes da reunião.");
 const ids=new Set<string>(), signatures=new Set<string>();
 const count={correction:0,general:0};
 for(const t of draft.tasks) {
  const prefix=`${t.kind==='correction'?'Correção':'Ação geral'} ${++count[t.kind]}: `;
  if(ids.has(t.id))throw new Error("Há atividades com identificador repetido. Atualize a página.");ids.add(t.id);
  if(!t.description.trim())throw new AlignmentFieldError(prefix+'preencha o campo “O que deve ser feito”.',t.id,"description");
  if(!z.string().uuid().safeParse(t.owner).success)throw new AlignmentFieldError(prefix+"selecione o responsável.",t.id,"owner");
  if(!validDate(t.due))throw new AlignmentFieldError(prefix+"informe o prazo de conclusão.",t.id,"due");
  if(t.kind==="correction"&&!t.pieceIds.length)throw new AlignmentFieldError(prefix+"selecione pelo menos uma peça.",t.id,"pieces");
  if(t.kind==="general"&&t.pieceIds.length)throw new Error(prefix+"ações gerais não devem possuir peças.");
  if(new Set(t.pieceIds).size!==t.pieceIds.length)throw new Error(prefix+"há peças repetidas.");
  const sig=JSON.stringify([t.kind,[...t.pieceIds].sort(),t.description.trim().toLowerCase(),t.owner,t.due,t.block]);
  if(signatures.has(sig))throw new Error(prefix+"esta atividade já foi adicionada. Remova a repetição.");signatures.add(sig);
 }
 return draft;
}
