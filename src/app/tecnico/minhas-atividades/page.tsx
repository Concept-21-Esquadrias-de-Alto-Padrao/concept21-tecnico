import { redirect } from "next/navigation";
import { MyActivities } from "@/components/my-activities";
import { PageHeader } from "@/components/page-header";
import { appNavigationPermissionKeys, canAccessModule, firstAllowedAppRoute, MODULE_ACCESS } from "@/lib/module-access";
import { getCurrentPermissionFlags } from "@/lib/server-access";

export default async function MyActivitiesPage() {
  const access = await getCurrentPermissionFlags(appNavigationPermissionKeys);
  if (!canAccessModule(access, MODULE_ACCESS.myActivities)) redirect(firstAllowedAppRoute(access) ?? "/login");
  return <div className="space-y-6"><PageHeader title="Minhas atividades" /><MyActivities /></div>;
}
