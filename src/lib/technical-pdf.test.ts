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
      code: "BZ - MUX 20X20",
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
      code: "FIXOS - MUX 20X20",
      quantity: 2,
      sale_width_mm: 800,
      sale_height_mm: 2500,
      environment: "RIPASOS LATERAIS",
      line: "BRISE",
    });
    expect(result.pieces[2]).toMatchObject({
      code: "PT - MUX - 20X20",
      quantity: 1,
      sale_width_mm: 1400,
      sale_height_mm: 2500,
      environment: "PORTÃO",
      line: "CONCEPT LINE",
    });
  });

  it("extracts SmartCEM vertical label blocks from PDF text extraction", () => {
    const result = parseTechnicalContractText(`
      CONTRATO Nº: 26 -0771
      Goiânia, 0 6 de agosto de 202 6 .
      CONTRATANTE OBRA DATA NASCIMENTO
      MANUEL ANDRÉ RODRIGUEZ CALA RESIDENCIAL 21 /03/1962
      ENDEREÇO DA OBRA CEP ’
      R UA POMEROL , QD.13 LT.07, JARDINS FRANÇA , GOIÂNIA - GO 74 . 886 -1 54
      VENDEDOR TELEFONE
      EDUA R DO RODRIGUES (62 ) 98118 -5701
      NOME RESPONSABILIDADE TELEFONE - EMAIL
      Manuel André Rodriguez Cala Construtor (62) 9 8240 -1333
      5.2. O prazo de entrega das esquadrias é de:
      Até 60 dias úteis, sendo este prazo estipulado somente após a validação das liberações.

      Proposta Nº
      26 -0771
      MANUEL ANDRÉ RODRIGUEZ CALA
      BRISE CORRER RIPADO 3 FOLHAS - MUXARABI RIPADO 20X20MM - 20MM - RIPADO NA -
      Acabamento: PINTURA CORTEN
      Vidros: sem vidro
      Área Esquadria: 12,70m² Área Vidro: -
      Tipo:
      BZ - MUX
      20X20
      Qtd:
      1
      L:
      5078
      H:
      2500
      Linha:
      CONCEPT LINE 50
      Localização:
      GARAGEM
      PAINEL FIXO COM TUBOS MUXARABI 20X20MM COM ESPAÇAMENTO 20 SOMENTE LADO
      EXTERNO
      Acabamento: PINTURA CORTEN
      Sem Vidros
      Área Esquadria: 2,00m² Área Vidro: -
      Tipo:
      FIXOS - MUX
      20X20_A
      Qtd:
      1
      L:
      800
      H:
      2500
      Linha:
      BRISE
      Localização:
      RIPASOS LATERAIS
      Obra: 26 -0771 - MANUEL ANDRÉ RODRIGUEZ CALA
    `);

    expect(result.warnings).toEqual([]);
    expect(result.contract).toMatchObject({
      contract_number: "26-0771",
      client_name: "MANUEL ANDRÉ RODRIGUEZ CALA",
      contract_date: "2026-08-06",
      deadline_value: 60,
      deadline_unit: "dias_uteis",
      work_address: "RUA POMEROL, QD.13 LT.07, JARDINS FRANÇA, GOIÂNIA - GO",
      work_name: "RESIDENCIAL",
    });
    expect(result.contract.commercial_data.cep_obra).toBe("74886-154");
    expect(result.contract.authorized_contacts).toEqual([
      { name: "Manuel André Rodriguez Cala", role: "Construtor", phone: "(62) 9 8240-1333" },
    ]);
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces[0]).toMatchObject({
      code: "BZ - MUX 20X20",
      quantity: 1,
      sale_width_mm: 5078,
      sale_height_mm: 2500,
      line: "CONCEPT LINE 50",
      environment: "GARAGEM",
      glass: "sem vidro",
      color: "PINTURA CORTEN",
    });
    expect(result.pieces[1]).toMatchObject({
      code: "FIXOS - MUX 20X20_A",
      quantity: 1,
      sale_width_mm: 800,
      sale_height_mm: 2500,
      line: "BRISE",
      environment: "RIPASOS LATERAIS",
      glass: "sem vidro",
      color: "PINTURA CORTEN",
    });
  });

  it("keeps SmartCEM dimensions aligned and ignores loose numeric rows", () => {
    const result = parseTechnicalContractText(`
      CONTRATO NÂº: 26-0721
      Contato: ARQ. CAROL Telefone: 6298117-3710

      JANELA DE CORRER 2 FOLHAS
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: TEMPERADO DE 8 MM incolor
      Tipo:Linha:L:H:Qtd:
      J0120002250QUADRO FIXO1
      LocalizaÃ§Ã£o:
      JANELA DE CORRER 3 FOLHAS
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: TEMPERADO DE 8 MM incolor
      Tipo:Linha:L:H:Qtd:
      J0350001550QUADRO FIXO1
      LocalizaÃ§Ã£o:
      PORTA DE CORRER 2 FOLHAS
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: sem vidro
      Tipo:Linha:L:H:Qtd:
      P0730002300GOLD1
      LocalizaÃ§Ã£o:
      SUÃTE MASTER
      JANELA DE CORRER 2 FOLHAS
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: TEMPERADO DE 8 MM incolor
      Tipo:Linha:L:H:Qtd:
      J05_A18002000GOLD1
      LocalizaÃ§Ã£o:
      SUÃTE FILHAS
      J05_A118002000GOLD1
      LocalizaÃ§Ã£o:
      SUÃTES FILHAS
      PORTA DE GIRO 1 FOLHA
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: sem vidro
      Tipo:Linha:L:H:Qtd:
      P1320002000GOLD1
      LocalizaÃ§Ã£o:
      VARANDA
    `);

    expect(result.pieces).toHaveLength(6);
    expect(result.pieces.map((piece) => piece.code)).not.toContain("26-0721-03-08-202602-46-PM-TELEF-01");
    expect(result.pieces.find((piece) => piece.code === "J01")).toMatchObject({
      sale_width_mm: 2000,
      sale_height_mm: 2250,
    });
    expect(result.pieces.find((piece) => piece.code === "J03")).toMatchObject({
      sale_width_mm: 5000,
      sale_height_mm: 1550,
      environment: null,
    });
    expect(result.pieces.find((piece) => piece.code === "P07")).toMatchObject({
      sale_width_mm: 3000,
      sale_height_mm: 2300,
      environment: "SUÃTE MASTER",
      piece_type: "PORTA DE CORRER 2 FOLHAS",
    });
    expect(result.pieces.find((piece) => piece.code === "J05_A1")).toMatchObject({
      sale_width_mm: 1800,
      sale_height_mm: 2000,
    });
    expect(result.pieces.find((piece) => piece.code === "P13")).toMatchObject({
      sale_width_mm: 2000,
      sale_height_mm: 2000,
    });
  });

  it("extracts position-rendered SmartCEM rows with inline locations", () => {
    const result = parseTechnicalContractText(`
      CONTRATO NÂº: 26-0771
      PORTA DE GIRO 1 FOLHA
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: sem vidro
      Tipo: Qtd: L: H: Linha: LocalizaÃ§Ã£o:
      P06_A 1 900 2140 GOLD GARAGEM
      QUADRO FIXO DE VIDRO - SEM DIVISÃƒO
      Acabamento: PINTURA BEGE CAPPUCCINO
      Vidros: TEMPERADO DE 8 MM incolor
      Tipo: Qtd: L: H: Linha: LocalizaÃ§Ã£o:
      J02_A 1 1700 2500 QUADRO FIXO SALA DE ESTAR
      BRISE CORRER 3 FOLHAS - MUXARABI RIPADO 20X20MM
      Acabamento: PINTURA CORTEN
      Vidros: sem vidro
      BZ - MUX 1 5078 2500 CONCEPT LINE 50 GARAGEM
    `);

    expect(result.pieces).toHaveLength(3);
    expect(result.pieces[0]).toMatchObject({
      code: "P06_A",
      line: "GOLD",
      environment: "GARAGEM",
      sale_width_mm: 900,
      sale_height_mm: 2140,
    });
    expect(result.pieces[1]).toMatchObject({
      code: "J02_A",
      line: "QUADRO FIXO",
      environment: "SALA DE ESTAR",
      sale_width_mm: 1700,
      sale_height_mm: 2500,
      piece_type: "QUADRO FIXO DE VIDRO - SEM DIVISÃƒO",
    });
    expect(result.pieces[2]).toMatchObject({
      code: "BZ - MUX",
      line: "CONCEPT LINE 50",
      environment: "GARAGEM",
      sale_width_mm: 5078,
      sale_height_mm: 2500,
    });
  });

  it("uses SmartCEM type identifiers as piece codes and splits inline location", () => {
    const result = parseTechnicalContractText(`
      CONTRATO No: 26 -0710
      QUADRO FIXO DE VIDRO - COM DIVISAO - 4 MODULOS NA LARGURA - COM JUNTA SECA - 1
      MODULO NA ALTURA
      Acabamento: PINTURA CORTEN
      Vidros: TEMPERADO DE 6 MM incolor
      Area Esquadria: 4,90m2 Area Vidro: 5 m2
      Tipo: Qtd: L: H: Linha: Localizacao:
      FIX P1 1 4900 1000 QUADRO FIXO RECEPCAO
      PORTA DE CORRER DE VIDRO 2 PLANOS 4 FOLHAS - TRILHO EMBUTIDO MEIA LUA
      Acabamento: PINTURA CORTEN
      Vidros: TEMPERADO DE 8 MM incolor
      Area Esquadria: 14,70m2 Area Vidro: 12,88 m2
      Tipo: Qtd: L: H: Linha: Localizacao:
      P1 1 4900 3000 GOLD RECEPCAO
      PORTA DE CORRER DE VIDRO 2 PLANOS 4 FOLHAS
      Acabamento: PINTURA CORTEN
      Vidros: TEMPERADO DE 8 MM incolor
      Tipo: Qtd: L: H: Linha: Localizacao:
      P2 1 4500 3000 42 RECEPCAO
    `);

    expect(result.pieces).toHaveLength(3);
    expect(result.contract.contract_number).toBe("26-0710");
    expect(result.pieces[0]).toMatchObject({
      code: "FIX P1",
      line: "QUADRO FIXO",
      environment: "RECEPCAO",
      sale_width_mm: 4900,
      sale_height_mm: 1000,
    });
    expect(result.pieces[1]).toMatchObject({
      code: "P1",
      line: "GOLD",
      environment: "RECEPCAO",
      sale_width_mm: 4900,
      sale_height_mm: 3000,
    });
    expect(result.pieces[2]).toMatchObject({
      code: "P2",
      line: "42",
      environment: "RECEPCAO",
      sale_width_mm: 4500,
      sale_height_mm: 3000,
    });
  });

  it("extracts SmartCEM rows with spaced identifiers, hyphenated identifiers, and wide spans", () => {
    const result = parseTechnicalContractText(`
      Proposta No
      25-0080
      LEONCIO OLIVEIRA SOARES

      PORTA DE CORRER DE VIDRO 5 PLANOS 10 FOLHAS - TRILHO EMBUTIDO MEIA LUA
      Acabamento: PINTURA PRETO FOSCO ACETINADO
      Vidros: TEMPERADO DE 8 MM incolor
      Area Esquadria: 35,62m2 Area Vidro: 32,4 m2
      Tipo: Qtd: L: H: Linha: Localizacao:
      P14-01 1 13700 2600 GOLD VARANDA GOURMET

      PAINEL FIXO COM LAMBRIL VERTICAL RIPADO 30X15MM
      Acabamento: MADEIRA (COR A DEFINIR)
      Sem Vidros
      Area Esquadria: 13,80m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      RIP 1 1 2500 5520 BRISE FACHADA

      PAINEL FIXO COM LAMBRIL VERTICAL RIPADO 30X15MM
      Acabamento: MADEIRA (COR A DEFINIR)
      Sem Vidros
      Area Esquadria: 27,85m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      RIP 2 1 4720 5900 BRISE FACHADA
    `);

    expect(result.pieces).toHaveLength(3);
    expect(result.pieces[0]).toMatchObject({
      code: "P14-01",
      quantity: 1,
      sale_width_mm: 13700,
      sale_height_mm: 2600,
      line: "GOLD",
      environment: "VARANDA GOURMET",
      glass: "TEMPERADO DE 8 MM incolor",
      color: "PINTURA PRETO FOSCO ACETINADO",
      piece_type: "PORTA DE CORRER DE VIDRO 5 PLANOS 10 FOLHAS - TRILHO EMBUTIDO MEIA LUA",
    });
    expect(result.pieces[1]).toMatchObject({
      code: "RIP 1",
      quantity: 1,
      sale_width_mm: 2500,
      sale_height_mm: 5520,
      line: "BRISE",
      environment: "FACHADA",
      glass: "sem vidro",
      color: "MADEIRA (COR A DEFINIR)",
    });
    expect(result.pieces[2]).toMatchObject({
      code: "RIP 2",
      quantity: 1,
      sale_width_mm: 4720,
      sale_height_mm: 5900,
      line: "BRISE",
      environment: "FACHADA",
      piece_type: "PAINEL FIXO COM LAMBRIL VERTICAL RIPADO 30X15MM",
    });
  });

  it("normalizes spaced contract numbers, trims address leakage, and extracts fixed panel codes", () => {
    const result = parseTechnicalContractText(`
      NOME DO CLIENTE:
      Beoos Administradora e Empreendimentos LTDA -26 -0715
      No DO CONTRATO
      2 6 -0715
      ENDERECO DA OBRA CEP
      RUA IBICUI QD T6 LT 04 RESIDENCIAL ALPHAVILLE ARAGUAIA GOIANIA, GO. 74883080
      RESPONSAVEL TELEFONE - E-MAIL
      CRISTIANE (62)98111-9984

      Proposta No
      26-0715
      BEOOS ADMINISTRADORA E EMPREENDIMENTOS LTDA
      PAINEL FIXO COM LAMBRIL MUXARABI SOMENTE LADO EXTERNO
      Acabamento: PINTURA CORTEN
      Sem Vidros
      Area Esquadria: 19,39m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      FIXO 1 1 4910 3950 BRISE FACHADA
      PAINEL FIXO COM LAMBRIL MUXARABI SOMENTE LADO EXTERNO
      Acabamento: PINTURA CORTEN
      Sem Vidros
      Area Esquadria: 2,05m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      FIXO 2 1 520 3950 BRISE FACHADA LATERAL
      PAINEL FIXO COM LAMBRIL MUXARABI SOMENTE LADO EXTERNO
      Acabamento: PINTURA CORTEN
      Sem Vidros
      Area Esquadria: 1,75m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      FIXO 3 1 2160 810 BRISE FACHADA LATERAL
      PORTA PIVOTANTE DE LAMBRIL 150MM - MARCO 100X38MM COM VISTA DE 38MM
      Acabamento: PINTURA CORTEN
      Vidros: sem vidro
      Area Esquadria: 3,70m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      P1 1 1070 3460 CONCEPT LINE HALL DE ENTRADA
    `);

    expect(result.warnings).toEqual([]);
    expect(result.contract).toMatchObject({
      contract_number: "26-0715",
      client_name: "Beoos Administradora e Empreendimentos LTDA",
      work_address: "RUA IBICUI QD T6 LT 04 RESIDENCIAL ALPHAVILLE ARAGUAIA GOIANIA, GO",
    });
    expect(result.contract.work_address).not.toContain("CRISTIANE");
    expect(result.contract.work_address).not.toContain("98111");
    expect(result.pieces).toHaveLength(4);
    expect(result.pieces.find((piece) => piece.code === "FIXO 1")).toMatchObject({
      sale_width_mm: 4910,
      sale_height_mm: 3950,
      line: "BRISE",
      environment: "FACHADA",
    });
    expect(result.pieces.find((piece) => piece.code === "FIXO 2")).toMatchObject({
      sale_width_mm: 520,
      sale_height_mm: 3950,
      line: "BRISE",
      environment: "FACHADA LATERAL",
    });
    expect(result.pieces.find((piece) => piece.code === "FIXO 3")).toMatchObject({
      sale_width_mm: 2160,
      sale_height_mm: 810,
      line: "BRISE",
      environment: "FACHADA LATERAL",
    });
  });

  it("extracts drawing-only proposals and profile tube rows", () => {
    const result = parseTechnicalContractText(`
      Proposta Nº
      26-0710
      BASIC FULL JARDIM GOIAS LTDA
      10.08.2026 10:04 am
      Cliente: BASIC FULL JARDIM GOIAS LTDA CNPJ: 66.884.250/0001-40
      Contato: ARQ. SWAMY Telefone: 62 9 9288-7731
      End. Obra: Avenida C, Nº: 582 - Jardim Goias E-mail: comercial@conceptal.com.br
      Cidade: Goiania/GO CEP: 74805-070
      Vendedor: RENATA CAPUTO Telefone:
      Emitido por THAIS MARTINS em 10/08/2026, às 10:04

      QUADRO FIXO DE VIDRO - COM DIVISAO - 4 MODULOS NA LARGURA
      Acabamento: PINTURA CORTEN
      Vidros: TEMPERADO DE 6 MM incolor
      Area Esquadria: 4,90m2 Area Vidro: 5 m2
      Tipo: Qtd: L: H: Linha: Localizacao:
      FIX P1 1 4900 1000 QUADRO FIXO RECEPCAO

      PERFIS DIVERSOS AVULSOS "TUBOS"
      TUBO 100X50
      Acabamento: PINTURA CORTEN
      Sem Vidros
      Area Esquadria: 0,00m2 Area Vidro: -
      Tipo: Qtd: L: H: Linha: Localizacao:
      TUB_01_A 1 1 2500 CONCEPT LINE WC FEMININO
    `);

    expect(result.warnings).toEqual([]);
    expect(result.contract).toMatchObject({
      contract_number: "26-0710",
      client_name: "BASIC FULL JARDIM GOIAS LTDA",
      contract_date: "2026-08-10",
      work_address: "Avenida C, Nº: 582 - Jardim Goias, Goiania/GO",
    });
    expect(result.contract.commercial_data).toMatchObject({
      origem_importacao: "pdf_desenhos",
      vendedor: "RENATA CAPUTO",
      emitido_por: "THAIS MARTINS",
      cep_obra: "74805-070",
      cidade_obra: "Goiania/GO",
    });
    expect(result.pieces).toHaveLength(2);
    expect(result.pieces[0]).toMatchObject({
      code: "FIX P1",
      sale_width_mm: 4900,
      sale_height_mm: 1000,
      line: "QUADRO FIXO",
      environment: "RECEPCAO",
    });
    expect(result.pieces[1]).toMatchObject({
      code: "TUB_01_A",
      piece_type: 'PERFIS DIVERSOS AVULSOS "TUBOS" TUBO 100X50',
      quantity: 1,
      sale_width_mm: 1,
      sale_height_mm: 2500,
      line: "CONCEPT LINE",
      environment: "WC FEMININO",
      glass: "sem vidro",
      color: "PINTURA CORTEN",
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
