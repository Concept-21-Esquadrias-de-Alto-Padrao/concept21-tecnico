"use server";
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requirePermissionAccess} from '@/lib/server-access';
import type {ActionState} from '@/components/action-form';
const uuid=z.string().uuid();
const schema=z.object({principal:uuid,aditivo:uuid,reason:z.string().trim().min(5).max(1000),pairs:z.array(z.object({base:uuid,extra:uuid})).min(1).max(100)});
export async function linkAddendumAction(_state:ActionState,form:FormData):Promise<ActionState>{
 try{
  const ctx=await requirePermissionAccess('technical.prods.manage');
  if(form.get('confirmed')!=='on')return {ok:false,message:'Confirme que são as mesmas peças.'};
  const parsed=schema.safeParse({principal:form.get('principal'),aditivo:form.get('aditivo'),reason:form.get('reason'),pairs:JSON.parse(String(form.get('pairs')||'[]'))});
  if(!parsed.success)return {ok:false,message:'Escolha os contratos, pelo menos uma correspondência e informe o motivo.'};
  const v=parsed.data;
  const {error}=await ctx.admin.rpc('technical_link_addendum',{co:ctx.profile.company_id,actor:ctx.authUserId,principal:v.principal,aditivo:v.aditivo,pairs:v.pairs,reason:v.reason});
  if(error)return {ok:false,message:error.message};
  revalidatePath('/tecnico','layout');
  return {ok:true,message:'Vínculo registrado. A PROD do aditivo atende às peças principais, sem duplicar as quantidades.'};
 }catch{return {ok:false,message:'Não foi possível vincular. Confira seu acesso e tente novamente.'};}
}
