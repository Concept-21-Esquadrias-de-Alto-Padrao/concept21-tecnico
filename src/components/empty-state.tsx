import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-md border border-dashed border-border bg-white p-6 text-center">
      <span className="mx-auto grid size-11 place-items-center rounded-md bg-muted text-muted-foreground">
        <Icon className="size-5" />
      </span>
      <h2 className="mt-3 text-base font-semibold text-charcoal">{title}</h2>
      {description ? (
        <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
