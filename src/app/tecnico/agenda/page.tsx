import { redirect } from "next/navigation";
import { TechnicalAgendaView } from "@/components/technical-agenda-view";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { VisitScheduleForm } from "@/components/visit-schedule-form";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalOperationalData } from "@/lib/technical-data";
import { toIsoDate } from "@/lib/utils";

export default async function TechnicalAgendaPage() {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.agenda)) redirect(firstAllowedAppRoute(access) ?? "/login");

  const snapshot = await getTechnicalOperationalData();
  const canManage = access.isMaster || access.permissions["technical.visits.manage"];
  const canCancel = access.isMaster || access.permissions["technical.visits.cancel"];
  const canReport = access.isMaster || access.permissions["technical.reports.generate"];

  return (
    <div className="space-y-6">
      <PageHeader title="Agenda Técnica" description="Agendamento, realização, cancelamento e relatório das visitas." />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <TechnicalAgendaView
          visits={snapshot.visits}
          contracts={snapshot.contracts}
          pieces={snapshot.pieces}
          visitPieces={snapshot.visitPieces}
          todayIso={toIsoDate(new Date())}
          canManage={canManage}
          canCancel={canCancel}
          canReport={canReport}
        />

        {canManage ? (
          <Panel>
            <PanelHeader title="Nova visita" />
            <PanelBody>
              <VisitScheduleForm contracts={snapshot.contracts} pieces={snapshot.pieces} />
            </PanelBody>
          </Panel>
        ) : null}
      </div>
    </div>
  );
}
