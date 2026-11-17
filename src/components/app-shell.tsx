"use client";

import {
  BarChart3,
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
import Image from "next/image";
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
  { href: "/tecnico/contratos", label: "Contratos", icon: ClipboardList, permissions: MODULE_ACCESS.contracts },
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
  const [access, setAccess] = useState<AccessState>(() =>
    hasSupabaseBrowserEnv() ? "loading" : "empty-env",
  );

  useEffect(() => {
    if ((publicRoutes.has(pathname)||pathname.startsWith("/auth/"))) return;

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

  if ((publicRoutes.has(pathname)||pathname.startsWith("/auth/"))) return <>{children}</>;

  const visibleNavItems = navItems.filter((item) => canShowNavItem(access, item.permissions));
  const currentProfile = access && typeof access === "object" ? access.profile : null;

  const isActive = (href: string) => href === "/tecnico" ? pathname === href : pathname.startsWith(href);
  const navLink = (item: typeof navItems[number]) => {
    const Icon = item.icon;
    return <Link key={item.href} href={item.href} aria-current={isActive(item.href) ? "page" : undefined}
      className={cn("inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-[#304b65] focus-visible:outline-offset-2", isActive(item.href) ? "bg-[#e6eef5] text-[#304b65] ring-1 ring-[#cbd8e3]" : "text-muted-foreground hover:bg-muted/60 hover:text-charcoal")}>
      <Icon className="size-4 shrink-0" aria-hidden="true" />{item.label}
      {item.href === "/tecnico/minhas-atividades" && <MyActivitiesCount />}
    </Link>;
  };
  return (
    <MyActivitiesProvider key={currentProfile?.id ?? "anonymous"} enabled={Boolean(currentProfile?.status === "active" && canShowNavItem(access, MODULE_ACCESS.myActivities))}>
      <div className="min-h-screen bg-[#f5f6f8] text-foreground">
        <header className="relative z-30 border-b border-[#ced7de] bg-white/95 backdrop-blur md:sticky md:top-0">
          <div className="mx-auto max-w-[1440px] px-4 pb-3 pt-3 sm:px-6 lg:px-8">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 pb-3">
            <Link href="/tecnico" className="flex min-h-11 shrink-0 items-center gap-3" aria-label="Concept21 · Painel Técnico">
              <span className="flex items-center gap-3">
                <Image src="/brand/concept21-aluminium.png" alt="Concept21 Aluminium" width={660} height={104} priority className="h-auto w-[148px] sm:w-[176px]" />
                <span className="rounded-md border border-[#cbd8e3] bg-[#e6eef5] px-2.5 py-2 text-[11px] font-bold tracking-[0.12em] text-[#304b65] sm:text-xs">TÉCNICO</span>
              </span>
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <NotificationsBell /><CurrentUserMenu />
            </div>
            </div>
            <nav id="technical-main-navigation" aria-label="Navegação principal" className="flex w-full flex-wrap items-center gap-1 border-t border-[#edf1f4] pt-2">
              {visibleNavItems.map(navLink)}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><AuthGate>{children}</AuthGate></main>
      </div>
    </MyActivitiesProvider>
  );
}
