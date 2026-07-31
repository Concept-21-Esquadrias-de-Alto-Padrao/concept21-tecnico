"use client";

import { FileDown } from "lucide-react";
import type { TechnicalPiece, TechnicalVisit } from "@/lib/types";
import { formatDate, formatDateTime } from "@/lib/utils";

export function VisitReportPdfButton({
  visit,
  pieces,
}: {
  visit: TechnicalVisit;
  pieces: TechnicalPiece[];
}) {
  async function downloadPdf() {
    const [{ default: JsPDF }, autoTableModule] = await Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
    ]);
    const autoTable = autoTableModule.default;
    const doc = new JsPDF();

    doc.setFontSize(14);
    doc.text("Concept21 Aluminium - Relatório de Visita Técnica", 14, 18);
    doc.setFontSize(10);
    doc.text(`Data agendada: ${formatDate(visit.scheduled_date)}`, 14, 28);
    doc.text(`Realizada em: ${formatDateTime(visit.performed_at)}`, 14, 34);
    doc.text(`Tipo: ${visit.visit_type}`, 14, 40);
    doc.text(`Técnicos: ${visit.technicians.join(", ") || "-"}`, 14, 46);

    autoTable(doc, {
      startY: 56,
      head: [["Código", "Ambiente", "Medida", "Status"]],
      body: pieces.map((piece) => [
        piece.code,
        piece.environment ?? "-",
        `${piece.measured_width_mm ?? "-"} x ${piece.measured_height_mm ?? "-"}`,
        piece.status,
      ]),
    });

    const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 70;
    doc.text("Resumo", 14, finalY + 12);
    doc.text(doc.splitTextToSize(visit.result_summary ?? "Sem resumo registrado.", 180), 14, finalY + 18);
    doc.save(`relatorio-visita-${visit.scheduled_date}.pdf`);
  }

  return (
    <button
      type="button"
      onClick={downloadPdf}
      className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm font-semibold text-charcoal hover:bg-muted"
    >
      <FileDown className="size-4" />
      Baixar PDF
    </button>
  );
}
