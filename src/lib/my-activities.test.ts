import { describe, expect, it } from "vitest";
import { buildMyActivities, type MyActivitiesSource } from "./my-activities";
import { TECHNICAL_PERMISSIONS } from "./module-access";
import type { TechnicalContractStageKey } from "./types";

const identity = { companyId: "company", profileId: "me" };
const access = { isMaster: false, permissions: Object.fromEntries(TECHNICAL_PERMISSIONS.map((key) => [key, true])) };
function source(): MyActivitiesSource {
  return {
    contracts: [{ id: "contract", company_id: "company", active: true, contract_number: "26-0715", work_name: "Beoos" }],
    technicalContracts: [{ company_id: "company", contract_id: "contract", commercial_folder_received: false, deleted_at: null }],
    actions: [{ id: "a", company_id: "company", contract_id: "contract", title: "Visitar obra", responsible_profile_id: "me", due_date: "2020-01-01", status: "aberta", blocking: true, deleted_at: null }],
    corrections: [], validations: [], stageParticipants: [], releases: [], releaseParticipants: [],
    completedMeetings: [], meetingSignatures: [], performedVisits: [], openActions: [], openCorrections: [], approvedProds: [], openDoubts: [],
  };
}
function assignStage(data: MyActivitiesSource, stage: TechnicalContractStageKey) {
  data.validations.push({ company_id: "company", contract_id: "contract", stage, validation_required: true });
  data.stageParticipants.push({ id: stage, company_id: "company", contract_id: "contract", stage, profile_id: "me", signed_at: null });
}

describe("personal activity projection", () => {
  it("only includes personal assignments, even for an administrator", () => {
    const data = source();
    data.actions.push({ ...data.actions[0], id: "other", responsible_profile_id: "another" }, { ...data.actions[0], id: "unassigned", responsible_profile_id: null }, { ...data.actions[0], id: "tenant", company_id: "another" });
    expect(buildMyActivities(data, identity, { isMaster: true, permissions: {} }).map((row) => row.id)).toEqual(["action-a"]);
  });
  it("excludes closed, cancelled, deleted and inactive contract records", () => {
    const data = source();
    data.actions.push({ ...data.actions[0], id: "closed", status: "concluida" }, { ...data.actions[0], id: "cancelled", status: "cancelada" }, { ...data.actions[0], id: "deleted", deleted_at: "today" });
    expect(buildMyActivities(data, identity, access)).toHaveLength(1);
    data.contracts[0].active = false;
    expect(buildMyActivities(data, identity, access)).toEqual([]);
    data.contracts[0].active = true;
    data.technicalContracts[0].deleted_at = "today";
    expect(buildMyActivities(data, identity, access)).toEqual([]);
  });
  it("keeps validated actions pending until conclusion and updates assignment immediately", () => {
    const data = source();
    data.actions[0].status = "validada";
    expect(buildMyActivities(data, identity, access)[0].nextStep).toContain("Concluir");
    data.actions[0].status = "concluida";
    expect(buildMyActivities(data, identity, access)).toEqual([]);
    data.actions[0].status = "aberta";
    data.actions[0].responsible_profile_id = "another";
    expect(buildMyActivities(data, identity, access)).toEqual([]);
  });
  it("preserves type permissions and uses the actions page when contracts are not accessible", () => {
    const data = source();
    expect(buildMyActivities(data, identity, { isMaster: false, permissions: {} })).toEqual([]);
    const [item] = buildMyActivities(data, identity, { isMaster: false, permissions: { "technical.actions.view": true } });
    expect(item).toMatchObject({ available: false, href: "/tecnico/acoes#atividade-action-a" });
    expect(item.nextStep).toContain("permissão");
  });
  it("includes only pending assigned corrections and links to the exact record", () => {
    const data = source();
    data.actions = [];
    const correction = { id: "c", company_id: "company", contract_id: "contract", type: "Ajustar peça", responsible_profile_id: "me", due_date: null, status: "aberta" as const, blocking: true, deleted_at: null };
    data.corrections = [correction, { ...correction, id: "other", responsible_profile_id: "other" }, { ...correction, id: "closed", status: "encerrada" }];
    expect(buildMyActivities(data, identity, access)).toMatchObject([{ kind: "correction", href: "/tecnico/contratos/contract#atividade-correction-c", available: true }]);
  });
  it.each([
    ["entrada_comercial", null], ["reuniao_ata", "completedMeetings"], ["visitas", "performedVisits"], ["prods", "approvedProds"],
  ] as const)("waits for the prerequisite of %s before offering a signature", (stage, fact) => {
    const data = source();
    data.actions = [];
    assignStage(data, stage);
    expect(buildMyActivities(data, identity, access)[0]).toMatchObject({ available: false, dueDate: null });
    if (fact) data[fact].push("contract");
    else {
      data.technicalContracts[0].commercial_folder_received = true;
      data.completedMeetings = ["contract"];
    }
    expect(buildMyActivities(data, identity, access)[0]).toMatchObject({ available: true, href: `/tecnico/contratos/contract#assinatura-${stage}` });
  });
  it.each([["acoes", "openActions"], ["correcoes", "openCorrections"], ["duvidas", "openDoubts"]] as const)("waits for everyone's open work in %s", (stage, fact) => {
    const data = source();
    data.actions = [];
    assignStage(data, stage);
    data[fact] = ["contract"];
    expect(buildMyActivities(data, identity, access)[0].available).toBe(false);
    data[fact] = [];
    expect(buildMyActivities(data, identity, access)[0].available).toBe(true);
  });
  it("removes signed and disabled stage assignments and restores reopened signatures", () => {
    const data = source();
    data.actions = [];
    assignStage(data, "entrada_comercial");
    data.stageParticipants[0].signed_at = "today";
    expect(buildMyActivities(data, identity, access)).toEqual([]);
    data.stageParticipants[0].signed_at = null;
    expect(buildMyActivities(data, identity, access)).toHaveLength(1);
    data.validations[0].validation_required = false;
    expect(buildMyActivities(data, identity, access)).toEqual([]);
  });
  it("waits for all meeting signatures before an existing folder can be signed", () => {
    const data = source();
    data.actions = [];
    assignStage(data, "entrada_comercial");
    data.technicalContracts[0].commercial_folder_received = true;
    data.validations.push({ company_id: "company", contract_id: "contract", stage: "reuniao_ata", validation_required: true });
    expect(buildMyActivities(data, identity, access)[0].available).toBe(false);
    data.completedMeetings = ["contract"];
    expect(buildMyActivities(data, identity, access)[0].available).toBe(false);
    data.meetingSignatures = [{ company_id: "company", contract_id: "contract", signed_at: "today" }, { company_id: "company", contract_id: "contract", signed_at: null }];
    expect(buildMyActivities(data, identity, access)[0].nextStep).toContain("assinaturas da reunião");
    data.meetingSignatures[1].signed_at = "today";
    expect(buildMyActivities(data, identity, access)[0].available).toBe(true);
  });
  it("treats each release batch independently, without demanding all pieces or the stage signature", () => {
    const data = source();
    data.actions = [];
    assignStage(data, "pecas_medicoes_liberacoes");
    data.releases = ["1", "2", "3"].map((id) => ({ id, company_id: "company", contract_id: "contract", batch_number: `Lote ${id}`, status: "aguardando_assinatura", validation_required: true }));
    data.releaseParticipants = data.releases.map((release) => ({ id: release.id, company_id: "company", release_id: release.id, profile_id: "me", signed_at: release.id === "1" ? "today" : null }));
    data.releases[2].status = "cancelado";
    expect(buildMyActivities(data, identity, access)).toMatchObject([{ id: "release-2", available: true, dueDate: null, href: "/tecnico/contratos/contract#lote-2" }]);
    data.releases[1].validation_required = false;
    expect(buildMyActivities(data, identity, access)).toEqual([]);
  });
  it("does not expose another participant or company through signatures", () => {
    const data = source();
    data.actions = [];
    assignStage(data, "entrada_comercial");
    data.stageParticipants[0].profile_id = "another";
    expect(buildMyActivities(data, identity, access)).toEqual([]);
    data.stageParticipants[0].profile_id = "me";
    data.validations[0].company_id = "another";
    expect(buildMyActivities(data, identity, access)).toEqual([]);
  });
});
