"use client";

import { Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { createSupabaseCallbackBrowserClient, hasSupabaseBrowserEnv } from "@/lib/supabase/client";

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Confirmando autenticação...");

  useEffect(() => {
    async function confirm() {
      if (!hasSupabaseBrowserEnv()) {
        setMessage("Supabase não configurado.");
        return;
      }

      const supabase = createSupabaseCallbackBrowserClient();
      const code = searchParams.get("code");
      const next = searchParams.get("next") ?? "/tecnico";

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      router.replace(next);
      router.refresh();
    }

    void confirm();
  }, [router, searchParams]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="rounded-md border border-border bg-white p-5 text-sm text-muted-foreground shadow-sm">
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-accent" />
          {message}
        </div>
      </div>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={null}>
      <CallbackContent />
    </Suspense>
  );
}
