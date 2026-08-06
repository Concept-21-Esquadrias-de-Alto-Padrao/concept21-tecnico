import { SecurityAccessPanelClient } from "@/components/security-access-panel-client";
import { getTechnicalSecurityData } from "@/lib/technical-security";

export async function SecurityAccessPanel() {
  const data = await getTechnicalSecurityData();

  return <SecurityAccessPanelClient data={data} />;
}
