import { describe, expect, it } from "vitest";
import { parseTechnicalContractText } from "./technical-pdf";

describe("parseTechnicalContractText", () => {
  it("extracts contract data and pieces for human review", () => {
    const result = parseTechnicalContractText(`
      Contrato: C21-2026-001
      Cliente: Alumínio Teste Ltda
      Data do contrato: 29/07/2026
      Endereço da obra: Rua 10, Quadra 02, Lote 03
      Obra: Edifício Central
      Prazo: 10 dias úteis
      Responsáveis autorizados
      Maria Técnica - Engenharia (62) 99999-0000
      Peças
      J01 Tipo: Janela Qtde 2 1200x1500 Ambiente: Sala Vidro: Incolor Cor: Preto Linha: Gold
      P02 Tipo: Porta Quantidade: 1 900x2100 Ambiente: Varanda Vidro: Laminado Cor: Branco Linha: Prime
    `);

    expect(result.contract).toMatchObject({
      contract_number: "C21-2026-001",
      client_name: "Alumínio Teste Ltda",
      contract_date: "2026-07-29",
      deadline_value: 10,
      deadline_unit: "dias_uteis",
      work_name: "Edifício Central",
    });
    expect(result.contract.authorized_contacts[0]?.name).toContain("Maria Técnica");
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces[0]).toMatchObject({
      code: "J01",
      quantity: 2,
      sale_width_mm: 1200,
      sale_height_mm: 1500,
      environment: "Sala Vidro: Incolor Cor: Preto Linha: Gold",
    });
  });

  it("emits warnings when minimum data is missing", () => {
    const result = parseTechnicalContractText("Documento sem estrutura conhecida");
    expect(result.warnings).toContain("Número do contrato não identificado.");
    expect(result.warnings).toContain("Cliente não identificado.");
    expect(result.warnings).toContain("Nenhuma peça foi identificada nos desenhos anexados.");
  });
});
