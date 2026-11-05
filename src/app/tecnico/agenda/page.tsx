import {redirect} from 'next/navigation';
import {AgendaWorkspace} from '@/components/agenda-workspace';
import {appNavigationPermissionKeys,canAccessModule,firstAllowedAppRoute,MODULE_ACCESS,TECHNICAL_PERMISSIONS} from '@/lib/module-access';
import {getCurrentPermissionFlags} from '@/lib/server-access';
import {buildContractOverviews,getTechnicalOperationalData} from '@/lib/technical-data';
export default async function TechnicalAgendaPage(){
 const access=await getCurrentPermissionFlags([...appNavigationPermissionKeys,...TECHNICAL_PERMISSIONS]);
 if(!canAccessModule(access,MODULE_ACCESS.agenda))redirect(firstAllowedAppRoute(access)??'/login');
 const snapshot=await getTechnicalOperationalData();
 return <AgendaWorkspace works={buildContractOverviews(snapshot)} visitPieces={snapshot.visitPieces}
 today={new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo'}).format(new Date())}
 holidays={snapshot.dashboardHolidays??[]}
 canManage={access.isMaster||Boolean(access.permissions['technical.visits.manage'])}
 canCancel={access.isMaster||Boolean(access.permissions['technical.visits.cancel'])}
 canReport={access.isMaster||Boolean(access.permissions['technical.reports.generate'])}
 homologation={process.env.VERCEL_ENV==='preview'}/>;
}
