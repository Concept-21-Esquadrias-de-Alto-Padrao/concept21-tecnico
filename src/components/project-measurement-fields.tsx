"use client";

import { useState } from "react";
import { inputClass } from "@/components/action-form";

export function ProjectMeasurementFields({
  nameSuffix = "",
  projectOnly,
  width,
  height,
  placeholders,
}: {
  nameSuffix?: string;
  projectOnly: boolean;
  width: number | null;
  height: number | null;
  placeholders?: { width: string; height: string };
}) {
  const [isProject, setIsProject] = useState(projectOnly);
  const [measuredWidth, setMeasuredWidth] = useState(width === null ? "" : String(width));
  const [measuredHeight, setMeasuredHeight] = useState(height === null ? "" : String(height));

  return (
    <div className="space-y-2 md:col-span-2">
      <label className="flex w-fit cursor-pointer items-center gap-2 text-sm font-medium text-charcoal">
        <input
          name={`project_only${nameSuffix}`}
          type="checkbox"
          checked={isProject}
          className="size-4 accent-orange-600"
          onChange={(event) => {
            if (event.target.checked && (measuredWidth || measuredHeight)) {
              if (!window.confirm("Marcar como Projeto apagará as medidas registradas desta peça. Deseja continuar?")) return;
            }
            setIsProject(event.target.checked);
            if (event.target.checked) {
              setMeasuredWidth("");
              setMeasuredHeight("");
            }
          }}
        />
        Projeto
      </label>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Largura medida</span>
          <input
            name={`measured_width_mm${nameSuffix}`}
            type="number"
            min="0.01"
            step="any"
            className={inputClass}
            value={measuredWidth}
            onChange={(event) => setMeasuredWidth(event.target.value)}
            placeholder={isProject ? "Projeto" : placeholders?.width ?? "Largura"}
            disabled={isProject}
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-xs font-semibold text-muted-foreground">Altura medida</span>
          <input
            name={`measured_height_mm${nameSuffix}`}
            type="number"
            min="0.01"
            step="any"
            className={inputClass}
            value={measuredHeight}
            onChange={(event) => setMeasuredHeight(event.target.value)}
            placeholder={isProject ? "Projeto" : placeholders?.height ?? "Altura"}
            disabled={isProject}
          />
        </label>
      </div>
    </div>
  );
}
