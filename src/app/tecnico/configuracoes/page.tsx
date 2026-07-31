import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { SecurityAccessPanel } from "@/components/security-access-panel";
import { TechnicalSettingsPanel } from "@/components/technical-settings-panel";
import {
  appNavigationPermissionKeys,
  canAccessModule,
  firstAllowedAppRoute,
  MODULE_ACCESS,
} from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export default async function TechnicalSettingsPage() {
  const access = await getCurrentPermissionFlags(appNavigationPermissionKeys);
  if (!canAccessModule(access, MODULE_ACCESS.settings)) {
    redirect(firstAllowedAppRoute(access) ?? "/login");
  }

  const supabaseConfigured = hasSupabaseEnv();
  const canManageSettings = access.isMaster || access.permissions["technical.settings.manage"];

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
          {canManageSettings && supabaseConfigured ? (
            <TechnicalSettingsPanel />
          ) : (
            <p className="text-sm text-muted-foreground">
              {supabaseConfigured
                ? "Seu perfil pode acessar configurações de segurança, mas não possui permissão para alterar cadastros e parâmetros técnicos."
                : "Configure o Supabase para habilitar cadastros e parâmetros reais."}
            </p>
          )}
        </PanelBody>
      </Panel>
    </div>
  );
}
