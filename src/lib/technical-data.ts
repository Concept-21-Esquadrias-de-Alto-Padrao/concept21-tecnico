import { unstable_noStore as noStore } from "next/cache";
import { hasSupabaseEnv, createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  Client,
  PlatformNotification,
  ProductionContract,
  Profile,
  TechnicalAction,
  TechnicalAuditLog,
  TechnicalContract,
  TechnicalContractOverview,
  TechnicalCorrection,
  TechnicalDepartmentDelivery,
  TechnicalDoubt,
  TechnicalMeeting,
  TechnicalPiece,
  TechnicalProdBatch,
  TechnicalProdBatchPiece,
  TechnicalProdDocument,
  TechnicalRelease,
  TechnicalReleaseParticipant,
  TechnicalReleasePiece,
  TechnicalStageValidation,
  TechnicalStageValidationParticipant,
  TechnicalSnapshot,
  TechnicalVisit,
  TechnicalVisitPiece,
} from "@/lib/types";

type QueryError = {
  code?: string;
  message?: string;
};

type QueryResponse = { data: unknown[] | null; error: QueryError | null };

type SnapshotKey = Exclude<keyof TechnicalSnapshot, "source">;
type SnapshotInclude = Partial<Record<SnapshotKey, boolean>>;
type SnapshotQuery = {
  key: SnapshotKey;
  optionalMissing?: boolean;
  load: () => PromiseLike<QueryResponse>;
  apply: (snapshot: TechnicalSnapshot, data: unknown[]) => void;
};

function emptySnapshot(): TechnicalSnapshot {
  return {
    source: hasSupabaseEnv() ? "supabase" : "empty",
    clients: [],
    profiles: [],
    contracts: [],
    technicalContracts: [],
    pieces: [],
    meetings: [],
    stageValidations: [],
    stageValidationParticipants: [],
    actions: [],
    visits: [],
    visitPieces: [],
    releases: [],
    releasePieces: [],
    releaseParticipants: [],
    corrections: [],
    prodBatches: [],
    prodBatchPieces: [],
    prodDocuments: [],
    deliveries: [],
    doubts: [],
    notifications: [],
    auditLogs: [],
  };
}

function includeKeys(keys: SnapshotKey[]): SnapshotInclude {
  return Object.fromEntries(keys.map((key) => [key, true])) as SnapshotInclude;
}

function isMissingRelation(error?: QueryError | null) {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

function addSnapshotQuery(
  queries: SnapshotQuery[],
  include: SnapshotInclude,
  query: SnapshotQuery,
) {
  if (include[query.key]) queries.push(query);
}

async function loadTechnicalSnapshot(
  include: SnapshotInclude,
  filters: { contractId?: string; prodBatchId?: string } = {},
): Promise<TechnicalSnapshot> {
  noStore();
  const snapshot = emptySnapshot();
  if (!hasSupabaseEnv()) return snapshot;

  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return snapshot;

    const queries: SnapshotQuery[] = [];

    addSnapshotQuery(queries, include, {
      key: "clients",
      load: () => supabase.from("clients").select("*").order("name"),
      apply: (target, data) => {
        target.clients = data as Client[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "profiles",
      load: () => supabase.from("profiles").select("*").order("name"),
      apply: (target, data) => {
        target.profiles = data as Profile[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "contracts",
      load: () => {
        const query = supabase.from("production_contracts").select("*");
        return filters.contractId
          ? query.eq("id", filters.contractId)
          : query.order("contract_number");
      },
      apply: (target, data) => {
        target.contracts = data as ProductionContract[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "technicalContracts",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_contracts").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("updated_at", { ascending: false });
      },
      apply: (target, data) => {
        target.technicalContracts = data as TechnicalContract[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "pieces",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_contract_pieces").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("code");
      },
      apply: (target, data) => {
        target.pieces = data as TechnicalPiece[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "meetings",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_closing_meetings").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("meeting_date", { ascending: false });
      },
      apply: (target, data) => {
        target.meetings = data as TechnicalMeeting[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "stageValidations",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_stage_validations").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("updated_at", { ascending: false });
      },
      apply: (target, data) => {
        target.stageValidations = data as TechnicalStageValidation[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "stageValidationParticipants",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_stage_validation_participants").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("created_at");
      },
      apply: (target, data) => {
        target.stageValidationParticipants = data as TechnicalStageValidationParticipant[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "actions",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_actions").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("due_date");
      },
      apply: (target, data) => {
        target.actions = data as TechnicalAction[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "visits",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_visits").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("scheduled_date");
      },
      apply: (target, data) => {
        target.visits = data as TechnicalVisit[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "visitPieces",
      optionalMissing: true,
      load: () => supabase.from("technical_visit_pieces").select("*"),
      apply: (target, data) => {
        target.visitPieces = data as TechnicalVisitPiece[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "releases",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_releases").select("*");
        return filters.contractId
          ? query.eq("contract_id", filters.contractId).order("created_at", { ascending: false })
          : query.order("created_at", { ascending: false });
      },
      apply: (target, data) => {
        target.releases = data as TechnicalRelease[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "releasePieces",
      optionalMissing: true,
      load: () => supabase.from("technical_release_pieces").select("*").order("created_at", { ascending: false }),
      apply: (target, data) => {
        target.releasePieces = data as TechnicalReleasePiece[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "releaseParticipants",
      optionalMissing: true,
      load: () => supabase.from("technical_release_participants").select("*").order("created_at"),
      apply: (target, data) => {
        target.releaseParticipants = data as TechnicalReleaseParticipant[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "corrections",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("technical_corrections").select("*");
        return filters.contractId ? query.eq("contract_id", filters.contractId) : query.order("due_date");
      },
      apply: (target, data) => {
        target.corrections = data as TechnicalCorrection[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "prodBatches",
      optionalMissing: true,
      load: () => {
        let query = supabase.from("technical_prod_batches").select("*");
        if (filters.contractId) query = query.eq("contract_id", filters.contractId);
        if (filters.prodBatchId) query = query.eq("id", filters.prodBatchId);
        return query.order("created_at", { ascending: false });
      },
      apply: (target, data) => {
        target.prodBatches = data as TechnicalProdBatch[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "prodBatchPieces",
      optionalMissing: true,
      load: () => supabase.from("technical_prod_batch_pieces").select("*"),
      apply: (target, data) => {
        target.prodBatchPieces = data as TechnicalProdBatchPiece[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "prodDocuments",
      optionalMissing: true,
      load: () => supabase.from("technical_prod_documents").select("*").order("created_at", { ascending: false }),
      apply: (target, data) => {
        target.prodDocuments = data as TechnicalProdDocument[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "deliveries",
      optionalMissing: true,
      load: () => supabase.from("technical_department_deliveries").select("*").order("created_at", { ascending: false }),
      apply: (target, data) => {
        target.deliveries = data as TechnicalDepartmentDelivery[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "doubts",
      optionalMissing: true,
      load: () => supabase.from("technical_doubts").select("*").order("created_at", { ascending: false }),
      apply: (target, data) => {
        target.doubts = data as TechnicalDoubt[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "notifications",
      optionalMissing: true,
      load: () => supabase.from("platform_notifications").select("*").is("read_at", null).order("created_at", { ascending: false }).limit(30),
      apply: (target, data) => {
        target.notifications = data as PlatformNotification[];
      },
    });
    addSnapshotQuery(queries, include, {
      key: "auditLogs",
      optionalMissing: true,
      load: () => {
        const query = supabase.from("audit_logs").select("*");
        return filters.contractId
          ? query.eq("entity_id", filters.contractId).order("created_at", { ascending: false }).limit(100)
          : query.order("created_at", { ascending: false }).limit(100);
      },
      apply: (target, data) => {
        target.auditLogs = data as TechnicalAuditLog[];
      },
    });

    const results = await Promise.all(queries.map((query) => query.load()));
    const failedResult = results.find((result, index) => {
      const query = queries[index];
      return Boolean(result.error && !(query.optionalMissing && isMissingRelation(result.error)));
    });

    if (failedResult?.error) {
      console.error("Falha ao consultar Supabase", failedResult.error);
      return snapshot;
    }

    results.forEach((result, index) => {
      if (result.error) return;
      queries[index].apply(snapshot, result.data ?? []);
    });

    return snapshot;
  } catch (error) {
    console.error("Falha ao carregar dados técnicos", error);
    return snapshot;
  }
}

export async function getTechnicalDashboardData() {
  return loadTechnicalSnapshot(
    includeKeys([
      "clients",
      "profiles",
      "contracts",
      "technicalContracts",
      "pieces",
      "meetings",
      "stageValidations",
      "stageValidationParticipants",
      "actions",
      "visits",
      "corrections",
      "prodBatches",
      "deliveries",
      "doubts",
      "notifications",
    ]),
  );
}

export async function getTechnicalContractsData() {
  return loadTechnicalSnapshot(
    includeKeys(["clients", "profiles", "contracts", "technicalContracts", "pieces", "actions", "visits", "corrections", "prodBatches"]),
  );
}

export async function getTechnicalContractDetailData(contractId: string) {
  return loadTechnicalSnapshot(
    includeKeys([
      "clients",
      "profiles",
      "contracts",
      "technicalContracts",
      "pieces",
      "meetings",
      "stageValidations",
      "stageValidationParticipants",
      "actions",
      "visits",
      "visitPieces",
      "releases",
      "releasePieces",
      "releaseParticipants",
      "corrections",
      "prodBatches",
      "prodBatchPieces",
      "prodDocuments",
      "deliveries",
      "doubts",
      "auditLogs",
    ]),
    { contractId },
  );
}

export async function getTechnicalOperationalData() {
  return loadTechnicalSnapshot(
    includeKeys([
      "clients",
      "profiles",
      "contracts",
      "technicalContracts",
      "pieces",
      "actions",
      "visits",
      "releases",
      "releasePieces",
      "releaseParticipants",
      "corrections",
      "prodBatches",
      "prodBatchPieces",
      "prodDocuments",
      "deliveries",
      "doubts",
    ]),
  );
}

export function buildContractOverviews(snapshot: TechnicalSnapshot): TechnicalContractOverview[] {
  return snapshot.contracts.map((contract) => ({
    contract,
    client: snapshot.clients.find((client) => client.id === contract.client_id) ?? null,
    technical:
      snapshot.technicalContracts.find((technical) => technical.contract_id === contract.id) ?? null,
    pieces: snapshot.pieces.filter((piece) => piece.contract_id === contract.id),
    actions: snapshot.actions.filter((action) => action.contract_id === contract.id),
    visits: snapshot.visits.filter((visit) => visit.contract_id === contract.id),
    corrections: snapshot.corrections.filter((correction) => correction.contract_id === contract.id),
    prodBatches: snapshot.prodBatches.filter((prod) => prod.contract_id === contract.id),
    doubts: snapshot.doubts.filter((doubt) => doubt.contract_id === contract.id),
  }));
}
