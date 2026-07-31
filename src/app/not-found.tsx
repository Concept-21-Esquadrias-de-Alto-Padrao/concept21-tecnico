import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-md border border-border bg-white p-6 text-sm text-muted-foreground shadow-sm">
      <h1 className="text-lg font-semibold text-charcoal">Página não encontrada</h1>
      <p className="mt-2">A rota solicitada não existe no módulo Técnico.</p>
      <Link
        href="/tecnico"
        className="mt-4 inline-flex rounded-md bg-accent px-4 py-2 font-semibold text-accent-foreground hover:bg-orange-500"
      >
        Voltar ao painel
      </Link>
    </div>
  );
}
