"use client";
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {ActionForm} from './action-form';
import {linkAddendumAction} from '@/app/tecnico/contratos/aditivos/actions';
type Piece={id:string;code:string;contract_id:string;environment:string|null;quantity:number;measured_width_mm:number|null;measured_height_mm:number|null;active_prod_batch_id:string|null;complements_piece_id?:string|null;fulfilled_by_addendum_piece_id?:string|null;status:string};
type Contract={id:string;contract_number:string;work_name:string};
export function AddendumLinkForm({principal,contracts,pieces,prods}:{principal:string;contracts:Contract[];pieces:Piece[];prods:{id:string;batch_number:string;status:string}[]}){
 const router=useRouter();const [aditivo,setAditivo]=useState('');const [pairs,setPairs]=useState<Record<string,string>>({});
 const primary=pieces.filter(p=>p.contract_id===principal&&!p.active_prod_batch_id&&!p.complements_piece_id&&!p.fulfilled_by_addendum_piece_id&&p.status!=='cancelada');
 const extra=pieces.filter(p=>p.contract_id===aditivo&&!p.complements_piece_id&&!p.fulfilled_by_addendum_piece_id&&prods.some(b=>b.id===p.active_prod_batch_id&&b.status==='aprovado'));
 const selected=Object.entries(pairs).filter(([,value])=>value).map(([base,extra])=>({base,extra}));
 return <ActionForm action={linkAddendumAction} submitLabel="Confirmar vínculo sem duplicar peças" confirmMessage="Confirmar que são as mesmas peças físicas? A PROD existente atenderá ao principal e ao aditivo; valores e medidas serão preservados." onSuccess={()=>{setPairs({});router.refresh();}}>
 <input type="hidden" name="principal" value={principal}/><input type="hidden" name="pairs" value={JSON.stringify(selected)}/>
 <label className="block font-semibold">Aditivo<select name="aditivo" required className="mt-2 w-full rounded-lg border bg-white p-3" value={aditivo} onChange={e=>{setAditivo(e.target.value);setPairs({});}}><option value="">Escolha o contrato de aditivo</option>{contracts.filter(c=>c.id!==principal).map(c=><option key={c.id} value={c.id}>{c.contract_number} · {c.work_name}</option>)}</select></label>
 <p className="text-sm text-muted-foreground">Para complementos das mesmas peças com PROD já aprovada. Itens novos do aditivo permanecem separados. Confira cliente, ambiente e medida antes de confirmar.</p>
 {aditivo&&<div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-3">Peça principal</th><th>Ambiente / medida de campo</th><th>Complemento no aditivo</th></tr></thead><tbody>{primary.map(p=><tr className="border-t" key={p.id}><td className="p-3 font-semibold">{p.code} × {p.quantity}</td><td>{p.environment||'—'}<small className="block">{p.measured_width_mm&&p.measured_height_mm?`${p.measured_width_mm} × ${p.measured_height_mm} mm`:'Medida de campo não informada'}</small></td><td><select aria-label={`Complemento da peça ${p.code}`} className="my-2 w-full rounded border bg-white p-2" value={pairs[p.id]||''} onChange={e=>setPairs({...pairs,[p.id]:e.target.value})}><option value="">Não vincular</option>{extra.filter(x=>x.quantity===p.quantity).map(x=><option disabled={selected.some(s=>s.extra===x.id&&s.base!==p.id)} key={x.id} value={x.id}>{x.code} · {x.environment} · {x.measured_width_mm??'—'} × {x.measured_height_mm??'—'} · {prods.find(b=>b.id===x.active_prod_batch_id)?.batch_number}</option>)}</select></td></tr>)}</tbody></table>{!extra.length&&<p>Nenhum complemento disponível com PROD aprovada neste contrato.</p>}</div>}
 <label className="block font-semibold">O que foi acrescentado?<input required name="reason" maxLength={1000} className="mt-2 w-full rounded-lg border p-3" placeholder="Ex.: persianas nas janelas das três suítes"/></label>
 <div className="rounded-lg bg-slate-100 p-4">{selected.length} correspondência(s). A produção já existente será aproveitada. Não será criada outra PROD.</div>
 <label className="block text-sm"><input type="checkbox" name="confirmed" required className="mr-2"/>Conferi que são as mesmas peças físicas e que o aditivo complementa este contrato.</label>
 </ActionForm>;
}
