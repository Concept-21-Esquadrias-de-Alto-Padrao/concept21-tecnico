"use client";

import { AlertTriangle, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getCurrentUserAccess,
  requestCurrentUserAccessReview,
  signOut,
  type CurrentUserAccess,
} from "@/lib/auth-client";
import { toUserFriendlyErrorMessage } from "@/lib/errors";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";

type AuthGateState =
  | { status: "loading" }
  | { status: "empty-env" }
  | { status: "ready"; access: CurrentUserAccess }
  | { status: "pending-access"; email?: string | null; requestId: string | null }
  | { status: "unverified-email"; email?: string | null }
  | { status: "inactive-profile"; email?: string | null }
  | { status: "missing-profile"; email?: string | null }
  | { status: "error"; message: string };

function AccessMessage({
  tone = "orange",
  title,
  children,
}: {
  tone?: "orange" | "red";
  title: string;
  children: React.ReactNode;
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 bg-red-50 text-red-800"
      : "border-orange-200 bg-orange-50 text-orange-900";

  return (
    <div className={`rounded-md border p-5 text-sm ${toneClass}`}>
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 size-5 flex-none" />
        <div className="min-w-0">
          <p className="font-semibold">{title}</p>
          <div className="mt-2 leading-6">{children}</div>
        </div>
      </div>
    </div>
  );
}

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

        if (!access?.emailConfirmed) {
          await signOut();
          if (!active) return;
          setState({
            status: "unverified-email",
            email: session.data.session.user.email,
          });
          return;
        }

        if (!access.profile) {
          setState({
            status: "missing-profile",
            email: session.data.session.user.email,
          });
          return;
        }

        if (access.profile.status !== "active") {
          await signOut();
          if (!active) return;
          setState({
            status: "inactive-profile",
            email: access.profile.email ?? access.email,
          });
          return;
        }

        if (access.roles.length === 0) {
          let requestId: string | null = null;

          try {
            requestId = await requestCurrentUserAccessReview();
          } catch (requestError) {
            console.warn("Nao foi possivel registrar a revisao de acesso.", requestError);
          }

          if (!active) return;
          setState({
            status: "pending-access",
            email: access.profile.email ?? access.email,
            requestId,
          });
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
      <AccessMessage tone="red" title="Não foi possível validar o acesso.">
        {state.message}
      </AccessMessage>
    );
  }

  if (state.status === "unverified-email") {
    return (
      <AccessMessage title="Confirme seu e-mail para acessar.">
        <p>
          Sua sessão foi encerrada porque o e-mail ainda não foi confirmado. Use o link enviado para {state.email ?? "seu e-mail"} e tente novamente.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
        >
          <LogIn className="size-4" />
          Voltar ao login
        </Link>
      </AccessMessage>
    );
  }

  if (state.status === "inactive-profile") {
    return (
      <AccessMessage tone="red" title="Cadastro sem acesso ativo.">
        <p>
          Este cadastro foi inativado ou recusado pelo Administrador. Entre com outro usuário ou solicite revisão internamente.
        </p>
        <Link
          href="/login"
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
        >
          <LogIn className="size-4" />
          Entrar com outro usuário
        </Link>
      </AccessMessage>
    );
  }

  if (state.status === "missing-profile") {
    return (
      <AccessMessage title="Cadastro autenticado, aguardando vínculo no sistema.">
        <p>
          Seu login foi confirmado, mas ainda não existe um perfil interno vinculado ao cadastro. Peça ao Administrador para revisar o acesso em Configurações.
        </p>
        <p className="mt-2 font-mono text-xs text-orange-800">E-mail: {state.email ?? "-"}</p>
        <button
          type="button"
          onClick={exitToLogin}
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
        >
          <LogIn className="size-4" />
          Entrar com outro usuário
        </button>
      </AccessMessage>
    );
  }

  return (
    <AccessMessage title="Cadastro confirmado, aguardando liberação de acesso.">
      <p>
        O usuário {state.email ?? "atual"} está autenticado, mas ainda não possui perfil de acesso. Peça ao Administrador para liberar o cadastro em Configurações.
      </p>
      {state.requestId ? (
        <p className="mt-2 font-mono text-xs text-orange-800">Solicitação: {state.requestId}</p>
      ) : (
        <p className="mt-2 text-xs text-orange-800">
          A solicitação automática não pôde ser registrada agora. Informe seu e-mail de cadastro ao Administrador.
        </p>
      )}
      <button
        type="button"
        onClick={exitToLogin}
        className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500"
      >
        <LogIn className="size-4" />
        Entrar com outro usuário
      </button>
    </AccessMessage>
  );
}
