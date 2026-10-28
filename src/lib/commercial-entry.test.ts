import { describe, expect, it } from "vitest";
import { mergeReimportCommercialData, parseCommercialEntry } from "./commercial-entry";

function entry(date = "2027-03-10") {
  const f = new FormData();
  f.append("work_contact_name", " Maria ");
  f.append("work_contact_role", "Proprietária");
  f.append("work_contact_phone", "(62) 99999-1234");
  if (date) f.set("commercial_delivery_date", date);
  return f;
}

describe("entrada comercial", () => {
  it("mantém várias pessoas e a data de necessidade sem calcular prazo contratual", () => {
    const f = entry();
    f.append("work_contact_name", "João"); f.append("work_contact_role", "Engenheiro"); f.append("work_contact_phone", "(62) 99999-5678");
    expect(parseCommercialEntry(f)).toEqual({ contacts: [
      {name: "Maria", role: "Proprietária", phone: "(62) 99999-1234"},
      {name: "João", role: "Engenheiro", phone: "(62) 99999-5678"},
    ], deliveryDate: "2027-03-10", dateUnknown: false });
  });
  it("permite data desconhecida explicitamente, sem fabricar previsão", () => {
    const f = entry(""); f.set("delivery_date_unknown", "on");
    expect(parseCommercialEntry(f).deliveryDate).toBeNull();
    expect(parseCommercialEntry(f).dateUnknown).toBe(true);
  });
  it.each(["", "2026-02-30", "2026-13-01", "2026-2-1", "0000-01-01"])("recusa data inválida %s no servidor", date => expect(() => parseCommercialEntry(entry(date))).toThrow());
  it("aceita data bissexta válida", () => expect(parseCommercialEntry(entry("2028-02-29")).deliveryDate).toBe("2028-02-29"));
  it("recusa desconhecida e preenchida ao mesmo tempo", () => {
    const f = entry(); f.set("delivery_date_unknown", "on"); expect(() => parseCommercialEntry(f)).toThrow();
  });
  it("recusa responsável incompleto e listas desalinhadas", () => {
    const f = entry(); f.set("work_contact_role", " "); expect(() => parseCommercialEntry(f)).toThrow();
    f.delete("work_contact_phone"); expect(() => parseCommercialEntry(f)).toThrow();
  });
  it("recusa ausência de pessoas", () => expect(() => parseCommercialEntry(new FormData())).toThrow());
  it("preserva informações conferidas ao reprocessar PDF", () => {
    expect(mergeReimportCommercialData({delivery_date_unknown:false, origem_cadastro:"manual", observacao:"Conferida"}, {delivery_date_unknown:true, observacao:"Antiga", acabamento:"Branco"}, "agora")).toEqual({delivery_date_unknown:false, observacao:"Conferida", acabamento:"Branco", origem_cadastro:"pdf", ultima_reimportacao_pdf_em:"agora"});
  });
});
