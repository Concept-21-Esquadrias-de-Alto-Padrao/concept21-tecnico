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
      environment: "Sala",
      glass: "Incolor",
      color: "Preto",
      line: "Gold",
    });
  });

  it("extracts split cover fields and SmartCEM collapsed piece rows", () => {
    const result = parseTechnicalContractText(`
      CONTRATO COMERCIAL
      NOME DO CLIENTE:
      Sérgio de Britto Pereira
      Nº DO CONTRATO
      26-0721
      ENDEREÇO DA OBRA
      Rua Macon, Qd.23 Lt.19
      Cond. Jardins França
      Goiânia – GO.

      CONTRATO Nº: 26-0721
      Goiânia, 31 de julho de 2026.
      CONTRATANTE OBRA DATA NASCIMENTO
      SÉRGIO DE BRITTO PEREIRA RESIDENCIAL 08/06/1977
      ENDEREÇO DA OBRA CEP’
      RUA MACON QD.23 LT.19, COND. JARDINS FRANÇA, GOIÂNIA - GO 74886-182
      5.2. O prazo de entrega das esquadrias é de:
      Até 90 dias corridos, sendo este prazo estipulado somente após a validação das liberações.
      NOME RESPONSABILIDADE TELEFONE - EMAIL
      Sérgio de Britto Proprietário (62) 9 8592-9760
      Arq. Carolina Fontes Proprietária (62) 9 8117-3710
      4.2. Após a confirmação do pagamento da entrada

      Proposta Nº
      26-0721
      SÉRGIO DE BRITTO PEREIRA
      PORTA DE GIRO 1 FOLHA DE VENEZIANA CEGA - MARCO TRADICIONAL COM 45MM
      Acabamento: PINTURA BEGE CAPPUCCINO
      Área Esquadria:1,93m²Área Vidro:-
      Vidros: sem vidro
      Tipo:Linha:L:H:Qtd:
      P06_A9002140GOLD1
      Localização:
      GARAGEM
      QUADRO FIXO DE VIDRO - SEM DIVISÃO
      Acabamento: PINTURA BEGE CAPPUCCINO
      Área Esquadria:4,25m²Área Vidro:4,25 m²
      Vidros: TEMPERADO DE 8 MM incolor
      Tipo:Linha:L:H:Qtd:
      J02_A17002500QUADRO FIXO1
      Localização:
      SALA DE ESTAR
      JANELA MAXIM-AR COM 1 FOLHA(S)
      Acabamento: PINTURA BEGE CAPPUCCINO
      Área Esquadria:1,69m²Área Vidro:1,47 m²
      Vidros: MINEBOREAL DE 4 MM incolor
      Tipo:Linha:L:H:Qtd:
      J04_C750750SUPREMA3
      Localização:
      BANHO MASTER
    `);

    expect(result.contract).toMatchObject({
      contract_number: "26-0721",
      client_name: "Sérgio de Britto Pereira",
      contract_date: "2026-07-31",
      deadline_value: 90,
      deadline_unit: "dias_corridos",
      work_name: "RESIDENCIAL",
    });
    expect(result.contract.work_address?.toUpperCase()).toContain("RUA MACON");
    expect(result.contract.work_address?.toUpperCase()).toContain("JARDINS FRANÇA");
    expect(result.contract.authorized_contacts).toEqual([
      { name: "Sérgio de Britto", role: "Proprietário", phone: "(62) 9 8592-9760" },
      { name: "Arq. Carolina Fontes", role: "Proprietária", phone: "(62) 9 8117-3710" },
    ]);

    expect(result.pieces).toHaveLength(3);
    expect(result.pieces[0]).toMatchObject({
      code: "P06_A",
      quantity: 1,
      sale_width_mm: 900,
      sale_height_mm: 2140,
      line: "GOLD",
      environment: "GARAGEM",
      glass: "sem vidro",
      color: "PINTURA BEGE CAPPUCCINO",
      piece_type: "PORTA DE GIRO 1 FOLHA DE VENEZIANA CEGA - MARCO TRADICIONAL COM 45MM",
    });
    expect(result.pieces[1]).toMatchObject({
      code: "J02_A",
      sale_width_mm: 1700,
      sale_height_mm: 2500,
      line: "QUADRO FIXO",
      environment: "SALA DE ESTAR",
      glass: "TEMPERADO DE 8 MM incolor",
    });
    expect(result.pieces[2]).toMatchObject({
      code: "J04_C",
      quantity: 3,
      sale_width_mm: 750,
      sale_height_mm: 750,
      line: "SUPREMA",
      environment: "BANHO MASTER",
    });
  });

  it("emits warnings when minimum data is missing", () => {
    const result = parseTechnicalContractText("Documento sem estrutura conhecida");
    expect(result.warnings).toContain("Número do contrato não identificado.");
    expect(result.warnings).toContain("Cliente não identificado.");
    expect(result.warnings).toContain("Endereço da obra não identificado.");
    expect(result.warnings).toContain("Nenhuma peça foi identificada nos desenhos anexados.");
  });
});
