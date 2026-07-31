import { AlertTriangle, Power, RotateCcw, ShieldCheck, Trash2, UserRound, UserX } from "lucide-react";
import {
  assignTechnicalUserRoleFormAction,
  rejectTechnicalAccessRequestFormAction,
  removeTechnicalUserRoleFormAction,
  setTechnicalProfileStatusFormAction,
} from "@/app/actions";
import { EmptyState } from "@/components/empty-state";
import { Panel, PanelBody, PanelHeader } from "@/components/panel";
import { getTechnicalSecurityData, type TechnicalSecurityUser } from "@/lib/technical-security";
import { cn } from "@/lib/utils";

function activeUserRoles(user: TechnicalSecurityUser) {
  return user.user_roles.filter((userRole) => userRole.active !== false && userRole.role);
}

function isPendingAccess(user: TechnicalSecurityUser) {
  return user.status === "active" && Boolean(user.user_id) && activeUserRoles(user).length === 0;
}

function roleName(name?: string | null) {
  return name || "Perfil";
}

export async function SecurityAccessPanel() {
  const data = await getTechnicalSecurityData();
  const pendingCount = data.users.filter(isPendingAccess).length;

  return (
    <Panel>
      <PanelHeader
        title="Segurança e acessos"
        description="Cadastros confirmados sem nível de acesso ficam pendentes até o Administrador liberar ou recusar."
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

        {data.users.length ? (
          <>
          <div className="space-y-3 lg:hidden">
            {data.users.map((user) => {
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
                    <span
                      className={cn(
                        "inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1",
                        pending
                          ? "bg-orange-50 text-orange-800 ring-orange-200"
                          : user.status === "active"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-muted text-muted-foreground ring-border",
                      )}
                    >
                      {pending ? "Pendente" : user.status === "active" ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="mt-3 space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground">Níveis vinculados</p>
                    {userRoles.length ? (
                      <div className="flex flex-wrap gap-2">
                        {userRoles.map((userRole) => (
                          <form key={userRole.id} action={removeTechnicalUserRoleFormAction}>
                            <input type="hidden" name="user_role_id" value={userRole.id} />
                            <button
                              type="submit"
                              className="inline-flex min-h-9 items-center gap-1 rounded-full border border-border bg-white px-2.5 text-xs font-medium text-muted-foreground hover:border-red-200 hover:text-red-700"
                              title="Remover nível de acesso"
                            >
                              {roleName(userRole.role?.name)}
                              <Trash2 className="size-3" />
                            </button>
                          </form>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Nenhum nível vinculado.</p>
                    )}
                  </div>

                  <form action={assignTechnicalUserRoleFormAction} className="mt-3 grid gap-2">
                    <input type="hidden" name="profile_id" value={user.id} />
                    <select
                      name="role_id"
                      className="min-h-11 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-accent"
                      defaultValue=""
                      disabled={user.status !== "active"}
                      required
                    >
                      <option value="">Selecionar nível de acesso</option>
                      {data.roles
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
                      className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground hover:bg-orange-500 disabled:opacity-60"
                    >
                      Liberar acesso
                    </button>
                  </form>

                  <div className="mt-3 flex gap-2">
                    <form action={setTechnicalProfileStatusFormAction} className="flex-1">
                      <input type="hidden" name="profile_id" value={user.id} />
                      <input type="hidden" name="status" value={user.status === "active" ? "inactive" : "active"} />
                      <button
                        type="submit"
                        disabled={user.id === data.currentProfileId && user.status === "active"}
                        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border text-xs font-semibold text-muted-foreground hover:border-orange-200 hover:text-accent disabled:opacity-50"
                      >
                        {user.status === "active" ? <Power className="size-4" /> : <RotateCcw className="size-4" />}
                        {user.status === "active" ? "Inativar" : "Reativar"}
                      </button>
                    </form>

                    {user.id !== data.currentProfileId ? (
                      <form action={rejectTechnicalAccessRequestFormAction} className="flex-1">
                        <input type="hidden" name="profile_id" value={user.id} />
                        <button
                          type="submit"
                          className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-red-200 text-xs font-semibold text-red-600 hover:bg-red-50"
                        >
                          <UserX className="size-4" />
                          Excluir
                        </button>
                      </form>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[900px] border-separate border-spacing-0 text-left text-sm">
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
                {data.users.map((user) => {
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
                        {userRoles.length ? (
                          <div className="flex flex-wrap gap-2">
                            {userRoles.map((userRole) => (
                              <form key={userRole.id} action={removeTechnicalUserRoleFormAction}>
                                <input type="hidden" name="user_role_id" value={userRole.id} />
                                <button
                                  type="submit"
                                  className="inline-flex items-center gap-1 rounded-full border border-border bg-white px-2.5 py-1 text-xs font-medium text-muted-foreground hover:border-red-200 hover:text-red-700"
                                  title="Remover nível de acesso"
                                >
                                  {roleName(userRole.role?.name)}
                                  <Trash2 className="size-3" />
                                </button>
                              </form>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">Nenhum nível vinculado.</p>
                        )}
                      </td>

                      <td className="border-b border-border px-3 py-3">
                        <span
                          className={cn(
                            "inline-flex rounded-md px-2 py-1 text-xs font-semibold ring-1",
                            pending
                              ? "bg-orange-50 text-orange-800 ring-orange-200"
                              : user.status === "active"
                                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                                : "bg-muted text-muted-foreground ring-border",
                          )}
                        >
                          {pending ? "Pendente" : user.status === "active" ? "Ativo" : "Inativo"}
                        </span>
                      </td>

                      <td className="border-b border-border px-3 py-3">
                        <form action={assignTechnicalUserRoleFormAction} className="flex gap-2">
                          <input type="hidden" name="profile_id" value={user.id} />
                          <select
                            name="role_id"
                            className="min-h-10 w-full rounded-md border border-border bg-white px-3 text-sm outline-none focus:border-accent"
                            defaultValue=""
                            disabled={user.status !== "active"}
                            required
                          >
                            <option value="">Selecionar nível</option>
                            {data.roles
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
                            className="inline-flex min-h-10 items-center justify-center rounded-md bg-accent px-3 text-xs font-semibold text-accent-foreground hover:bg-orange-500 disabled:opacity-60"
                          >
                            Liberar
                          </button>
                        </form>
                      </td>

                      <td className="border-b border-border px-3 py-3">
                        <div className="flex gap-2">
                          <form action={setTechnicalProfileStatusFormAction}>
                            <input type="hidden" name="profile_id" value={user.id} />
                            <input
                              type="hidden"
                              name="status"
                              value={user.status === "active" ? "inactive" : "active"}
                            />
                            <button
                              type="submit"
                              disabled={user.id === data.currentProfileId && user.status === "active"}
                              className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:border-orange-200 hover:text-accent disabled:opacity-50"
                              title={user.status === "active" ? "Inativar usuário" : "Reativar usuário"}
                            >
                              {user.status === "active" ? <Power className="size-4" /> : <RotateCcw className="size-4" />}
                            </button>
                          </form>

                          {user.id !== data.currentProfileId ? (
                            <form action={rejectTechnicalAccessRequestFormAction}>
                              <input type="hidden" name="profile_id" value={user.id} />
                              <button
                                type="submit"
                                className="grid size-9 place-items-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                                title={pending ? "Recusar e excluir cadastro" : "Excluir cadastro"}
                              >
                                <UserX className="size-4" />
                              </button>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        ) : (
          <EmptyState
            icon={UserRound}
            title="Nenhum usuário cadastrado"
            description="Os usuários aparecerão aqui depois da solicitação de cadastro e confirmação do e-mail."
          />
        )}
      </PanelBody>
    </Panel>
  );
}
