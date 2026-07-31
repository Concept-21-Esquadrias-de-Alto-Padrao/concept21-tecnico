import { BarChart3 } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { StatCard } from "@/components/stat-card";
import { SummarySheetButton } from "@/components/summary-sheet-button";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { buildContractOverviews, getTechnicalOperationalData } from "@/lib/technical-data";
import { calculateReleaseProgress } from "@/lib/technical-rules";
import { formatNumber } from "@/lib/utils";

export default async function TechnicalReportsPage() {
  const access = await getCurrentPermissionFlags(appNavigationPermissionKeys);
  if (!canAccessModule(access, MODULE_ACCESS.reports)) redirect(firstAllowedAppRoute(access) ?? "/login");
  const snapshot = await getTechnicalOperationalData();
  const overviews = buildContractOverviews(snapshot);
  const piecesTotal = snapshot.pieces.length;
  const released = snapshot.pieces.filter((piece) => ["liberada", "em_prod", "entregue"].includes(piece.status)).length;
  const percent = piecesTotal ? Math.round((released / piecesTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Indicadores e Relatórios"
        description="Indicadores operacionais e planilha-resumo gerada a partir dos dados estruturados, sem armazenar arquivo final."
        actions={<SummarySheetButton overviews={overviews} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Contratos" value={overviews.length} icon={BarChart3} />
        <StatCard label="Peças contratadas" value={piecesTotal} icon={BarChart3} />
        <StatCard label="Percentual liberado" value={`${percent}%`} icon={BarChart3} tone="success" />
        <StatCard label="PRODs devolvidos" value={snapshot.prodBatches.filter((prod) => prod.status === "devolvido").length} icon={BarChart3} tone="danger" />
      </div>
      <Panel>
        <PanelHeader title="Painel gerencial por contrato" />
        <PanelBody className="space-y-3">
          <div className="space-y-3 md:hidden">
            {overviews.map((overview) => {
              const progress = calculateReleaseProgress(overview.pieces);
              return (
                <article key={overview.contract.id} className="rounded-md border border-border bg-white p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-charcoal">{overview.contract.contract_number}</p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {overview.client?.name ?? "-"}
                      </p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-charcoal">
                      {formatNumber(progress.percent)}%
                    </span>
                  </div>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Liberado</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{formatNumber(progress.percent)}%</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Correções</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{overview.corrections.length}</dd>
                    </div>
                    <div className="rounded-md bg-muted/50 p-2">
                      <dt className="text-muted-foreground">Dúvidas</dt>
                      <dd className="mt-1 font-semibold text-charcoal">{overview.doubts.length}</dd>
                    </div>
                  </dl>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
          <table className="min-w-[800px] w-full border-separate border-spacing-0 bg-white text-left text-sm">
            <thead><tr className="text-xs uppercase text-muted-foreground"><th className="border-b border-border px-3 py-3">Contrato</th><th className="border-b border-border px-3 py-3">Cliente</th><th className="border-b border-border px-3 py-3">Liberado</th><th className="border-b border-border px-3 py-3">Correções</th><th className="border-b border-border px-3 py-3">Dúvidas</th></tr></thead>
            <tbody>
              {overviews.map((overview) => {
                const progress = calculateReleaseProgress(overview.pieces);
                return (
                  <tr key={overview.contract.id}>
                    <td className="border-b border-border px-3 py-3 font-semibold text-charcoal">{overview.contract.contract_number}</td>
                    <td className="border-b border-border px-3 py-3">{overview.client?.name ?? "-"}</td>
                    <td className="border-b border-border px-3 py-3">{formatNumber(progress.percent)}%</td>
                    <td className="border-b border-border px-3 py-3">{overview.corrections.length}</td>
                    <td className="border-b border-border px-3 py-3">{overview.doubts.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
