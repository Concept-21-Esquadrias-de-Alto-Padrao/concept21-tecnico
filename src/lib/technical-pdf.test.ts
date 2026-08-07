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

  it("extracts SmartCEM tabular rows without explicit piece codes", () => {
    const result = parseTechnicalContractText(`
      CONTRATO COMERCIAL
      NOME DO CLIENTE:
      Manuel André Rodriguez Cala
      Nº DO CONTRATO
      26-0771
      ENDEREÇO DA OBRA
      Rua Pomerol
      Qd.13 Lt.07
      Jardins França
      Goiânia - Go

      CONTRATO Nº: 26-0771
      Goiânia, 06 de agosto de 2026.
      CONTRATANTE OBRA DATA NASCIMENTO
      MANUEL ANDRÉ RODRIGUEZ CALA RESIDENCIAL 21/03/1962
      ENDEREÇO DA OBRA CEP’
      RUA POMEROL, QD.13 LT.07, JARDINS FRANÇA, GOIÂNIA - GO 74.886-154
      VENDEDOR TELEFONE
      EDUARDO RODRIGUES (62) 98118-5701
      2.1. O Investimento é de R$ 56.484,04
      NOME RESPONSABILIDADE TELEFONE - EMAIL
      Manuel André Rodriguez Cala Construtor (62) 9 8240-1333
      5.2. O prazo de entrega das esquadrias é de:
      Até 60 dias úteis, sendo este prazo estipulado somente após a validação das liberações.

      Proposta Nº
      26-0771
      MANUEL ANDRÉ RODRIGUEZ CALA
      Emitido por ADYNA FERREIRA em 06/08/2026, às 08:32
      BRISE CORRER 3 FOLHAS - MUXARABI RIPADO 20X20MM - ESPAÇAMENTO DE 20MM
      Acabamento: PINTURA CORTEN
      Área Esquadria:12,70m²Área Vidro:-
      Vidros: sem vidro
      Tipo:Linha:L:H:Qtd:
      BZ - MUX
      20X20
      50782500CONCEPT LINE 501
      Localização:
      GARAGEM
      PAINEL FIXO COM TUBOS MUXARABI 20X20MM COM ESPAÇAMENTO 20 SOMENTE LADO
      EXTERNO
      Acabamento: PINTURA CORTEN
      Área Esquadria:4,00m²Área Vidro:-
      Sem Vidros
      Tipo:Linha:L:H:Qtd:
      FIXOS - MUX
      20X20
      8002500BRISE2
      Localização:
      RIPASOS LATERAIS
      PORTA PIVOTANTE MUXARABI RIPADO MUXARABI - TUBOS 20X20 MM REVESTIDO LADO
      INTERNO E EXTERNO - ESPAÇAMENTO DE 20MM
      FECHADURA POR CONTA DO CLIENTE
      Acabamento: PINTURA CORTEN
      Área Esquadria:3,50m²Área Vidro:-
      Vidros: sem vidro
      Tipo:Linha:L:H:Qtd:
      PT - MUX -
      20X20
      14002500CONCEPT LINE1
      Localização:
      PORTÃO
      Obra: 26-0771 - MANUEL ANDRÉ RODRIGUEZ CALA
    `);

    expect(result.warnings).toEqual([]);
    expect(result.contract).toMatchObject({
      contract_number: "26-0771",
      client_name: "Manuel André Rodriguez Cala",
      contract_date: "2026-08-06",
      deadline_value: 60,
      deadline_unit: "dias_uteis",
      work_name: "RESIDENCIAL",
    });
    expect(result.contract.work_address).toBe(
      "RUA POMEROL, QD.13 LT.07, JARDINS FRANÇA, GOIÂNIA - GO",
    );
    expect(result.contract.commercial_data.cep_obra).toBe("74886-154");
    expect(result.contract.authorized_contacts).toEqual([
      { name: "Manuel André Rodriguez Cala", role: "Construtor", phone: "(62) 9 8240-1333" },
    ]);

    expect(result.pieces).toHaveLength(3);
    expect(result.pieces[0]).toMatchObject({
      code: "26-0771-BZ-MUX-20X20-01",
      quantity: 1,
      sale_width_mm: 5078,
      sale_height_mm: 2500,
      environment: "GARAGEM",
      glass: "sem vidro",
      color: "PINTURA CORTEN",
      line: "CONCEPT LINE 50",
      piece_type: "BRISE CORRER 3 FOLHAS - MUXARABI RIPADO 20X20MM - ESPAÇAMENTO DE 20MM",
    });
    expect(result.pieces[1]).toMatchObject({
      code: "26-0771-FIXOS-MUX-20X20-02",
      quantity: 2,
      sale_width_mm: 800,
      sale_height_mm: 2500,
      environment: "RIPASOS LATERAIS",
      line: "BRISE",
    });
    expect(result.pieces[2]).toMatchObject({
      code: "26-0771-PT-MUX-20X20-03",
      quantity: 1,
      sale_width_mm: 1400,
      sale_height_mm: 2500,
      environment: "PORTÃO",
      line: "CONCEPT LINE",
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
