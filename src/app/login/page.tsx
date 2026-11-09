"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { signInWithEmail } from "@/lib/auth-client";
import { toUserFriendlyErrorMessage } from "@/lib/errors";
import { createSupabaseBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";
import { getPublicAppOrigin } from "@/lib/supabase/config";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmed = searchParams.get("confirmed") === "1";
  const corporateEnabled = process.env.NEXT_PUBLIC_CENTRAL_LOGIN_ENABLED === "true";
  const corporateError = searchParams.get("auth_error") === "corporate";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!hasSupabaseBrowserEnv()) {
      setMessage("Configure o Supabase para autenticar usuários.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmail(email, password);
    } catch (error) {
      setLoading(false);
      setMessage(toUserFriendlyErrorMessage(error, "Não foi possível entrar."));
      return;
    }

    setLoading(false);
    router.replace("/tecnico");
    router.refresh();
  }

  async function signInWithCorporateIdentity() {
    setLoading(true);
    setMessage("");
    try {
      const redirectTo = new URL("/auth/complete?next=%2Ftecnico", getPublicAppOrigin());
      const { error } = await createSupabaseBrowserClient().auth.signInWithOAuth({
        provider: "custom:concept21",
        options: { redirectTo: redirectTo.toString(), scopes: "openid email profile" },
      });
      if (error) throw error;
    } catch (error) {
      setLoading(false);
      setMessage(toUserFriendlyErrorMessage(error, "Não foi possível iniciar o acesso Concept21."));
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-border bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-md bg-charcoal text-sm font-black text-white">
            C21
          </span>
          <div>
            <p className="text-xs font-semibold uppercase text-accent">Concept21 Aluminium</p>
            <h1 className="text-xl font-bold text-charcoal">Módulo Técnico</h1>
          </div>
        </div>

        {confirmed ? (
          <p className="mb-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">
            E-mail confirmado. Entre com suas credenciais.
          </p>
        ) : null}

        {corporateError && !message ? <p className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">Não foi possível validar seu vínculo corporativo. Solicite revisão do acesso.</p> : null}
        {corporateEnabled ? (
          <button type="button" onClick={signInWithCorporateIdentity} disabled={loading}
            className="mb-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-charcoal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Entrar com Concept21
          </button>
        ) : null}
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">E-mail</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="min-h-11 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
              required
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-charcoal">Senha</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="min-h-11 w-full rounded-md border border-border px-3 text-sm outline-none focus:border-accent"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-orange-500 disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
            Entrar
          </button>
          {message ? <p className="text-sm font-medium text-danger">{message}</p> : null}
        </form>

        <div className="mt-5 border-t border-border pt-4 text-center text-sm text-muted-foreground">
          Ainda não tem cadastro?{" "}
          <Link href="/cadastro" className="font-semibold text-accent hover:text-orange-600">
            Criar acesso
          </Link>
        </div>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
