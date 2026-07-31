"use client";

import { LogOut, UserCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getCurrentUserAccess, signOut } from "@/lib/auth-client";

export function CurrentUserMenu() {
  const router = useRouter();
  const [name, setName] = useState("Usuário");

  useEffect(() => {
    let active = true;
    getCurrentUserAccess().then((access) => {
      if (active && access?.profile?.name) setName(access.profile.name);
    });

    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
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
