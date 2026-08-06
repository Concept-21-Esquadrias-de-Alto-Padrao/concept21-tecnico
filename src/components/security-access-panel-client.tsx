"use client";

import {
  AlertTriangle,
  Check,
  KeyRound,
  LockKeyhole,
  Pencil,
  Power,
  RotateCcw,
  ShieldCheck,
  ShieldPlus,
  Trash2,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
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
import type { TechnicalSecurityData, TechnicalSecurityUser } from "@/lib/technical-security";
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

function roleDescription(role?: Role | null) {
  return role?.description || "Sem descrição.";
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

function rolePermissionIds(
  roleId: string,
  rolePermissions: Array<{ role_id: string; permission_id: string }>,
) {
  return new Set(
    rolePermissions
      .filter((rolePermission) => rolePermission.role_id === roleId)
      .map((rolePermission) => rolePermission.permission_id),
  );
}

function formatRequestedAt(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleString("pt-BR");
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
            className="inline-flex min-h-9 items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 text-xs font-medium text-zinc-700 transition hover:border-red-200 hover:text-red-700"
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
  compact = false,
  roles,
  user,
}: {
  compact?: boolean;
  roles: Role[];
  user: TechnicalSecurityUser;
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

function UsersPanel({
  currentProfileId,
  pendingCount,
  roles,
  users,
}: {
  currentProfileId: string;
  pendingCount: number;
  roles: Role[];
  users: TechnicalSecurityUser[];
}) {
  return (
    <Panel>
      <PanelHeader
        title="Usuários do sistema"
        description="Cadastros confirmados sem nível ficam pendentes até o Administrador vincular um nível de acesso."
      />
      <PanelBody className="space-y-4">
        {pendingCount ? (
          <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-sm text-orange-900">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-5 flex-none" />
              <div>
                <p className="font-semibold">{pendingCount} cadastro(s) aguardando nível de acesso.</p>
                <p className="mt-1">Vincule um nível para liberar acesso ou recuse para excluir o cadastro.</p>
              </div>
            </div>
          </div>
        ) : null}

        {!users.length ? (
          <EmptyState
            icon={UserRound}
            title="Nenhum usuário cadastrado"
            description="Os usuários aparecerão aqui depois da solicitação de cadastro e confirmação do e-mail."
          />
        ) : (
          <>
            <div className="space-y-3 lg:hidden">
              {users.map((user) => {
                const pending = isPendingAccess(user);
                const userRoles = activeUserRoles(user);
                const requestedAt = formatRequestedAt(user.access_review_requests[0]?.requested_at);

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
                        {requestedAt ? (
                          <p className="mt-1 text-[11px] text-orange-800">Solicitado em {requestedAt}</p>
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
                    const requestedAt = formatRequestedAt(user.access_review_requests[0]?.requested_at);

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
                              {requestedAt ? (
                                <p className="mt-1 text-[11px] text-orange-800">
                                  Solicitado em {requestedAt}
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
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

function CreateRoleForm() {
  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <div className="mb-3 flex items-start gap-2">
        <ShieldPlus className="mt-0.5 size-4 text-accent" />
        <div>
          <p className="text-sm font-semibold text-charcoal">Novo nível de acesso</p>
          <p className="mt-1 text-xs text-muted-foreground">
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

function RoleSelectorPanel({
  editingRoleId,
  onEditRole,
  onSelectRole,
  roles,
  selectedRoleId,
}: {
  editingRoleId: string | null;
  onEditRole: (roleId: string | null) => void;
  onSelectRole: (roleId: string) => void;
  roles: Role[];
  selectedRoleId: string;
}) {
  return (
    <Panel>
      <PanelHeader
        title="Níveis de acesso"
        description="Crie perfis operacionais e escolha um nível para editar a matriz."
      />
      <PanelBody className="space-y-4">
        <div className="space-y-2">
          {roles.map((role) => {
            const selected = selectedRoleId === role.id;
            const editable = !role.is_master_role;
            const editing = editingRoleId === role.id;

            return (
              <article
                key={role.id}
                className={cn(
                  "rounded-md border border-border bg-white p-2",
                  selected && "border-accent ring-2 ring-orange-100",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectRole(role.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-charcoal">
                        {roleName(role.name)}
                      </span>
                      {role.is_master_role ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                          <ShieldCheck className="size-3" />
                          Administrador
                        </span>
                      ) : null}
                      <RoleStatusPill role={role} />
                    </span>
                    <span className="mt-1 block truncate text-xs text-muted-foreground">
                      {roleDescription(role)}
                    </span>
                  </button>

                  {editable ? (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRole(role.id);
                          onEditRole(editing ? null : role.id);
                        }}
                        className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-orange-200 hover:text-accent"
                        title={editing ? "Fechar edição" : "Editar nível"}
                      >
                        {editing ? <X className="size-4" /> : <Pencil className="size-4" />}
                      </button>

                      <form action={toggleTechnicalRoleStatusFormAction}>
                        <input type="hidden" name="role_id" value={role.id} />
                        <input type="hidden" name="active" value={role.active ? "false" : "true"} />
                        <button
                          type="submit"
                          className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-orange-200 hover:text-accent"
                          title={role.active ? "Inativar nível" : "Reativar nível"}
                        >
                          {role.active ? <Power className="size-4" /> : <RotateCcw className="size-4" />}
                        </button>
                      </form>
                    </div>
                  ) : null}
                </div>

                {editing ? (
                  <div className="mt-3 rounded-md bg-muted/40 p-3">
                    <ActionForm action={updateTechnicalRoleAction} submitLabel="Salvar perfil">
                      <input type="hidden" name="role_id" value={role.id} />
                      <Field label="Nome">
                        <input name="name" className={inputClass} defaultValue={role.name} required />
                      </Field>
                      <Field label="Descrição">
                        <textarea
                          name="description"
                          className={textareaClass}
                          defaultValue={role.description ?? ""}
                        />
                      </Field>
                    </ActionForm>
                  </div>
                ) : null}

                {editable ? (
                  <details className="mt-2">
                    <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-md border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50">
                      <Trash2 className="size-4" />
                      Excluir nível
                    </summary>
                    <div className="mt-2 rounded-md border border-red-200 bg-red-50 p-3">
                      <p className="text-xs text-red-700">
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
                ) : (
                  <div className="mt-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
                    O nível Administrador é protegido e recebe acesso absoluto automaticamente.
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <CreateRoleForm />
      </PanelBody>
    </Panel>
  );
}

function PermissionRow({
  disabled,
  granted,
  onGrantChange,
  permission,
  protectedPermission,
}: {
  disabled: boolean;
  granted: boolean;
  onGrantChange?: (granted: boolean) => void;
  permission: Permission;
  protectedPermission: boolean;
}) {
  return (
    <label
      className={cn(
        "grid gap-3 px-3 py-3 text-sm sm:grid-cols-[1fr_auto]",
        protectedPermission && "bg-zinc-50 opacity-75",
      )}
    >
      <span>
        <span className="block break-all font-mono text-[11px] font-semibold text-charcoal">
          {permission.key}
        </span>
        <span className="mt-1 block text-xs text-muted-foreground">{permission.description}</span>
        {protectedPermission ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <LockKeyhole className="size-3" />
            Exclusiva do Administrador
          </span>
        ) : null}
      </span>
      <span className="inline-flex items-center gap-2">
        <input
          type="checkbox"
          name="permission_id"
          value={permission.id}
          checked={granted}
          disabled={disabled}
          readOnly={!onGrantChange}
          onChange={(event) => onGrantChange?.(event.target.checked)}
          className="size-4 rounded border-border"
        />
        <span className="text-xs font-semibold text-muted-foreground">
          {granted ? (
            <span className="inline-flex items-center gap-1 text-emerald-700">
              <Check className="size-3" />
              Liberado
            </span>
          ) : (
            "Restrito"
          )}
        </span>
      </span>
    </label>
  );
}

function PermissionGroups({
  disabled,
  grantedPermissionIds,
  groupedPermissions,
  onPermissionChange,
  protectedRole,
}: {
  disabled: boolean;
  grantedPermissionIds: Set<string>;
  groupedPermissions: Record<string, Permission[]>;
  onPermissionChange?: (permissionId: string, granted: boolean) => void;
  protectedRole: boolean;
}) {
  return (
    <div className="space-y-4">
      {Object.entries(groupedPermissions).map(([group, permissions]) => (
        <div key={group} className="rounded-md border border-border">
          <div className="border-b border-border bg-muted/40 px-3 py-2">
            <p className="text-xs font-semibold uppercase text-accent">{group}</p>
          </div>
          <div className="divide-y divide-border">
            {permissions.map((permission) => {
              const protectedPermission = permission.key === "technical.permissions.manage";
              const granted = protectedRole
                ? true
                : !protectedPermission && grantedPermissionIds.has(permission.id);

              return (
                <PermissionRow
                  key={permission.id}
                  disabled={disabled || protectedPermission}
                  granted={granted}
                  onGrantChange={
                    disabled || protectedPermission
                      ? undefined
                      : (nextGranted) => onPermissionChange?.(permission.id, nextGranted)
                  }
                  permission={permission}
                  protectedPermission={protectedPermission}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function PermissionMatrixForm({
  grantedPermissionIds,
  groupedPermissions,
  selectedRole,
}: {
  grantedPermissionIds: Set<string>;
  groupedPermissions: Record<string, Permission[]>;
  selectedRole: Role;
}) {
  const [draftPermissionIds, setDraftPermissionIds] = useState(() => new Set(grantedPermissionIds));

  function updatePermission(permissionId: string, granted: boolean) {
    setDraftPermissionIds((current) => {
      const next = new Set(current);
      if (granted) {
        next.add(permissionId);
      } else {
        next.delete(permissionId);
      }
      return next;
    });
  }

  return (
    <ActionForm action={saveTechnicalRolePermissionsAction} submitLabel="Salvar matriz">
      <input type="hidden" name="role_id" value={selectedRole.id} />
      <PermissionGroups
        disabled={false}
        grantedPermissionIds={draftPermissionIds}
        groupedPermissions={groupedPermissions}
        onPermissionChange={updatePermission}
        protectedRole={false}
      />
    </ActionForm>
  );
}

function PermissionMatrixPanel({
  groupedPermissions,
  grantedPermissionIds,
  selectedRole,
}: {
  groupedPermissions: Record<string, Permission[]>;
  grantedPermissionIds: Set<string>;
  selectedRole: Role | null;
}) {
  const protectedRole = Boolean(selectedRole?.is_master_role);
  const selectedRolePermissionVersion = [...grantedPermissionIds].sort().join("|");

  return (
    <Panel>
      <PanelHeader
        title="Matriz de permissões"
        description="Marque as permissões liberadas para o nível selecionado. O Administrador permanece protegido."
      />
      <PanelBody className="space-y-5">
        {!selectedRole ? (
          <EmptyState
            icon={KeyRound}
            title="Nenhum nível selecionado"
            description="Selecione um nível de acesso para editar sua matriz de permissões."
          />
        ) : (
          <>
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
              <div className="flex flex-wrap items-center gap-2 font-semibold text-charcoal">
                <ShieldPlus className="size-4 text-accent" />
                {roleName(selectedRole.name)}
                {selectedRole.is_master_role ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
                    <ShieldCheck className="size-3" />
                    Administrador
                  </span>
                ) : null}
                <RoleStatusPill role={selectedRole} />
              </div>
              <p className="mt-1 text-muted-foreground">{roleDescription(selectedRole)}</p>
            </div>

            {protectedRole ? (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                O nível Administrador tem acesso absoluto por regra master. Para proteger o sistema, sua matriz não pode ser editada.
              </div>
            ) : null}

            {protectedRole ? (
              <PermissionGroups
                disabled
                grantedPermissionIds={grantedPermissionIds}
                groupedPermissions={groupedPermissions}
                protectedRole={protectedRole}
              />
            ) : (
              <PermissionMatrixForm
                key={`${selectedRole.id}:${selectedRolePermissionVersion}`}
                grantedPermissionIds={grantedPermissionIds}
                groupedPermissions={groupedPermissions}
                selectedRole={selectedRole}
              />
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}

export function SecurityAccessPanelClient({ data }: { data: TechnicalSecurityData }) {
  const [selectedRoleId, setSelectedRoleId] = useState(data.roles[0]?.id ?? "");
  const [editingRoleId, setEditingRoleId] = useState<string | null>(null);
  const pendingCount = data.users.filter(isPendingAccess).length;

  const groupedPermissions = useMemo(() => groupPermissions(data.permissions), [data.permissions]);
  const selectedRole = data.roles.find((role) => role.id === selectedRoleId) ?? data.roles[0] ?? null;
  const selectedRolePermissions = selectedRole
    ? rolePermissionIds(selectedRole.id, data.rolePermissions)
    : new Set<string>();

  return (
    <div className="space-y-5">
      <UsersPanel
        currentProfileId={data.currentProfileId}
        pendingCount={pendingCount}
        roles={data.roles}
        users={data.users}
      />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <RoleSelectorPanel
          editingRoleId={editingRoleId}
          onEditRole={setEditingRoleId}
          onSelectRole={setSelectedRoleId}
          roles={data.roles}
          selectedRoleId={selectedRole?.id ?? ""}
        />
        <PermissionMatrixPanel
          groupedPermissions={groupedPermissions}
          grantedPermissionIds={selectedRolePermissions}
          selectedRole={selectedRole}
        />
      </div>
    </div>
  );
}
