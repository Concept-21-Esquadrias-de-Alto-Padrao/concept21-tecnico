import Link from "next/link";
import { redirect } from "next/navigation";
import { cancelVisitAction, generateVisitReportFormAction, recordVisitResultAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { VisitReportPdfButton } from "@/components/visit-report-pdf-button";
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
import type { TechnicalPiece } from "@/lib/types";
import { formatDate } from "@/lib/utils";

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

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel>
          <PanelHeader title="Visitas" />
          <PanelBody className="space-y-3">
            {snapshot.visits.map((visit) => {
              const contract = snapshot.contracts.find((item) => item.id === visit.contract_id);
              const linkedPieces = snapshot.visitPieces
                .filter((link) => link.visit_id === visit.id)
                .map((link) => snapshot.pieces.find((piece) => piece.id === link.piece_id))
                .filter((piece): piece is TechnicalPiece => Boolean(piece));

              return (
                <article key={visit.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <Link href={`/tecnico/contratos/${visit.contract_id}`} className="font-semibold text-charcoal hover:text-accent">
                        {formatDate(visit.scheduled_date)} · {contract?.contract_number ?? "Contrato"}
                      </Link>
                      <p className="mt-1 text-muted-foreground">{visit.visit_type} · {visit.technicians.join(", ") || "Sem técnico"}</p>
                    </div>
                    <StatusBadge status={visit.status} type="visit" />
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Peças: {linkedPieces.map((piece) => piece.code).join(", ") || "Não vinculadas"}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {visit.report_snapshot ? <VisitReportPdfButton visit={visit} pieces={linkedPieces} /> : null}
                    {canReport && visit.status === "aguardando_relatorio" ? (
                      <form action={generateVisitReportFormAction}>
                        <input type="hidden" name="id" value={visit.id} />
                        <button className="rounded-md bg-charcoal px-3 py-2 text-xs font-semibold text-white hover:bg-black">Gerar relatório</button>
                      </form>
                    ) : null}
                  </div>
                  {canManage && visit.status === "agendada" ? (
                    <ActionForm action={recordVisitResultAction} submitLabel="Registrar realização" className="mt-3 rounded-md bg-muted/40 p-3">
                      <input type="hidden" name="id" value={visit.id} />
                      <Field label="Realizada em"><input name="performed_at" type="datetime-local" className={inputClass} required /></Field>
                      <Field label="Acompanhada por"><input name="accompanied_by" className={inputClass} /></Field>
                      <Field label="Resultado"><textarea name="result_summary" className={textareaClass} required /></Field>
                    </ActionForm>
                  ) : null}
                  {canCancel && visit.status === "agendada" ? (
                    <ActionForm action={cancelVisitAction} submitLabel="Cancelar visita" className="mt-3 rounded-md bg-red-50 p-3">
                      <input type="hidden" name="id" value={visit.id} />
                      <Field label="Motivo"><input name="cancel_reason" className={inputClass} required /></Field>
                    </ActionForm>
                  ) : null}
                </article>
              );
            })}
            {!snapshot.visits.length ? <p className="text-sm text-muted-foreground">Nenhuma visita registrada.</p> : null}
          </PanelBody>
        </Panel>

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
