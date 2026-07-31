"use client";

import { AlertTriangle, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCurrentUserAccess,
  signOut,
  type CurrentUserAccess,
} from "@/lib/auth-client";
import { toUserFriendlyErrorMessage } from "@/lib/errors";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";

type AuthGateState =
  | { status: "loading" }
  | { status: "empty-env" }
  | { status: "ready"; access: CurrentUserAccess }
  | { status: "pending-access"; email?: string | null }
  | { status: "error"; message: string };

export function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthGateState>({ status: "loading" });

  useEffect(() => {
    let active = true;

    async function loadAuthState() {
      try {
        if (!hasSupabaseBrowserEnv()) {
          setState({ status: "empty-env" });
          return;
        }

        const supabase = createSupabaseBrowserClient();
        const session = await supabase.auth.getSession();

        if (!session.data.session) {
          router.replace("/login");
          return;
        }

        const access = await getCurrentUserAccess();
        if (!active) return;

        if (!access?.profile || access.profile.status !== "active" || access.roles.length === 0) {
          setState({ status: "pending-access", email: session.data.session.user.email });
          return;
        }

        setState({ status: "ready", access });
      } catch (error) {
        if (!active) return;
        setState({
          status: "error",
          message: toUserFriendlyErrorMessage(error, "Não foi possível validar a sessão."),
        });
      }
    }

    void loadAuthState();

    return () => {
      active = false;
    };
  }, [router]);

  async function exitToLogin() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  if (state.status === "ready" || state.status === "empty-env") return <>{children}</>;

  if (state.status === "loading") {
    return (
      <div className="rounded-md border border-border bg-white p-5 text-sm text-muted-foreground shadow-sm">
        Validando sessão...
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-5 text-sm text-red-800">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 size-5 flex-none" />
          <div>
            <p className="font-semibold">Não foi possível validar o acesso.</p>
            <p className="mt-1">{state.message}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-orange-200 bg-orange-50 p-5 text-sm text-orange-900">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 flex-none" />
        <div>
          <p className="font-semibold">Cadastro aguardando liberação.</p>
          <p className="mt-2 leading-6">
            O usuário {state.email ?? "atual"} está autenticado, mas ainda não possui perfil e
            permissões ativas para o módulo Técnico.
          </p>
          <button
            type="button"
            onClick={exitToLogin}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
          >
            <LogIn className="size-4" />
            Entrar com outro usuário
          </button>
          <Link href="/login" className="sr-only">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
