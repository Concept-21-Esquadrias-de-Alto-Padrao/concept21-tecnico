import Link from "next/link";
import {notFound} from "next/navigation";
import {AlignmentWorkspace,type MeetingPiece} from "@/components/alignment-workspace";
import {ActionForm} from "@/components/action-form";
import {transitionTechnicalActionAction} from "@/app/actions";
import {emptyAlignment,readAlignment,meetingBlockLabels,type AlignmentState} from "@/lib/alignment-meeting";
import {requirePermissionAccess,getCurrentPermissionFlags} from "@/lib/server-access";
import {readReceipt} from "@/lib/commercial-receipt";
export const dynamic="force-dynamic";
export default async function MeetingPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{atividade?:string;retorno?:string}>}) {
 const {id}=await params,query=await searchParams;
 const context=await requirePermissionAccess("technical.contracts.view"),admin=context.admin,company=context.profile.company_id;
 const access=await getCurrentPermissionFlags(["technical.meetings.manage","technical.actions.view","technical.actions.manage","technical.actions.validate","technical.actions.reopen"]);
 const can=(key:string)=>access.isMaster||Boolean(access.permissions[key]);
 const [contractResult,technicalResult,piecesResult,profilesResult,meetingsResult,actionsResult]=await Promise.all([
 admin.from('production_contracts').select('id,contract_number,work_name').eq('company_id',company).eq('id',id).maybeSingle(),
 admin.from('technical_contracts').select('commercial_data,technical_status').eq('company_id',company).eq('contract_id',id).is('deleted_at',null).maybeSingle(),
 admin.from('technical_contract_pieces').select('id,code,environment,piece_type,description,status').eq('company_id',company).eq('contract_id',id).is('deleted_at',null).order('code'),
 admin.from('profiles').select('id,name').eq('company_id',company).eq('status','active').order('name'),
 admin.from('technical_closing_meetings').select('*').eq('company_id',company).eq('contract_id',id).order('created_at',{ascending:false}),
 can('technical.actions.view') ? admin.from('technical_actions').select('*').eq('company_id',company).eq('contract_id',id).not('meeting_id','is',null).is('deleted_at',null).order('created_at') : Promise.resolve({data:[],error:null}),
 ]);
 for(const result of [contractResult,technicalResult,piecesResult,profilesResult,meetingsResult,actionsResult])if(result.error)throw result.error;
 if(!contractResult.data||!technicalResult.data)notFound();
 const contract=contractResult.data,technical=technicalResult.data,pieces=(piecesResult.data??[]) as (MeetingPiece&{status:string})[],profiles=profilesResult.data??[],meetings=meetingsResult.data??[],actions=actionsResult.data??[];
 const linksResult=actions.length?await admin.from('technical_action_pieces').select('action_id,piece_id').in('action_id',actions.map(a=>a.id)):{data:[],error:null};
 if(linksResult.error)throw linksResult.error;
 const links=linksResult.data??[];
 const stored=readAlignment(technical.commercial_data),receipt=readReceipt(technical.commercial_data),completedMeeting=meetings.find(m=>m.status==='concluida');
 const reason=!can('technical.meetings.manage')?'Você tem acesso de consulta. O registro da reunião é feito por quem tem permissão comercial.':receipt&&receipt.status!=='completed'?'Conclua a conferência do recebimento antes da reunião.':technical.technical_status!=='aguardando_reuniao'||completedMeeting?'Esta reunião já está encerrada. Uma alteração exige reabertura com motivo na obra.':null;
 let initial:AlignmentState=stored??{version:0,status:'draft',draft:emptyAlignment()};
 if(stored?.status==='completed'&&technical.technical_status==='aguardando_reuniao'&&!completedMeeting)initial={version:stored.version,status:'draft',draft:emptyAlignment()};
 if(!stored&&completedMeeting)initial={version:0,status:'completed',draft:{...emptyAlignment(),date:completedMeeting.meeting_date,time:completedMeeting.meeting_time?.slice(0,5)??'',participants:(completedMeeting.participants??[]).join('; '),summary:completedMeeting.summary??'',decisions:completedMeeting.decisions??''}};
 const returnTo=query.retorno?.startsWith('/tecnico/minhas-atividades')&&!query.retorno.includes('://')?query.retorno:'/tecnico/minhas-atividades';
 const selected=query.atividade?actions.find(a=>a.id===query.atividade):null;
 if(query.atividade&&!selected)notFound();
 function activityCard(a:typeof actions[number]) {
 const linked=links.filter(l=>l.action_id===a.id).map(l=>pieces.find(p=>p.id===l.piece_id)).filter((p):p is MeetingPiece&{status:string}=>Boolean(p));
 return <article key={a.id} id={`atividade-action-${a.id}`} className="scroll-mt-24 space-y-3 rounded-xl border bg-white p-5"><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{a.title}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs">{a.status.replaceAll('_',' ')}</span></div><p className="text-sm text-slate-600">Responsável: {profiles.find(p=>p.id===a.responsible_profile_id)?.name??'Responsável histórico'} · Prazo: {a.due_date?.split('-').reverse().join('/')??'Não informado'}</p>{linked.length>0&&<ul className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">{linked.map(p=><li key={p.id}>{p.environment||'Ambiente não informado'} · {p.piece_type||p.description||'Modelo não informado'} · <strong>{p.code}</strong></li>)}</ul>}<p className="whitespace-pre-wrap text-sm">{a.description}</p><p className={`text-sm ${a.blocking?'text-amber-800':'text-slate-500'}`}>{a.blocking?`Bloqueia: ${meetingBlockLabels[a.blocking_stage as keyof typeof meetingBlockLabels]??a.blocking_stage}`:'Não bloqueia o andamento da obra'}</p>
 {selected?<div className="flex flex-wrap gap-3">{a.status==='aberta'&&can('technical.actions.manage')&&<ActionForm action={transitionTechnicalActionAction} submitLabel="Iniciar atividade"><input type="hidden" name="id" value={a.id}/><input type="hidden" name="next_status" value="em_andamento"/></ActionForm>}{['aberta','em_andamento'].includes(a.status)&&can('technical.actions.validate')&&<ActionForm action={transitionTechnicalActionAction} submitLabel="Validar atividade"><input type="hidden" name="id" value={a.id}/><input type="hidden" name="next_status" value="validada"/></ActionForm>}{a.status==='validada'&&can('technical.actions.manage')&&<ActionForm action={transitionTechnicalActionAction} submitLabel="Concluir atividade"><input type="hidden" name="id" value={a.id}/><input type="hidden" name="next_status" value="concluida"/></ActionForm>}</div>:<Link href={`/tecnico/contratos/${id}/reuniao?atividade=${a.id}`} className="inline-block text-sm font-semibold text-orange-700">Abrir atividade →</Link>}</article>;
 }
 if(selected)return <div className="mx-auto max-w-4xl space-y-5"><Link href={returnTo} className="text-sm font-semibold text-orange-700">← Voltar para Meu trabalho</Link><div><p className="text-xs font-semibold uppercase text-orange-700">Atividade da reunião de alinhamento</p><h1 className="mt-2 text-2xl font-semibold">{contract.contract_number} · {contract.work_name}</h1></div>{activityCard(selected)}<Link href={`/tecnico/contratos/${id}/reuniao`} className="inline-block text-sm text-slate-600">Consultar reunião e demais encaminhamentos →</Link></div>;
 return <div className="space-y-8"><AlignmentWorkspace key={`${id}-${initial.version}`} contractId={id} number={contract.contract_number} name={contract.work_name} initial={initial} pieces={pieces.filter(p=>p.status!=='cancelada')} profiles={profiles} editable={!reason} reason={reason} reference={receipt?.draft.reference??null}/>{actions.length>0&&<section className="space-y-4"><h2 className="text-xl font-semibold">Atividades geradas nas reuniões</h2><div className="grid gap-4 lg:grid-cols-2">{actions.map(activityCard)}</div></section>}{meetings.length>0&&<section className="space-y-4"><h2 className="text-xl font-semibold">Histórico de reuniões</h2>{meetings.map(m=><details key={m.id} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">{m.meeting_date.split('-').reverse().join('/')} · {m.status==='concluida'?'Concluída':m.status==='cancelada'?'Registro anterior — etapa reaberta':m.status}</summary><p className="mt-3 text-sm">Participantes: {(m.participants??[]).join(', ')}</p><p className="mt-2 whitespace-pre-wrap text-sm">{m.summary}</p><p className="mt-2 whitespace-pre-wrap text-sm">{m.decisions}</p></details>)}</section>}</div>;
}
