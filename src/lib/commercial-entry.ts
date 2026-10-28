import { z } from "zod";

const contactSchema = z.object({
  name: z.string().trim().min(1, "Informe o nome de cada responsável.").max(150),
  role: z.string().trim().min(1, "Informe a função de cada responsável.").max(100),
  phone: z.string().trim().min(1, "Informe o contato de cada responsável.").max(100),
});

export type CommercialContact = z.infer<typeof contactSchema>;

export function parseCommercialEntry(form: FormData) {
  const names = form.getAll("work_contact_name");
  const roles = form.getAll("work_contact_role");
  const phones = form.getAll("work_contact_phone");
  if (names.length !== roles.length || names.length !== phones.length) {
    throw new Error("Os contatos estão incompletos. Revise os responsáveis pela obra.");
  }
  const contacts = z.array(contactSchema).min(1, "Informe pelo menos um responsável pela obra.").max(30).parse(
    names.map((name, index) => ({ name, role: roles[index], phone: phones[index] })),
  );
  const unknown = form.get("delivery_date_unknown") === "on";
  const rawDate = form.get("commercial_delivery_date");
  const date = typeof rawDate === "string" ? rawDate.trim() : "";
  if (unknown && date) throw new Error("Informe a previsão ou marque que ela ainda não foi informada, sem preencher as duas opções.");
  if (!unknown && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01" || date > "9999-12-31" || Number.isNaN(Date.parse(`${date}T12:00:00Z`)) || new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date)) {
    throw new Error("Informe uma previsão de entrega válida ou marque que a data ainda não foi informada.");
  }
  return { contacts, deliveryDate: unknown ? null : date, dateUnknown: unknown };
}

// Reimportar um desenho não substitui dados já conferidos pela equipe.
export function mergeReimportCommercialData(existing: Record<string, unknown>, imported: Record<string, unknown>, now: string) {
  return { ...imported, ...existing, origem_cadastro: "pdf", ultima_reimportacao_pdf_em: now };
}
