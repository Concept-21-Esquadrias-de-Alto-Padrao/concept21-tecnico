"use client";

import { LogOut, UserCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUserAccess, signOut } from "@/lib/auth-client";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { secureOrigin } from "@/lib/portal-session-policy";

export function CurrentUserMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const [name, setName] = useState("Usuário");

  useEffect(() => {
    if (pathname === "/auth/portal-logout") return;
    let active = true;
    getCurrentUserAccess().then((access) => {
      if (active && access?.profile?.name) setName(access.profile.name);
    });

    const { data: { subscription } } = createSupabaseBrowserClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        const portal = secureOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN);
        window.location.replace(portal ? portal + "/login?logged_out=1" : "/login");
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname]);

  async function handleSignOut() {
    const portal = secureOrigin(process.env.NEXT_PUBLIC_PORTAL_ORIGIN);
    if (portal) {
      window.location.replace(portal + "/auth/logout");
      return;
    }
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-white px-2 py-1.5 text-sm text-charcoal">
      <UserCircle className="size-5 text-muted-foreground" />
      <span className="hidden max-w-40 truncate font-medium sm:block">{name}</span>
      <button
        type="button"
        onClick={handleSignOut}
        className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-charcoal"
        title="Sair"
      >
        <LogOut className="size-4" />
      </button>
    </div>
  );
}
