import Link from "next/link";
import { cn } from "@/lib/utils";

export type TabItem = {
  id: string;
  label: string;
  href: string;
};

export function Tabs({ items, activeId }: { items: TabItem[]; activeId: string }) {
  return (
    <div className="overflow-x-auto border-b border-border">
      <nav className="flex min-w-max gap-1 px-4">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className={cn(
              "border-b-2 px-3 py-3 text-sm font-semibold text-muted-foreground transition",
              activeId === item.id
                ? "border-accent text-charcoal"
                : "border-transparent hover:text-charcoal",
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
