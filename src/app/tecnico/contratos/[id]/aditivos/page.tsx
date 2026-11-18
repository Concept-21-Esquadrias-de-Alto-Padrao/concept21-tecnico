import Link from 'next/link';
import {notFound} from 'next/navigation';
import {requirePermissionAccess} from '@/lib/server-access';
import {AddendumLinkForm} from '@/components/addendum-link-form';
export default async function Page({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const ctx=await requirePermissionAccess('technical.prods.manage');const co=ctx.profile.company_id;
 const loadPieces=async()=>{
  const first=await ctx.admin.from('technical_contract_pieces').select('id,contract_id,code,environment,quantity,status,measured_width_mm,measured_height_mm,active_prod_batch_id,complements_piece_id,fulfilled_by_addendum_piece_id').eq('company_id',co).is('deleted_at',null).order('id').range(0,499);if(first.error)return first;
  const all=[...(first.data??[])];let last=first.data?.length??0;
  for(let offset=500;last===500;offset+=500){const next=await ctx.admin.from('technical_contract_pieces').select('id,contract_id,code,environment,quantity,status,measured_width_mm,measured_height_mm,active_prod_batch_id,complements_piece_id,fulfilled_by_addendum_piece_id').eq('company_id',co).is('deleted_at',null).order('id').range(offset,offset+499);if(next.error)return next;all.push(...(next.data??[]));last=next.data?.length??0;}
  return {...first,data:all};
 };
 const results=await Promise.all([ctx.admin.from('production_contracts').select('id,contract_number,work_name').eq('company_id',co).eq('active',true).order('contract_number'),loadPieces(),ctx.admin.from('technical_prod_batches').select('id,batch_number,status').eq('company_id',co).is('deleted_at',null),ctx.admin.from('technical_contracts').select('contract_id').eq('company_id',co).not('deleted_at','is',null)]);
 if(results.some(r=>r.error))throw Error('Não foi possível carregar os vínculos. Tente novamente.');
 const removed=new Set((results[3].data??[]).map(c=>c.contract_id));
 const contracts=(results[0].data??[]).filter(c=>!removed.has(c.id)),pieces=(results[1].data??[]).filter(p=>!removed.has(p.contract_id)),prods=results[2].data??[];
 const principal=contracts.find(c=>c.id===id);if(!principal)notFound();
 const linked=pieces.filter(p=>p.contract_id===id&&(p.fulfilled_by_addendum_piece_id||p.complements_piece_id));
 return <main className="space-y-6"><Link className="text-sm underline" href={`/tecnico/contratos/${id}`}>← Voltar ao contrato</Link><header><h1 className="text-2xl font-semibold">Vincular aditivo</h1><p>{principal.contract_number} · {principal.work_name}</p></header>
 {linked.length>0&&<section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Vínculos existentes</h2>{linked.map(p=>{const target=pieces.find(x=>x.id===(p.fulfilled_by_addendum_piece_id||p.complements_piece_id));return <p className="mt-2 text-sm" key={p.id}>{p.code} → {contracts.find(c=>c.id===target?.contract_id)?.contract_number} · {target?.code} · {p.complements_piece_id?'Complemento da mesma peça — não soma outra unidade':'Atendida pela PROD do aditivo'}</p>;})}<p className="mt-3 text-sm text-muted-foreground">Produção e instalação devem usar uma única peça física. Contratos, valores e medidas originais permanecem preservados.</p></section>}
 <section className="rounded-xl border bg-white p-5"><AddendumLinkForm principal={id} contracts={contracts} pieces={pieces} prods={prods}/></section></main>;
}
