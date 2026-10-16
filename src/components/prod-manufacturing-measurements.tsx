import { History, Ruler } from "lucide-react";
import { saveProdManufacturingMeasurementsAction } from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import type {
  Profile,
  TechnicalPiece,
  TechnicalProdBatch,
  TechnicalProdPieceManufacturingMeasurement,
} from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

function dimensions(width: number | null, height: number | null) {
  return width && height ? `${width} x ${height} mm` : "Não informada";
}

function profileName(profiles: Profile[], profileId: string | null) {
  return profiles.find((profile) => profile.id === profileId)?.name ?? "Usuário não identificado";
}

export function ProdManufacturingMeasurements({
  prod,
  pieces,
  measurements,
  profiles,
  canManage,
}: {
  prod: TechnicalProdBatch;
  pieces: TechnicalPiece[];
  measurements: TechnicalProdPieceManufacturingMeasurement[];
  profiles: Profile[];
  canManage: boolean;
}) {
  const currentRevision = prod.current_revision ?? 0;
  const current = measurements.filter((measurement) => measurement.prod_revision === currentRevision);
  const currentByPiece = new Map(current.map((measurement) => [measurement.piece_id, measurement]));
  const revisions = Array.from(new Set(measurements.map((measurement) => measurement.prod_revision)))
    .sort((left, right) => right - left);
  const canRecord = canManage && !["entregue_suprimentos", "entregue_producao", "concluido", "cancelado"].includes(prod.status);

  return (
    <section className="mt-3 min-w-0 space-y-3 rounded-md border border-border bg-muted/30 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="inline-flex items-center gap-2 font-semibold text-charcoal">
            <Ruler className="size-4 text-accent" />
            Medidas de fabricação / CEM
          </h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Medidas efetivas em milímetros, separadas da venda e da medição em campo.
          </p>
        </div>
        <span className="rounded-md bg-white px-2 py-1 text-xs font-semibold text-charcoal ring-1 ring-border">
          {currentRevision ? `Revisão ${currentRevision}` : "Sem revisão"}
        </span>
      </div>

      <div className="grid gap-2 xl:hidden">
        {pieces.map((piece) => {
          const measurement = currentByPiece.get(piece.id);
          return (
            <article key={piece.id} className="min-w-0 rounded-md border border-border bg-white p-3 text-xs">
              <div className="min-w-0">
                <p className="font-semibold text-charcoal">{piece.code}</p>
                <p className="mt-1 break-words text-muted-foreground">
                  {piece.environment ?? "Sem ambiente"} · {piece.piece_type ?? piece.description ?? "Sem modelo"}
                </p>
              </div>
              <dl className="mt-3 grid gap-2 sm:grid-cols-3">
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">Venda</dt>
                  <dd className="mt-1 font-semibold text-charcoal">{dimensions(piece.sale_width_mm, piece.sale_height_mm)}</dd>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">Campo</dt>
                  <dd className="mt-1 font-semibold text-charcoal">{dimensions(piece.measured_width_mm, piece.measured_height_mm)}</dd>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <dt className="text-muted-foreground">Fabricação</dt>
                  <dd className="mt-1 font-semibold text-charcoal">
                    {measurement
                      ? dimensions(measurement.manufacturing_width_mm, measurement.manufacturing_height_mm)
                      : "Pendente"}
                  </dd>
                </div>
              </dl>
            </article>
          );
        })}
      </div>

      <div className="hidden rounded-md border border-border bg-white xl:block">
        <table className="w-full table-fixed text-left text-xs">
          <thead className="bg-muted/60 text-muted-foreground">
            <tr>
              <th className="w-20 px-3 py-2">Peça</th>
              <th className="w-[38%] px-3 py-2">Ambiente / modelo</th>
              <th className="px-3 py-2">Venda</th>
              <th className="px-3 py-2">Campo</th>
              <th className="px-3 py-2">Fabricação</th>
            </tr>
          </thead>
          <tbody>
            {pieces.map((piece) => {
              const measurement = currentByPiece.get(piece.id);
              return (
                <tr key={piece.id} className="border-t border-border align-top">
                  <td className="px-3 py-2 font-semibold text-charcoal">{piece.code}</td>
                  <td className="break-words px-3 py-2 text-muted-foreground">
                    {piece.environment ?? "Sem ambiente"} · {piece.piece_type ?? piece.description ?? "Sem modelo"}
                  </td>
                  <td className="px-3 py-2">{dimensions(piece.sale_width_mm, piece.sale_height_mm)}</td>
                  <td className="px-3 py-2">{dimensions(piece.measured_width_mm, piece.measured_height_mm)}</td>
                  <td className="px-3 py-2 font-semibold text-charcoal">
                    {measurement
                      ? dimensions(measurement.manufacturing_width_mm, measurement.manufacturing_height_mm)
                      : "Pendente"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canRecord ? (
        <details className="rounded-md border border-border bg-white" open={!currentRevision}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-semibold text-charcoal">
            {currentRevision ? "Registrar nova revisão" : "Registrar medidas de fabricação"}
          </summary>
          <ActionForm
            action={saveProdManufacturingMeasurementsAction}
            submitLabel={currentRevision ? "Salvar nova revisão" : "Salvar medidas"}
            className="space-y-3 border-t border-border p-3"
            preserveOnError
            confirmMessage={currentRevision ? "Esta alteração criará uma nova revisão e devolverá a PROD para conferência. Continuar?" : undefined}
          >
            <input type="hidden" name="prod_batch_id" value={prod.id} />
            <div className="grid gap-3 lg:grid-cols-2">
              {pieces.map((piece) => {
                const measurement = currentByPiece.get(piece.id);
                return (
                  <fieldset key={piece.id} className="rounded-md border border-border p-3">
                    <legend className="px-1 text-sm font-semibold text-charcoal">{piece.code}</legend>
                    <p className="mb-2 text-xs text-muted-foreground">{piece.environment ?? "Sem ambiente"}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Field label="Largura de fabricação (mm)">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          name={`manufacturing_width_mm_${piece.id}`}
                          className={inputClass}
                          defaultValue={measurement?.manufacturing_width_mm ?? ""}
                          required
                        />
                      </Field>
                      <Field label="Altura de fabricação (mm)">
                        <input
                          type="number"
                          min="1"
                          step="1"
                          name={`manufacturing_height_mm_${piece.id}`}
                          className={inputClass}
                          defaultValue={measurement?.manufacturing_height_mm ?? ""}
                          required
                        />
                      </Field>
                    </div>
                  </fieldset>
                );
              })}
            </div>
            <Field label="Motivo do registro ou da revisão">
              <textarea
                name="change_reason"
                className={textareaClass}
                minLength={5}
                required
                placeholder="Ex.: medidas efetivas informadas pelo CEM após conferência técnica."
              />
            </Field>
          </ActionForm>
        </details>
      ) : null}

      {revisions.length ? (
        <details className="rounded-md border border-border bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm font-semibold text-charcoal">
            <History className="size-4 text-accent" /> Histórico de revisões
          </summary>
          <div className="space-y-2 border-t border-border p-3">
            {revisions.map((revision) => {
              const revisionRows = measurements.filter((measurement) => measurement.prod_revision === revision);
              const reference = revisionRows[0];
              return (
                <div key={revision} className="min-w-0 rounded-md bg-muted/50 p-3 text-xs">
                  <p className="break-words font-semibold text-charcoal">
                    Revisão {revision} · {formatDateTime(reference.created_at)} · {profileName(profiles, reference.recorded_by_profile_id)}
                  </p>
                  <p className="mt-1 text-muted-foreground">Motivo: {reference.change_reason}</p>
                  <p className="mt-2 break-words text-charcoal">
                    {revisionRows.map((row) => {
                      const piece = pieces.find((item) => item.id === row.piece_id);
                      return `${piece?.code ?? "Peça"}: ${row.manufacturing_width_mm} x ${row.manufacturing_height_mm} mm`;
                    }).join(" · ")}
                  </p>
                </div>
              );
            })}
          </div>
        </details>
      ) : null}
    </section>
  );
}
