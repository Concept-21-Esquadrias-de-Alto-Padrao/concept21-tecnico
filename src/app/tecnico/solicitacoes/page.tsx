import { CheckCircle2, Clock3, ShieldCheck, XCircle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { decidePieceChangeRequestAction } from "@/app/actions";
import { ActionForm, Field, inputClass } from "@/components/action-form";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
  TECHNICAL_PERMISSIONS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { getTechnicalPieceChangeRequestsData } from "@/lib/technical-data";
import type { TechnicalPieceChangeRequest } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const changeLabels: Record<string, string> = {
  code: "Código",
  piece_type: "Descrição / modelo",
  environment: "Ambiente",
  sale_width_mm: "Largura de venda",
  sale_height_mm: "Altura de venda",
};

function personName(profiles: Array<{ id: string; name: string }>, id: string | null) {
  return profiles.find((profile) => profile.id === id)?.name ?? "Usuário não identificado";
}

function requestStatus(request: TechnicalPieceChangeRequest) {
  const labels = { pendente: "Pendente", aprovada: "Aprovada", recusada: "Recusada", cancelada: "Cancelada" };
  return labels[request.status];
}

export default async function TechnicalPieceChangeRequestsPage() {
  const access = await getCurrentPermissionFlags([...appNavigationPermissionKeys, ...TECHNICAL_PERMISSIONS]);
  if (!canAccessModule(access, MODULE_ACCESS.changeRequests)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const snapshot = await getTechnicalPieceChangeRequestsData();
  const pending = snapshot.pieceChangeRequests.filter((request) => request.status === "pendente");
  const history = snapshot.pieceChangeRequests.filter((request) => request.status !== "pendente").slice(0, 40);

  const requestCard = (request: TechnicalPieceChangeRequest, actionable: boolean) => {
    const piece = snapshot.pieces.find((item) => item.id === request.piece_id);
    const contract = snapshot.contracts.find((item) => item.id === request.contract_id);
    const changes = Object.entries(request.requested_changes ?? {}).filter(([key]) => key in changeLabels);
    return (
      <article key={request.id} className="rounded-md border border-border bg-white p-4 text-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/tecnico/contratos/${request.contract_id}#pecas`} className="font-semibold text-charcoal hover:text-accent">
              {contract?.contract_number ?? "Contrato"} · {piece?.code ?? "Peça"}
            </Link>
            <p className="mt-1 text-xs text-muted-foreground">
              {piece?.environment ?? "Sem ambiente"} · {piece?.piece_type ?? piece?.description ?? "Sem modelo"}
            </p>
          </div>
          <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-charcoal">
            {requestStatus(request)}
          </span>
        </div>

        <p className="mt-3">Motivo: {request.reason}</p>
        <p className="mt-2 text-xs text-muted-foreground">
          Solicitado por <span className="font-semibold text-charcoal">{personName(snapshot.profiles, request.requested_by_profile_id)}</span> em {formatDateTime(request.created_at)}.
        </p>
        {changes.length ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {changes.map(([key, value]) => (
              <div key={key} className="rounded-md bg-muted/50 p-2">
                <dt className="text-xs text-muted-foreground">{changeLabels[key]}</dt>
                <dd className="mt-1 font-semibold text-charcoal">{String(value ?? "-")}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {actionable ? (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ActionForm
              action={decidePieceChangeRequestAction}
              submitLabel="Aprovar e aplicar"
              className="rounded-md border border-green-200 bg-green-50 p-3"
              confirmMessage="Aprovar e aplicar esta alteração na peça?"
            >
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="decision" value="approve" />
              <Field label="Observação da aprovação">
                <input name="review_notes" className={inputClass} placeholder="Opcional" />
              </Field>
            </ActionForm>
            <ActionForm
              action={decidePieceChangeRequestAction}
              submitLabel="Recusar solicitação"
              className="rounded-md border border-red-200 bg-red-50 p-3"
              confirmMessage="Recusar esta solicitação?"
            >
              <input type="hidden" name="request_id" value={request.id} />
              <input type="hidden" name="decision" value="reject" />
              <Field label="Motivo da recusa">
                <input name="review_notes" className={inputClass} minLength={3} required />
              </Field>
            </ActionForm>
          </div>
        ) : (
          <div className="mt-3 rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
            <p>
              {request.status === "aprovada" ? <CheckCircle2 className="mr-1 inline size-4 text-green-700" /> : request.status === "recusada" ? <XCircle className="mr-1 inline size-4 text-red-700" /> : <Clock3 className="mr-1 inline size-4" />}
              Analisado por <span className="font-semibold text-charcoal">{personName(snapshot.profiles, request.reviewed_by_profile_id)}</span> em {formatDateTime(request.reviewed_at ?? request.updated_at)}.
            </p>
            {request.review_notes ? <p className="mt-1">Observação: {request.review_notes}</p> : null}
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Solicitações de peças"
        description="Aprovação controlada de edições e exclusões, com solicitante, responsável e data da decisão."
      />
      <Panel>
        <PanelHeader
          title="Aguardando autorização"
          actions={<span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">{pending.length} pendente(s)</span>}
        />
        <PanelBody className="space-y-3">
          {pending.length ? pending.map((request) => requestCard(request, true)) : (
            <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-green-700" /> Nenhuma solicitação pendente.
            </p>
          )}
        </PanelBody>
      </Panel>
      <Panel>
        <PanelHeader title="Histórico recente" />
        <PanelBody className="space-y-3">
          {history.length ? history.map((request) => requestCard(request, false)) : (
            <p className="text-sm text-muted-foreground">Nenhuma solicitação analisada.</p>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
