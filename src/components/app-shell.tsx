"use client";

import {
  BarChart3,
  MoreHorizontal,
  Menu,
  CalendarDays,
  CheckSquare,
  ClipboardList,
  Factory,
  HelpCircle,
  Home,
  Settings,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useState } from "react";
import { AuthGate } from "@/components/auth-gate";
import { CurrentUserMenu } from "@/components/current-user-menu";
import { NotificationsBell } from "@/components/notifications-bell";
import { MyActivitiesCount, MyActivitiesProvider } from "@/components/my-activities-provider";
import {
  getCurrentUserAccess,
  isCurrentUserMaster,
  type CurrentUserAccess,
} from "@/lib/auth-client";
import { hasAnyPermission, MODULE_ACCESS } from "@/lib/module-access";
import { hasSupabaseBrowserEnv } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/tecnico", label: "Painel", icon: Home, permissions: MODULE_ACCESS.dashboard },
  { href: "/tecnico/minhas-atividades", label: "Meu trabalho", icon: UserRoundCheck, permissions: MODULE_ACCESS.myActivities },
  { href: "/tecnico/contratos", label: "Obras", icon: ClipboardList, permissions: MODULE_ACCESS.contracts },
  { href: "/tecnico/agenda", label: "Agenda", icon: CalendarDays, permissions: MODULE_ACCESS.agenda },
  { href: "/tecnico/acoes", label: "Ações", icon: CheckSquare, permissions: MODULE_ACCESS.actions },
  { href: "/tecnico/prods", label: "PRODs", icon: Factory, permissions: MODULE_ACCESS.prods },
  { href: "/tecnico/duvidas", label: "Base de Dúvidas", icon: HelpCircle, permissions: MODULE_ACCESS.doubts },
  { href: "/tecnico/relatorios", label: "Indicadores", icon: BarChart3, permissions: MODULE_ACCESS.reports },
  { href: "/tecnico/configuracoes", label: "Configurações", icon: Settings, permissions: MODULE_ACCESS.settings },
];

const publicRoutes = new Set(["/login", "/cadastro"]);
type AccessState = "loading" | "empty-env" | CurrentUserAccess | null;

function canShowNavItem(access: AccessState, permissions: readonly string[]) {
  if (access === "empty-env") return true;
  if (!access || access === "loading") return false;
  if (isCurrentUserMaster(access)) return true;
  return hasAnyPermission(access.permissions, permissions);
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [access, setAccess] = useState<AccessState>(() =>
    hasSupabaseBrowserEnv() ? "loading" : "empty-env",
  );

  useEffect(() => {
    if (publicRoutes.has(pathname)) return;

    let active = true;

    if (!hasSupabaseBrowserEnv()) return;

    getCurrentUserAccess()
      .then((currentAccess) => {
        if (active) setAccess(currentAccess);
      })
      .catch(() => {
        if (active) setAccess(null);
      });

    return () => {
      active = false;
    };
  }, [pathname]);

  if (publicRoutes.has(pathname)) return <>{children}</>;

  const visibleNavItems = navItems.filter((item) => canShowNavItem(access, item.permissions));
  const currentProfile = access && typeof access === "object" ? access.profile : null;

  const primaryPaths = ["/tecnico", "/tecnico/minhas-atividades", "/tecnico/contratos", "/tecnico/agenda", "/tecnico/prods"];
  const primaryItems = primaryPaths.flatMap(href => visibleNavItems.filter(item => item.href === href));
  const secondaryItems = visibleNavItems.filter(item => !primaryPaths.includes(item.href));
  const isActive = (href: string) => href === "/tecnico" ? pathname === href : pathname.startsWith(href);
  const navLink = (item: typeof navItems[number]) => {
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
      onClick={event => { setMobileOpen(false); const more = event.currentTarget.closest("details"); if (more) more.open = false; }}
      className={cn("inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-accent", isActive(item.href) ? "bg-orange-50 text-orange-800 ring-1 ring-orange-100" : "text-muted-foreground hover:bg-muted/60 hover:text-charcoal")}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />{item.label}
      {item.href === "/tecnico/minhas-atividades" && <MyActivitiesCount />}
    </Link>;
  };
  return (
    <MyActivitiesProvider key={currentProfile?.id ?? "anonymous"} enabled={Boolean(currentProfile?.status === "active" && canShowNavItem(access, MODULE_ACCESS.myActivities))}>
      <div className="min-h-screen bg-[#f5f6f8] text-foreground">
        <header className="sticky top-0 z-30 border-b border-border/70 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:px-6 lg:px-8">
            <Link href="/tecnico" className="flex min-h-11 shrink-0 items-center gap-3" aria-label="Concept21 · Painel Técnico">
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-sm font-black text-charcoal">C21</span>
              <span className="text-sm font-semibold leading-tight">Concept21<span className="block text-xs font-normal text-muted-foreground">Técnico</span></span>
            </Link>
            <div className="ml-auto flex items-center gap-2 lg:order-3 lg:ml-0">
              <NotificationsBell /><CurrentUserMenu />
              <button type="button" onClick={() => setMobileOpen(!mobileOpen)} aria-expanded={mobileOpen} aria-controls="technical-main-navigation" aria-label="Menu principal" className="grid size-11 place-items-center rounded-lg border border-border md:hidden"><Menu className="size-5" /></button>
            </div>
            <nav id="technical-main-navigation" aria-label="Navegação principal" className={cn("order-last w-full flex-wrap items-center gap-1 md:flex lg:order-2 lg:w-auto", mobileOpen ? "flex" : "hidden")}>
              {primaryItems.map(navLink)}
              {secondaryItems.length > 0 && <details className="relative">
                <summary className={cn("flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-3 text-sm font-medium [&::-webkit-details-marker]:hidden", secondaryItems.some(item => isActive(item.href)) ? "bg-orange-50 text-orange-800" : "text-muted-foreground hover:bg-muted/60")}><MoreHorizontal className="size-4" />Mais</summary>
                <nav aria-label="Outras opções" className="absolute right-0 top-full z-40 mt-2 grid min-w-52 rounded-xl border border-border bg-white p-2 shadow-lg">{secondaryItems.map(navLink)}</nav>
              </details>}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><AuthGate>{children}</AuthGate></main>
      </div>
    </MyActivitiesProvider>
  );
}
