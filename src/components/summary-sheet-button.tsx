"use client";

import { Download } from "lucide-react";
import type { TechnicalContractOverview } from "@/lib/types";
import { calculateReleaseProgress } from "@/lib/technical-rules";

function csvCell(value: unknown) {
  const text = String(value ?? "").replace(/"/g, '""');
  return `"${text}"`;
}

export function SummarySheetButton({
  overviews,
}: {
  overviews: TechnicalContractOverview[];
}) {
  function downloadCsv() {
    const rows = [
      [
        "Contrato",
        "Cliente",
        "Obra",
        "Situação técnica",
        "Total de peças",
        "Peças liberadas",
        "Saldo",
        "Correções abertas",
        "PRODs pendentes",
      ],
      ...overviews.map((overview) => {
        const progress = calculateReleaseProgress(overview.pieces);
        return [
          overview.contract.contract_number,
          overview.client?.name ?? "",
          overview.contract.work_name,
          overview.technical?.technical_status ?? "aguardando_pasta",
          progress.total,
          progress.released,
          progress.balance,
          overview.corrections.filter((correction) => !["encerrada", "cancelada"].includes(correction.status)).length,
          overview.prodBatches.filter((prod) => !["concluido", "cancelado"].includes(prod.status)).length,
        ];
      }),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "planilha-resumo-tecnico.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={downloadCsv}
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
    >
      <Download className="size-4" />
      Gerar planilha-resumo
    </button>
  );
}
