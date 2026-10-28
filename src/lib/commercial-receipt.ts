import { z } from "zod";
import { manualContractSchema } from "@/lib/schemas";
import { parseCommercialEntry } from "@/lib/commercial-entry";

const text = z.string().max(5000);
export const receiptDataSchema = z.object({
  contract_number: text, client_name: text, work_name: text, full_address: text,
  city: text, state: text, contract_date: text, contractual_deadline_value: text,
  contractual_deadline_unit: z.enum(["dias_corridos", "dias_uteis"]), description: text,
  contacts: z.array(z.object({name: z.string().max(150), role: z.string().max(100), phone: z.string().max(100)})).max(30),
  deliveryDate: text, dateUnknown: z.boolean(),
});
export const receiptPieceSchema = z.object({
  id: z.string().uuid(), code: z.string().max(100), environment: z.string().max(500),
  piece_type: z.string().max(500), quantity: z.number().int().min(1).max(100000),
  sale_width_mm: z.number().positive().nullable(), sale_height_mm: z.number().positive().nullable(),
  description: text, glass: text, color: text, line: text,
});
export const receiptDraftSchema = z.object({
  step: z.number().int().min(0).max(2), data: receiptDataSchema,
  pieces: z.array(receiptPieceSchema).max(2000), checkedIds: z.array(z.string().uuid()).max(2000),
  dataChecked: z.boolean(), drawingChecked: z.boolean(), reference: z.string().max(2000), notes: text,
});
export type ReceiptDraft = z.infer<typeof receiptDraftSchema>;
export type ReceiptData = ReceiptDraft["data"];
export type ReceiptPiece = ReceiptDraft["pieces"][number];
export type CommercialReceipt = {
  status: "pending" | "applying" | "completed"; version: number; owner: string; ownerName: string;
  dueAt: string; startedAt: string; updatedAt: string; completedAt?: string; completedBy?: string;
  draft: ReceiptDraft; history: Array<{at:string; by:string; event:string; version:number}>;
};
export function readReceipt(data: Record<string, unknown> | null | undefined): CommercialReceipt | null {
  const value = data?.receipt as CommercialReceipt | undefined;
  return value && typeof value.version === "number" && value.draft && ["pending", "applying", "completed"].includes(value.status) ? value : null;
}
export function receiptDueAt(now: Date, holidays: string[]) {
  const day = new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo", year:"numeric", month:"2-digit", day:"2-digit"}).format(now);
  const date = new Date(`${day}T12:00:00Z`);
  do { date.setUTCDate(date.getUTCDate()+1); } while ([0,6].includes(date.getUTCDay()) || holidays.includes(date.toISOString().slice(0,10)));
  return `${date.toISOString().slice(0,10)}T17:30:00-03:00`;
}
export function validateReceiptCompletion(draft: ReceiptDraft) {
  const data = manualContractSchema.parse(draft.data);
  const form = new FormData();
  for (const contact of draft.data.contacts) { form.append("work_contact_name",contact.name); form.append("work_contact_role",contact.role); form.append("work_contact_phone",contact.phone); }
  if (draft.data.dateUnknown) form.set("delivery_date_unknown","on"); else form.set("commercial_delivery_date",draft.data.deliveryDate);
  const commercial = parseCommercialEntry(form);
  if (!draft.dataChecked) throw new Error("Confira os dados da obra antes de concluir.");
  if (!draft.pieces.length) throw new Error("Inclua as peças recebidas antes de concluir.");
  if (!draft.reference.trim() || !draft.drawingChecked) throw new Error("Informe a referência do desenho e confirme sua conferência.");
  const codes = new Set<string>(); const ids = new Set<string>();
  for (const piece of draft.pieces) {
    const code = piece.code.trim().toLocaleLowerCase("pt-BR");
    if (!code || !piece.environment.trim() || !piece.piece_type.trim()) throw new Error("Informe código, ambiente e modelo de todas as peças.");
    if (codes.has(code) || ids.has(piece.id)) throw new Error("Existem peças repetidas na conferência.");
    codes.add(code); ids.add(piece.id);
    if (!draft.checkedIds.includes(piece.id)) throw new Error("Confira todas as peças antes de concluir.");
  }
  return {data, commercial};
}
