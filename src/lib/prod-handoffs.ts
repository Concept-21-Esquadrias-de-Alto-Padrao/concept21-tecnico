import type {TechnicalDepartmentDelivery} from './types';
export const departmentDocuments = {
 suprimentos: ['Perfis da obra','Componentes da obra','Componentes de separação','Vidros','Películas'],
 producao: ['Itens da Obra','Controle de carga','Ordens de produção'],
} as const;
export function documentManifest(department:string, values:string[], notes:string|null){
 const allowed=departmentDocuments[department as keyof typeof departmentDocuments];
 if(!allowed) throw new Error('Departamento inválido.');
 const docs=[...new Set(values)];
 if(docs.some(d=>!(allowed as readonly string[]).includes(d))) throw new Error('Documento inválido para este setor.');
 return [docs.length?'Documentos enviados: '+docs.join('; '):'',notes?.trim()].filter(Boolean).join('\n')||null;
}
export function latestDepartmentDelivery(deliveries:TechnicalDepartmentDelivery[], department:string){
 return deliveries.filter(d=>d.department===department).sort((a,b)=>(b.delivered_at??b.created_at).localeCompare(a.delivered_at??a.created_at)||b.id.localeCompare(a.id))[0];
}
export function deliveryLabel(delivery?:TechnicalDepartmentDelivery){
 if(!delivery)return 'Não enviado';
 return {pendente:'Pendente',entregue:'Aguardando recebimento',confirmado:'Recebido',recusado:'Recusado',devolvido:'Devolvido'}[delivery.status];
}
