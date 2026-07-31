import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { SecurityAccessPanel } from "@/components/security-access-panel";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { hasSupabaseEnv } from "@/lib/supabase/server";

const settings = [
  "Tipos de visita",
  "Tipos de ação",
  "Tipos de correção",
  "Impactos",
  "Motivos de cancelamento",
  "Prioridades",
  "Categorias de dúvidas",
  "Tipos de materiais",
  "Prazos internos",
  "Percentuais de risco",
  "Feriados",
  "Parâmetros de relatórios",
  "Parâmetros de notificação",
];

export default async function TechnicalSettingsPage() {
  const access = await getCurrentPermissionFlags(appNavigationPermissionKeys);
  if (!canAccessModule(access, MODULE_ACCESS.settings)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const supabaseConfigured = hasSupabaseEnv();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Configurações Técnicas"
        description="Parâmetros restritos a Gestor Técnico e Administrador. Alterações são auditadas no banco."
      />

      {access.isMaster && supabaseConfigured ? (
        <SecurityAccessPanel />
      ) : (
        <Panel>
          <PanelHeader
            title="Segurança e acessos"
            description={
              supabaseConfigured
                ? "Somente o Administrador pode liberar cadastros e vincular níveis de acesso."
                : "Configure o Supabase para habilitar cadastros reais de usuários."
            }
          />
          <PanelBody>
            <p className="text-sm text-muted-foreground">
              Usuários novos aparecem aqui depois de confirmar o e-mail e solicitar acesso ao módulo Técnico.
            </p>
          </PanelBody>
        </Panel>
      )}

      <Panel>
        <PanelHeader title="Cadastros e parâmetros" />
        <PanelBody>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {settings.map((setting) => (
              <div key={setting} className="rounded-md border border-border bg-white p-3">
                <div className="flex items-center gap-2">
                  <Settings className="size-4 text-accent" />
                  <p className="font-semibold text-charcoal">{setting}</p>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">
                  Parâmetro auditado e restrito aos perfis autorizados do módulo Técnico.
                </p>
              </div>
            ))}
          </div>
        </PanelBody>
      </Panel>
    </div>
  );
}
