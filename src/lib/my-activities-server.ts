import "server-only";
import { buildMyActivities, type MyActivitiesSource } from "@/lib/my-activities";
import { canAccessModule, getWorkItemPermissions, MODULE_ACCESS, TECHNICAL_PERMISSIONS } from "@/lib/module-access";
import { getCurrentPermissionFlags, HttpError, requireAuthenticatedProfile } from "@/lib/server-access";

type QueryFilters = {
  equal?: Record<string, string | boolean>;
  include?: Record<string, string[]>;
  nulls?: string[];
  oneOf?: { column: string; values: string[] };
  exclude?: { column: string; values: string[] };
};

export async function getMyActivities() {
  const context = await requireAuthenticatedProfile();
  const access = await getCurrentPermissionFlags(TECHNICAL_PERMISSIONS);
  if (!canAccessModule(access, MODULE_ACCESS.myActivities)) throw new HttpError(403, "Você não possui acesso às atividades deste módulo.");
  const rights = getWorkItemPermissions(access);
  const canSign = access.isMaster || access.permissions["technical.contracts.view"];
  const companyId = context.profile.company_id;
  const profileId = context.profile.id;

  async function read<T>(table: string, columns: string, filters: QueryFilters = {}): Promise<T[]> {
    if (filters.oneOf && !filters.oneOf.values.length) return [];
    const chunks = filters.oneOf
      ? Array.from({ length: Math.ceil(filters.oneOf.values.length / 100) }, (_, i) => filters.oneOf!.values.slice(i * 100, (i + 1) * 100))
      : [null];
    const rows: T[] = [];
    for (const ids of chunks) {
      for (let offset = 0; ; offset += 500) {
        const primaryKey = table === "technical_contracts" ? "contract_id" : "id";
        let query = context.admin.from(table).select(columns).eq("company_id", companyId).order(primaryKey).range(offset, offset + 499);
        for (const [key, value] of Object.entries(filters.equal ?? {})) query = query.eq(key, value);
        for (const [key, values] of Object.entries(filters.include ?? {})) query = query.in(key, values);
        for (const key of filters.nulls ?? []) query = query.is(key, null);
        if (ids && filters.oneOf) query = query.in(filters.oneOf.column, ids);
        if (filters.exclude) query = query.not(filters.exclude.column, "in", `(${filters.exclude.values.join(",")})`);
        const { data, error } = await query;
        if (error) throw error;
        rows.push(...(data ?? []) as unknown as T[]);
        if ((data ?? []).length < 500) break;
      }
    }
    return rows;
  }

  const [actions, corrections, stageParticipants, releaseParticipants] = await Promise.all([
    rights.canViewActions ? read<MyActivitiesSource["actions"][number]>("technical_actions", "id,company_id,contract_id,title,responsible_profile_id,due_date,status,blocking,deleted_at", { equal: { responsible_profile_id: profileId }, nulls: ["deleted_at"], exclude: { column: "status", values: ["concluida", "cancelada"] } }) : [],
    rights.canViewCorrections ? read<MyActivitiesSource["corrections"][number]>("technical_corrections", "id,company_id,contract_id,type,responsible_profile_id,due_date,status,blocking,deleted_at", { equal: { responsible_profile_id: profileId }, nulls: ["deleted_at"], exclude: { column: "status", values: ["encerrada", "cancelada"] } }) : [],
    canSign ? read<MyActivitiesSource["stageParticipants"][number]>("technical_stage_validation_participants", "id,company_id,contract_id,stage,profile_id,signed_at", { equal: { profile_id: profileId }, nulls: ["signed_at"], exclude: { column: "stage", values: ["pecas_medicoes_liberacoes"] } }) : [],
    canSign ? read<MyActivitiesSource["releaseParticipants"][number]>("technical_release_participants", "id,company_id,release_id,profile_id,signed_at", { equal: { profile_id: profileId }, nulls: ["signed_at"] }) : [],
  ]);
  const releases = await read<MyActivitiesSource["releases"][number]>("technical_releases", "id,company_id,contract_id,batch_number,status,validation_required", { equal: { validation_required: true }, oneOf: { column: "id", values: [...new Set(releaseParticipants.map((row) => row.release_id))] }, exclude: { column: "status", values: ["cancelado"] } });
  const contractIds = [...new Set([...actions, ...corrections, ...stageParticipants, ...releases].map((row) => row.contract_id))];
  const byContract: QueryFilters = { oneOf: { column: "contract_id", values: contractIds } };

  // Read prerequisites for every participant in the assigned stage, not only this user's work.
  async function fact(stages: string[], table: string, filters: QueryFilters) {
    const values = [...new Set(stageParticipants.filter((row) => stages.includes(row.stage)).map((row) => row.contract_id))];
    return (await read<{ contract_id: string }>(table, "contract_id", { ...filters, oneOf: { column: "contract_id", values } })).map((row) => row.contract_id);
  }
  const [contracts, technicalContracts, validations, completedMeetings, performedVisits, openActions, openCorrections, approvedProds, openDoubts, meetingSignatures] = await Promise.all([
    read<MyActivitiesSource["contracts"][number]>("production_contracts", "id,company_id,active,contract_number,work_name", { equal: { active: true }, oneOf: { column: "id", values: contractIds } }),
    read<MyActivitiesSource["technicalContracts"][number]>("technical_contracts", "company_id,contract_id,deleted_at,commercial_folder_received", byContract),
    read<MyActivitiesSource["validations"][number]>("technical_stage_validations", "company_id,contract_id,stage,validation_required", { oneOf: { column: "contract_id", values: [...new Set(stageParticipants.map((row) => row.contract_id))] }, equal: { validation_required: true } }),
    fact(["reuniao_ata", "entrada_comercial"], "technical_closing_meetings", { equal: { status: "concluida" } }),
    fact(["visitas"], "technical_visits", { include: { status: ["realizada", "aguardando_relatorio", "relatorio_emitido"] } }),
    fact(["acoes"], "technical_actions", { nulls: ["deleted_at"], exclude: { column: "status", values: ["concluida", "cancelada"] } }),
    fact(["correcoes"], "technical_corrections", { nulls: ["deleted_at"], exclude: { column: "status", values: ["encerrada", "cancelada"] } }),
    fact(["prods"], "technical_prod_batches", { nulls: ["deleted_at"], include: { status: ["aprovado", "entregue_suprimentos", "entregue_producao", "concluido"] } }),
    fact(["duvidas"], "technical_doubts", { equal: { status: "aberta" } }),
    read<MyActivitiesSource["meetingSignatures"][number]>("technical_stage_validation_participants", "company_id,contract_id,signed_at", {
      equal: { stage: "reuniao_ata" },
      oneOf: { column: "contract_id", values: [...new Set(stageParticipants.filter((row) => row.stage === "entrada_comercial").map((row) => row.contract_id))] },
    }),
  ]);
  return buildMyActivities({ contracts, technicalContracts, actions, corrections, validations, stageParticipants, releaseParticipants, releases, completedMeetings, performedVisits, openActions, openCorrections, approvedProds, openDoubts, meetingSignatures }, { companyId, profileId }, access);
}
