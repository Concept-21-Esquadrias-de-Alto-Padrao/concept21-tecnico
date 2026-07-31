export const MODULE_ACCESS = {
  dashboard: ["technical.dashboard.view"],
  contracts: ["technical.contracts.view"],
  agenda: ["technical.visits.view", "technical.followup.view"],
  actions: ["technical.actions.view"],
  corrections: ["technical.corrections.view"],
  prods: ["technical.prods.view"],
  doubts: ["technical.doubts.view"],
  reports: ["technical.reports.view"],
  settings: ["technical.settings.manage", "technical.permissions.manage"],
} as const;

export const TECHNICAL_PERMISSIONS = [
  "technical.dashboard.view",
  "technical.contracts.view",
  "technical.contracts.import_pdf",
  "technical.contracts.manual_create",
  "technical.contracts.edit",
  "technical.contracts.delete_request",
  "technical.financial.view",
  "technical.folder.receive",
  "technical.meetings.manage",
  "technical.actions.view",
  "technical.actions.manage",
  "technical.actions.reopen",
  "technical.followup.view",
  "technical.followup.manage",
  "technical.visits.view",
  "technical.visits.manage",
  "technical.visits.cancel",
  "technical.measurements.manage",
  "technical.pieces.edit_released",
  "technical.pieces.release",
  "technical.reports.view",
  "technical.reports.generate",
  "technical.corrections.view",
  "technical.corrections.manage",
  "technical.prods.view",
  "technical.prods.manage",
  "technical.prods.check",
  "technical.prods.approve",
  "technical.prods.change_approved",
  "technical.deliveries.suprimentos_confirm",
  "technical.deliveries.producao_confirm",
  "technical.doubts.view",
  "technical.doubts.manage",
  "technical.audit.view",
  "technical.settings.manage",
  "technical.permissions.manage",
] as const;

export type PermissionLookup = {
  isMaster: boolean;
  permissions: Record<string, boolean>;
};

export const appNavigationPermissionKeys = Array.from(
  new Set(Object.values(MODULE_ACCESS).flat()),
);

export const appRouteAccess = [
  { href: "/tecnico", permissions: MODULE_ACCESS.dashboard },
  { href: "/tecnico/contratos", permissions: MODULE_ACCESS.contracts },
  { href: "/tecnico/agenda", permissions: MODULE_ACCESS.agenda },
  { href: "/tecnico/acoes", permissions: MODULE_ACCESS.actions },
  { href: "/tecnico/correcoes", permissions: MODULE_ACCESS.corrections },
  { href: "/tecnico/prods", permissions: MODULE_ACCESS.prods },
  { href: "/tecnico/duvidas", permissions: MODULE_ACCESS.doubts },
  { href: "/tecnico/relatorios", permissions: MODULE_ACCESS.reports },
  { href: "/tecnico/configuracoes", permissions: MODULE_ACCESS.settings },
] as const;

export function hasAnyPermission(
  permissions: Record<string, boolean>,
  permissionKeys: readonly string[],
) {
  return permissionKeys.some((permissionKey) => permissions[permissionKey]);
}

export function canAccessModule(
  access: PermissionLookup,
  permissionKeys: readonly string[],
) {
  return access.isMaster || hasAnyPermission(access.permissions, permissionKeys);
}

export function firstAllowedAppRoute(access: PermissionLookup) {
  return (
    appRouteAccess.find((route) => canAccessModule(access, route.permissions))?.href ?? null
  );
}
