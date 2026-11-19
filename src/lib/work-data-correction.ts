export const correctionFields = {
 client_name:'Cliente', work_name:'Obra', full_address:'Endereço da obra', city:'Cidade', state:'UF', zip_code:'CEP', site_contact:'Contato da obra', site_contact_phone:'Telefone do contato', notes:'Observações',
} as const;
export type CorrectionKey=keyof typeof correctionFields;
export type CorrectionValues=Record<CorrectionKey,string|null>;
export function correctionChanges(before:CorrectionValues, data:FormData){
 return (Object.keys(correctionFields) as CorrectionKey[]).flatMap(key=>{
  const raw=String(data.get(key)??'');
  // Untouched values are never normalized as a side effect of another correction.
  if(raw===(before[key]??''))return [];
  const value=key==='state'?raw.trim().toUpperCase():raw.trim();
  if(value===(before[key]??''))return [];
  return [{key,label:correctionFields[key],before:before[key],after:value||null}];
 });
}
