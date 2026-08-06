import {
  AlertTriangle,
  KeyRound,
  LockKeyhole,
  Power,
  RotateCcw,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  UserRound,
  UserX,
} from "lucide-react";
import {
  assignTechnicalUserRoleFormAction,
  createTechnicalRoleAction,
  deleteTechnicalRoleFormAction,
  rejectTechnicalAccessRequestFormAction,
  removeTechnicalUserRoleFormAction,
  saveTechnicalRolePermissionsAction,
  setTechnicalProfileStatusFormAction,
  toggleTechnicalRoleStatusFormAction,
  updateTechnicalRoleAction,
} from "@/app/actions";
import { ActionForm, Field, inputClass, textareaClass } from "@/components/action-form";
import { EmptyState } from "@/components/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { getTechnicalSecurityData, type TechnicalSecurityUser } from "@/lib/technical-security";
import type { Permission, Role } from "@/lib/types";
import { cn } from "@/lib/utils";

type UserRoleWithRole = TechnicalSecurityUser["user_roles"][number] & {
  role: NonNullable<TechnicalSecurityUser["user_roles"][number]["role"]>;
};

const permissionGroupLabels: Record<string, string> = {
  actions: "Ações",
  audit: "Auditoria",
  contracts: "Contratos",
  corrections: "Correções",
  dashboard: "Painel",
  deliveries: "Entregas",
  doubts: "Base de dúvidas",
  financial: "Comercial e financeiro",
  folder: "Entrada comercial",
  followup: "Acompanhamento",
  measurements: "Medições",
  meetings: "Reunião e ata",
  permissions: "Segurança e acessos",
  pieces: "Peças",
  prods: "PRODs",
  reports: "Indicadores e relatórios",
  settings: "Configurações",
  visits: "Agenda e visitas",
};

function activeUserRoles(user: TechnicalSecurityUser): UserRoleWithRole[] {
  return user.user_roles.filter(
    (userRole): userRole is UserRoleWithRole =>
      userRole.active !== false && Boolean(userRole.role),
  );
}

function isPendingAccess(user: TechnicalSecurityUser) {
  return user.status === "active" && Boolean(user.user_id) && activeUserRoles(user).length === 0;
}

function roleName(name?: string | null) {
  return name || "Perfil";
}

function permissionGroup(permissionKey: string) {
  const [, group = "geral"] = permissionKey.split(".");
  return permissionGroupLabels[group] ?? group.replaceAll("_", " ");
}

function groupPermissions(permissions: Permission[]) {
  return permissions.reduce<Record<string, Permission[]>>((groups, permission) => {
    const group = permissionGroup(permission.key);
    groups[group] = [...(groups[group] ?? []), permission];
    return groups;
  }, {});
}

function rolePermissionIds(roleId: string, rolePermissions: Array<{ role_id: string; permission_id: string }>) {
  return new Set(
    rolePermissions
      .filter((rolePermission) => rolePermission.role_id === roleId)
      .map((rolePermission) => rolePermission.permission_id),
  );
}

function StatusPill({ pending, status }: { pending: boolean; status: "active" | "inactive" }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1",
        pending
          ? "bg-orange-50 text-orange-800 ring-orange-200"
          : status === "active"
            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
            : "bg-muted text-muted-foreground ring-border",
      )}
    >
      {pending ? "Pendente" : status === "active" ? "Ativo" : "Inativo"}
    </span>
  );
}

function RoleStatusPill({ role }: { role: Role }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1",
        role.active
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
          : "bg-muted text-muted-foreground ring-border",
      )}
    >
      {role.active ? "Ativo" : "Inativo"}
    </span>
  );
}

function UserRoleChips({ userRoles }: { userRoles: UserRoleWithRole[] }) {
  if (!userRoles.length) {
    return <p className="text-xs text-muted-foreground">Nenhum nível vinculado.</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {userRoles.map((userRole) => (
        <form key={userRole.id} action={removeTechnicalUserRoleFormAction}>
          <input type="hidden" name="user_role_id" value={userRole.id} />
          <button
            type="submit"
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-white px-2.5 text-xs font-medium text-muted-foreground hover:border-red-200 hover:text-red-700"
            title="Remover nível de acesso"
          >
            {roleName(userRole.role.name)}
            <Trash2 className="size-3" />
          </button>
        </form>
      ))}
    </div>
  );
}

function AssignRoleForm({
  roles,
  user,
  compact = false,
}: {
  roles: Role[];
  user: TechnicalSecurityUser;
  compact?: boolean;
}) {
  return (
    <form action={assignTechnicalUserRoleFormAction} className={compact ? "flex gap-2" : "grid gap-2"}>
      <input type="hidden" name="profile_id" value={user.id} />
      <select
        name="role_id"
        className={cn(
          "min-h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-accent",
          !compact && "min-h-11",
        )}
        defaultValue=""
        disabled={user.status !== "active"}
        required
      >
        <option value="">{compact ? "Selecionar nível" : "Selecionar nível de acesso"}</option>
        {roles
          .filter((role) => role.active)
          .map((role) => (
            <option key={role.id} value={role.id}>
              {roleName(role.name)}
            </option>
          ))}
      </select>
      <button
        type="submit"
        disabled={user.status !== "active"}
        className={cn(
          "inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground hover:bg-orange-500 disabled:opacity-60",
          !compact && "min-h-11",
        )}
      >
        {compact ? "Liberar" : "Liberar acesso"}
      </button>
    </form>
  );
}

function UserActions({
  currentProfileId,
  pending,
  user,
}: {
  currentProfileId: string;
  pending: boolean;
  user: TechnicalSecurityUser;
}) {
  return (
    <div className="flex gap-2">
      <form action={setTechnicalProfileStatusFormAction} className="flex-1">
        <input type="hidden" name="profile_id" value={user.id} />
        <input type="hidden" name="status" value={user.status === "active" ? "inactive" : "active"} />
        <button
          type="submit"
          disabled={user.id === currentProfileId && user.status === "active"}
          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:border-orange-200 hover:text-accent disabled:opacity-50"
          title={user.status === "active" ? "Inativar usuário" : "Reativar usuário"}
        >
          {user.status === "active" ? <Power className="size-4" /> : <RotateCcw className="size-4" />}
          <span className="sm:hidden">{user.status === "active" ? "Inativar" : "Reativar"}</span>
        </button>
      </form>

      {user.id !== currentProfileId ? (
        <form action={rejectTechnicalAccessRequestFormAction} className="flex-1">
          <input type="hidden" name="profile_id" value={user.id} />
          <button
            type="submit"
            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"
            title={pending ? "Recusar e excluir cadastro" : "Excluir cadastro"}
          >
            <UserX className="size-4" />
            <span className="sm:hidden">Excluir</span>
          </button>
        </form>
      ) : null}
    </div>
  );
}

function UsersSection({
  currentProfileId,
  roles,
  users,
}: {
  currentProfileId: string;
  roles: Role[];
  users: TechnicalSecurityUser[];
}) {
  if (!users.length) {
    return (
      <EmptyState
        icon={UserRound}
        title="Nenhum usuário cadastrado"
        description="Os usuários aparecerão aqui depois da solicitação de cadastro e confirmação do e-mail."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-charcoal">Usuários</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Libere cadastros confirmados, vincule níveis de acesso e inative usuários quando necessário.
        </p>
      </div>

      <div className="space-y-3 lg:hidden">
        {users.map((user) => {
          const pending = isPendingAccess(user);
          const userRoles = activeUserRoles(user);

          return (
            <article key={user.id} className="rounded-md border border-border bg-white p-3 text-sm">
              <div className="flex items-start gap-3">
                <div className="grid size-10 flex-none place-items-center rounded-full bg-muted text-muted-foreground">
                  <UserRound className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-charcoal">{user.name}</p>
                    {pending ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                        <AlertTriangle className="size-3" />
                        Pendente
                      </span>
                    ) : null}
                    {user.is_master ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                        <ShieldCheck className="size-3" />
                        Master
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 break-words text-xs text-muted-foreground">{user.email}</p>
                  {user.title ? <p className="text-xs text-muted-foreground">{user.title}</p> : null}
                  {user.access_review_requests[0]?.requested_at ? (
                    <p className="mt-1 text-[11px] text-orange-800">
                      Solicitado em {new Date(user.access_review_requests[0].requested_at).toLocaleString("pt-BR")}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3">
                <StatusPill pending={pending} status={user.status} />
              </div>

              <div className="mt-3 space-y-2">
                <p className="text-xs font-semibold text-muted-foreground">Níveis vinculados</p>
                <UserRoleChips userRoles={userRoles} />
              </div>

              <div className="mt-3">
                <AssignRoleForm roles={roles} user={user} />
              </div>

              <div className="mt-3">
                <UserActions currentProfileId={currentProfileId} pending={pending} user={user} />
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-md border border-border lg:block">
        <table className="w-full min-w-[940px] border-separate border-spacing-0 bg-white text-left text-sm">
          <thead className="text-xs uppercase text-muted-foreground">
            <tr>
              <th className="border-b border-border px-3 py-2 font-semibold">Usuário</th>
              <th className="border-b border-border px-3 py-2 font-semibold">Níveis vinculados</th>
              <th className="border-b border-border px-3 py-2 font-semibold">Status</th>
              <th className="border-b border-border px-3 py-2 font-semibold">Liberar acesso</th>
              <th className="border-b border-border px-3 py-2 font-semibold">Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => {
              const pending = isPendingAccess(user);
              const userRoles = activeUserRoles(user);

              return (
                <tr key={user.id} className="align-top">
                  <td className="border-b border-border px-3 py-3">
                    <div className="flex items-start gap-3">
                      <div className="grid size-9 flex-none place-items-center rounded-full bg-muted text-muted-foreground">
                        <UserRound className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-charcoal">{user.name}</p>
                          {pending ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-800">
                              <AlertTriangle className="size-3" />
                              Pendente
                            </span>
                          ) : null}
                          {user.is_master ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                              <ShieldCheck className="size-3" />
                              Master
                            </span>
                          ) : null}
                        </div>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                        {user.title ? <p className="text-xs text-muted-foreground">{user.title}</p> : null}
                        <p className="break-all font-mono text-[11px] text-muted-foreground">
                          {user.user_id ? `Auth: ${user.user_id}` : "Sem usuário Auth vinculado"}
                        </p>
                        {user.access_review_requests[0]?.requested_at ? (
                          <p className="mt-1 text-[11px] text-orange-800">
                            Solicitado em {new Date(user.access_review_requests[0].requested_at).toLocaleString("pt-BR")}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </td>

                  <td className="border-b border-border px-3 py-3">
                    <UserRoleChips userRoles={userRoles} />
                  </td>

                  <td className="border-b border-border px-3 py-3">
                    <StatusPill pending={pending} status={user.status} />
                  </td>

                  <td className="border-b border-border px-3 py-3">
                    <AssignRoleForm compact roles={roles} user={user} />
                  </td>

                  <td className="border-b border-border px-3 py-3">
                    <UserActions currentProfileId={currentProfileId} pending={pending} user={user} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateRoleForm() {
  return (
    <div className="rounded-md border border-border bg-white p-3">
      <div className="mb-3 flex items-start gap-2">
        <ShieldPlus className="mt-0.5 size-4 text-accent" />
        <div>
          <h3 className="text-base font-semibold text-charcoal">Novo nível de acesso</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Crie perfis operacionais e depois marque as permissões liberadas.
          </p>
        </div>
      </div>
      <ActionForm action={createTechnicalRoleAction} submitLabel="Criar nível">
        <Field label="Nome">
          <input name="name" className={inputClass} required />
        </Field>
        <Field label="Descrição">
          <textarea name="description" className={textareaClass} />
        </Field>
      </ActionForm>
    </div>
  );
}

function RoleCard({
  groupedPermissions,
  permissions,
  role,
}: {
  groupedPermissions: Record<string, Permission[]>;
  permissions: Set<string>;
  role: Role;
}) {
  const editable = !role.is_master_role;
  const grantedCount = permissions.size;

  return (
    <article className="rounded-md border border-border bg-white p-3 text-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-charcoal">{roleName(role.name)}</h3>
            {role.is_master_role ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                <ShieldCheck className="size-3" />
                Administrador
              </span>
            ) : null}
            <RoleStatusPill role={role} />
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{role.description ?? "Sem descrição."}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {role.is_master_role ? "Acesso absoluto por regra master." : `${grantedCount} permissão(ões) vinculada(s).`}
          </p>
        </div>

        {editable ? (
          <div className="flex flex-wrap gap-2">
            <form action={toggleTechnicalRoleStatusFormAction}>
              <input type="hidden" name="role_id" value={role.id} />
              <input type="hidden" name="active" value={role.active ? "false" : "true"} />
              <button
                type="submit"
                className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:border-orange-200 hover:text-accent"
              >
                {role.active ? <Power className="size-4" /> : <RotateCcw className="size-4" />}
                {role.active ? "Inativar" : "Reativar"}
              </button>
            </form>

            <details className="relative">
              <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">
                <Trash2 className="size-4" />
                Excluir
              </summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-md border border-red-200 bg-white p-3 shadow-lg">
                <p className="text-xs text-muted-foreground">
                  Esta ação remove o nível, seus vínculos com usuários e sua matriz de permissões.
                </p>
                <form action={deleteTechnicalRoleFormAction} className="mt-3">
                  <input type="hidden" name="role_id" value={role.id} />
                  <button
                    type="submit"
                    className="inline-flex min-h-10 w-full items-center justify-center rounded-md bg-red-600 px-3 text-xs font-semibold text-white hover:bg-red-700"
                  >
                    Confirmar exclusão
                  </button>
                </form>
              </div>
            </details>
          </div>
        ) : null}
      </div>

      {editable ? (
        <div className="mt-4 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
          <ActionForm action={updateTechnicalRoleAction} submitLabel="Salvar perfil" className="rounded-md bg-muted/40 p-3">
            <input type="hidden" name="role_id" value={role.id} />
            <Field label="Nome">
              <input name="name" className={inputClass} defaultValue={role.name} required />
            </Field>
            <Field label="Descrição">
              <textarea name="description" className={textareaClass} defaultValue={role.description ?? ""} />
            </Field>
          </ActionForm>

          <details className="rounded-md border border-border bg-white">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-3">
              <span className="inline-flex items-center gap-2 font-semibold text-charcoal">
                <KeyRound className="size-4 text-accent" />
                Matriz de permissões
              </span>
              <span className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                Abrir
              </span>
            </summary>
            <div className="border-t border-border p-3">
              <ActionForm action={saveTechnicalRolePermissionsAction} submitLabel="Salvar permissões">
                <input type="hidden" name="role_id" value={role.id} />
                <div className="grid max-h-[620px] gap-4 overflow-y-auto pr-1">
                  {Object.entries(groupedPermissions).map(([group, groupPermissions]) => (
                    <fieldset key={group} className="rounded-md border border-border p-3">
                      <legend className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                        {group}
                      </legend>
                      <div className="mt-2 grid gap-2">
                        {groupPermissions.map((permission) => {
                          const protectedPermission = permission.key === "technical.permissions.manage";

                          return (
                            <label
                              key={permission.id}
                              className={cn(
                                "flex items-start gap-3 rounded-md border border-border bg-white p-2",
                                protectedPermission && "bg-muted/60 opacity-75",
                              )}
                            >
                              <input
                                type="checkbox"
                                name="permission_id"
                                value={permission.id}
                                defaultChecked={!protectedPermission && permissions.has(permission.id)}
                                disabled={protectedPermission}
                                className="mt-1 size-4"
                              />
                              <span className="min-w-0">
                                <span className="block break-all font-mono text-[11px] font-semibold text-charcoal">
                                  {permission.key}
                                </span>
                                <span className="mt-1 block text-xs text-muted-foreground">
                                  {permission.description}
                                </span>
                                {protectedPermission ? (
                                  <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
                                    <LockKeyhole className="size-3" />
                                    Exclusiva do Administrador
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  ))}
                </div>
              </ActionForm>
            </div>
          </details>
        </div>
      ) : (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          O nível Administrador é protegido e recebe acesso absoluto automaticamente.
        </div>
      )}
    </article>
  );
}

function RolesSection({
  permissions,
  rolePermissions,
  roles,
}: {
  permissions: Permission[];
  rolePermissions: Array<{ role_id: string; permission_id: string }>;
  roles: Role[];
}) {
  const groupedPermissions = groupPermissions(permissions);

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-charcoal">Níveis de acesso</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerencie perfis, status e matriz de permissões do módulo Técnico.
        </p>
      </div>

      <CreateRoleForm />

      <div className="space-y-3">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            groupedPermissions={groupedPermissions}
            permissions={rolePermissionIds(role.id, rolePermissions)}
            role={role}
          />
        ))}
      </div>
    </div>
  );
}

export async function SecurityAccessPanel() {
  const data = await getTechnicalSecurityData();
  const pendingCount = data.users.filter(isPendingAccess).length;

  return (
    <Panel>
      <PanelHeader
        title="Segurança e acessos"
        description="Usuários, níveis de acesso e matriz de permissões do módulo Técnico."
      />
      <PanelBody className="space-y-4">
        {pendingCount ? (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 flex-none" />
              <div>
                <p className="font-semibold">{pendingCount} cadastro(s) aguardando nível de acesso.</p>
                <p className="mt-1">Escolha um perfil para liberar o acesso ou recuse para remover o cadastro.</p>
              </div>
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 2xl:grid-cols-[minmax(0,1.1fr)_minmax(420px,0.9fr)]">
          <UsersSection
            currentProfileId={data.currentProfileId}
            roles={data.roles}
            users={data.users}
          />
          <RolesSection
            permissions={data.permissions}
            rolePermissions={data.rolePermissions}
            roles={data.roles}
          />
        </div>
      </PanelBody>
    </Panel>
  );
}
