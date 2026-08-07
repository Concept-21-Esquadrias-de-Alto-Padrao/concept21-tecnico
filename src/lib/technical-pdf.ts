import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { normalizeText, parseNumber, textOrNull } from "@/lib/utils";

export type ParsedTechnicalContract = {
  contract_number: string | null;
  client_name: string | null;
  contract_date: string | null;
  work_address: string | null;
  work_name: string | null;
  description: string | null;
  deadline_value: number | null;
  deadline_unit: "dias_uteis" | "dias_corridos";
  authorized_contacts: Array<{ name: string; role?: string | null; phone?: string | null }>;
  commercial_data: Record<string, string>;
};

export type ParsedTechnicalPiece = {
  code: string;
  piece_type: string | null;
  quantity: number;
  sale_width_mm: number | null;
  sale_height_mm: number | null;
  environment: string | null;
  description: string | null;
  glass: string | null;
  color: string | null;
  line: string | null;
};

export type TechnicalPdfParseResult = {
  contract: ParsedTechnicalContract;
  pieces: ParsedTechnicalPiece[];
  pages: number;
  warnings: string[];
  rawTextSample: string;
};

type ContractTableData = {
  clientName?: string | null;
  workName?: string | null;
};

type SmartCemPieceData = {
  code: string | null;
  quantity: number;
  width: number | null;
  height: number | null;
  line: string | null;
};

const knownWorkTypes = [
  "RESIDENCIAL",
  "COMERCIAL",
  "INDUSTRIAL",
  "CORPORATIVO",
  "CONDOMINIAL",
];

const stopLabelTexts = [
  "nome do cliente",
  "nº do contrato",
  "no do contrato",
  "numero do contrato",
  "endereço da obra",
  "endereco da obra",
  "contratante",
  "contratada",
  "cpf",
  "rg",
  "endereço do cliente",
  "endereco do cliente",
  "endereço para emissão",
  "endereco para emissao",
  "responsável financeiro",
  "responsavel financeiro",
  "nome responsabilidade telefone",
  "proposta nº",
  "proposta no",
  "cliente",
  "contato",
  "cidade",
  "vendedor",
];

function normalizeLines(text: string) {
  return text
    .replace(/\uFFFD/g, "")
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
}

function searchable(value: string) {
  return normalizeText(value)
    .replace(/[º°]/g, "o")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isFooterLine(line: string) {
  const normalized = searchable(line);
  return (
    normalized.includes("www conceptal com br") ||
    normalized.includes("concept aluminium") ||
    normalized.includes("smartcem alumisoft") ||
    normalized.startsWith("rua cm 14") ||
    normalized.startsWith("cep 74463")
  );
}

function isPageOrDocumentMarker(line: string) {
  const normalized = searchable(line);
  return (
    isFooterLine(line) ||
    normalized.startsWith("contrato no") ||
    normalized.startsWith("goiania") ||
    normalized.startsWith("obra ") ||
    normalized.startsWith("proposta no") ||
    normalized.startsWith("emitido por")
  );
}

function isLabelLine(line: string, labels: string[]) {
  const normalizedLine = searchable(line);
  return labels.some((label) => {
    const normalizedLabel = searchable(label);
    if (!normalizedLabel) return false;
    if (normalizedLine === normalizedLabel) return true;
    const rest = normalizedLine.startsWith(normalizedLabel)
      ? normalizedLine.slice(normalizedLabel.length).trim()
      : "";
    return Boolean(rest) && /^(cep|telefone|email|e mail|cpf|rg|data nascimento)$/.test(rest);
  });
}

function isAnyStopLabel(line: string) {
  const normalized = searchable(line);
  return (
    isLabelLine(line, stopLabelTexts) ||
    normalized.startsWith("nome responsabilidade telefone") ||
    /^\d+(?:\.\d+)*\b/.test(line)
  );
}

function inlineValueAfterLabel(line: string, labels: string[]) {
  const colonIndex = line.indexOf(":");
  if (colonIndex < 0) return null;

  const before = line.slice(0, colonIndex);
  const after = line.slice(colonIndex + 1).trim();
  if (!after) return null;
  return labels.some((label) => searchable(before).includes(searchable(label))) ? after : null;
}

function collectAfterLabel(
  lines: string[],
  labels: string[],
  { maxLines = 1, multiline = false }: { maxLines?: number; multiline?: boolean } = {},
) {
  for (let index = 0; index < lines.length; index += 1) {
    const inline = inlineValueAfterLabel(lines[index], labels);
    if (inline) return inline;

    if (!isLabelLine(lines[index], labels)) continue;

    const values: string[] = [];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (isAnyStopLabel(nextLine) || isPageOrDocumentMarker(nextLine)) break;
      values.push(nextLine);
      if (!multiline || values.length >= maxLines) break;
    }

    if (values.length) return cleanValue(values.join(", "));
  }

  return null;
}

function collectAllAfterLabel(
  lines: string[],
  labels: string[],
  { maxLines = 1, multiline = false }: { maxLines?: number; multiline?: boolean } = {},
) {
  const values: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const inline = inlineValueAfterLabel(lines[index], labels);
    if (inline) {
      values.push(inline);
      continue;
    }

    if (!isLabelLine(lines[index], labels)) continue;

    const nextValues: string[] = [];
    for (let nextIndex = index + 1; nextIndex < lines.length; nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (isAnyStopLabel(nextLine) || isPageOrDocumentMarker(nextLine)) break;
      nextValues.push(nextLine);
      if (!multiline || nextValues.length >= maxLines) break;
    }

    if (nextValues.length) values.push(cleanValue(nextValues.join(", ")) ?? "");
  }

  return values.map(cleanValue).filter((value): value is string => Boolean(value));
}

function cleanValue(value: string | null | undefined) {
  return textOrNull(
    value
      ?.replace(/\s+/g, " ")
      .replace(/\s+,/g, ",")
      .replace(/,\s*,/g, ",")
      .trim(),
  );
}

function parseBrazilianDate(value: string | null) {
  if (!value) return null;

  const numericMatch = value.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    return `${year}-${month}-${day}`;
  }

  const longDateMatch = value.match(/(\d{1,2})\s+de\s+([a-zçãéêíóôú]+)\s+de\s+(\d{4})/i);
  if (!longDateMatch) return null;

  const monthByName: Record<string, string> = {
    janeiro: "01",
    fevereiro: "02",
    marco: "03",
    março: "03",
    abril: "04",
    maio: "05",
    junho: "06",
    julho: "07",
    agosto: "08",
    setembro: "09",
    outubro: "10",
    novembro: "11",
    dezembro: "12",
  };

  const [, rawDay, rawMonth, year] = longDateMatch;
  const month = monthByName[normalizeText(rawMonth)];
  if (!month) return null;
  return `${year}-${month}-${rawDay.padStart(2, "0")}`;
}

function inferContractDate(lines: string[]) {
  const labeled = collectAfterLabel(lines, ["data do contrato", "data"]);
  const labeledDate = parseBrazilianDate(labeled);
  if (labeledDate) return labeledDate;

  for (const line of lines.slice(0, 20)) {
    const parsed = parseBrazilianDate(line);
    if (parsed) return parsed;
  }

  return null;
}

function inferContractNumber(lines: string[]) {
  const joined = lines.join("\n");
  const directPatterns = [
    /contrato\s+n[º°o.]?\s*:?\s*([A-Z0-9][A-Z0-9./-]{3,})/i,
    /proposta\s+n[º°o.]?\s*:?\s*([A-Z0-9][A-Z0-9./-]{3,})/i,
  ];

  for (const pattern of directPatterns) {
    const match = joined.match(pattern);
    if (match?.[1] && !/comercial/i.test(match[1])) return match[1].trim();
  }

  const labeled = collectAfterLabel(lines, [
    "nº do contrato",
    "no do contrato",
    "número do contrato",
    "numero do contrato",
    "contrato",
  ]);
  const match = labeled?.match(/([A-Z0-9][A-Z0-9./-]{3,})/i);
  return match?.[1]?.trim() ?? null;
}

function inferContractTableData(lines: string[]): ContractTableData {
  const headerIndex = lines.findIndex((line) =>
    searchable(line).includes("contratante obra data nascimento"),
  );
  const row = headerIndex >= 0 ? lines[headerIndex + 1] : null;
  if (!row) return {};

  const withoutDate = row.replace(/\s+\d{2}[\/.-]\d{2}[\/.-]\d{4}\s*$/, "").trim();
  for (const workType of knownWorkTypes) {
    const match = withoutDate.match(new RegExp(`\\s+(${workType})\\s*$`, "i"));
    if (match?.index && match.index > 0) {
      return {
        clientName: cleanValue(withoutDate.slice(0, match.index)),
        workName: match[1].toUpperCase(),
      };
    }
  }

  return { clientName: cleanValue(withoutDate) };
}

function inferClientName(lines: string[], tableData: ContractTableData) {
  return (
    cleanValue(collectAfterLabel(lines, ["nome do cliente"])) ??
    cleanValue(tableData.clientName) ??
    cleanValue(collectAfterLabel(lines, ["cliente"])) ??
    null
  );
}

function inferWorkAddress(lines: string[]) {
  const contractCandidates = collectAllAfterLabel(lines, ["endereço da obra", "endereco da obra"], {
    maxLines: 4,
    multiline: true,
  }).map(stripTrailingZipCode);
  const fromContract = contractCandidates
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length)[0];
  if (fromContract) return stripTrailingZipCode(fromContract);

  const proposalCandidates = collectAllAfterLabel(lines, ["end. obra", "end obra"], {
    maxLines: 2,
    multiline: true,
  }).map(stripTrailingZipCode);
  const fromProposal = proposalCandidates
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length)[0];
  return fromProposal ? stripTrailingZipCode(fromProposal) : null;
}

function stripTrailingZipCode(value: string) {
  return cleanValue(value.replace(/\s+\d{2}\.?\d{3}-?\d{3}\s*$/, ""));
}

function inferWorkName(lines: string[], tableData: ContractTableData, clientName: string | null) {
  const inlineWork = lines
    .map((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex < 0 || searchable(line.slice(0, colonIndex)) !== "obra") return null;
      if (/^\s*obra\s*:\s*\d{2}[-/]\d{4}\s+-/i.test(line)) return null;
      return cleanValue(line.slice(colonIndex + 1));
    })
    .find(Boolean);
  if (inlineWork && !/data nascimento/i.test(inlineWork)) return cleanValue(inlineWork);

  const namedWork = collectAfterLabel(lines, ["nome da obra"]);
  if (namedWork) return cleanValue(namedWork);
  return cleanValue(tableData.workName) ?? (clientName ? `Residencial - ${clientName}` : null);
}

function inferDeadline(lines: string[]) {
  const deadlinePattern = /(\d+)\s*dias?\s*(úteis|uteis|corridos)?/i;

  for (let index = 0; index < lines.length; index += 1) {
    if (!searchable(lines[index]).includes("prazo de entrega")) continue;
    const windowText = lines.slice(index, index + 3).join(" ");
    const match = windowText.match(deadlinePattern);
    if (match) {
      return {
        value: Number(match[1]),
        unit: /corrido/i.test(match[2] ?? "") ? ("dias_corridos" as const) : ("dias_uteis" as const),
      };
    }
  }

  for (let index = 0; index < lines.length; index += 1) {
    const windowText = lines.slice(Math.max(0, index - 1), index + 2).join(" ");
    if (!searchable(windowText).includes("prazo")) continue;
    const match = windowText.match(deadlinePattern);
    if (match) {
      return {
        value: Number(match[1]),
        unit: /corrido/i.test(match[2] ?? "") ? ("dias_corridos" as const) : ("dias_uteis" as const),
      };
    }
  }

  return { value: null, unit: "dias_uteis" as const };
}

function parseAuthorizedContactLine(line: string) {
  const phoneMatch = line.match(/(\(?\d{2}\)?\s*\d?\s*\d{4,5}[-\s]?\d{4})/);
  if (!phoneMatch) return null;

  const beforePhone = cleanValue(line.replace(phoneMatch[0], ""));
  if (!beforePhone) return null;

  const knownRolePattern =
    /(propriet[aá]ri[oa]|arquitet[ao]|engenheir[oa]|financeiro|respons[aá]vel(?:\s+t[eé]cnico)?|construtor[ao]?|mestre|encarregado)$/i;
  const roleMatch = beforePhone.match(knownRolePattern);
  const hyphenParts = beforePhone.split(/\s+-\s+/);
  const name = cleanValue(
    roleMatch?.index
      ? beforePhone.slice(0, roleMatch.index)
      : hyphenParts.length > 1
        ? hyphenParts[0]
        : beforePhone,
  );
  const role = cleanValue(roleMatch?.[1] ?? (hyphenParts.length > 1 ? hyphenParts.slice(1).join(" - ") : ""));

  if (!name || name.length < 3) return null;
  return {
    name,
    role,
    phone: phoneMatch[1],
  };
}

function parseAuthorizedContacts(lines: string[]) {
  const contacts: Array<{ name: string; role?: string | null; phone?: string | null }> = [];
  const tableStart = lines.findIndex((line) =>
    searchable(line).includes("nome responsabilidade telefone"),
  );

  if (tableStart >= 0) {
    for (const line of lines.slice(tableStart + 1, tableStart + 12)) {
      if (/^4\.2\b/.test(line) || isFooterLine(line)) break;
      const contact = parseAuthorizedContactLine(line);
      if (contact) contacts.push(contact);
    }
  }

  if (contacts.length) return contacts;

  const start = lines.findIndex((line) =>
    /respons[aá]veis autorizados|contatos autorizados|autorizados a assinar/i.test(line),
  );
  if (start < 0) return contacts;

  for (const line of lines.slice(start + 1, start + 12)) {
    if (/pe[cç]as|itens|desenhos|observa|4\.2/i.test(line)) break;
    const contact = parseAuthorizedContactLine(line);
    if (contact) contacts.push(contact);
  }

  return contacts;
}

function valueAfterInlineLabel(line: string, label: string) {
  const normalizedLabel = searchable(label);
  const normalizedLine = searchable(line);
  if (!normalizedLine.includes(normalizedLabel)) return null;

  const colonIndex = line.indexOf(":");
  if (colonIndex >= 0 && searchable(line.slice(0, colonIndex)).includes(normalizedLabel)) {
    return cleanValue(line.slice(colonIndex + 1));
  }

  const pattern = new RegExp(`${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+)$`, "i");
  return cleanValue(line.match(pattern)?.[1]);
}

function extractCommercialData(lines: string[]) {
  const joined = lines.join(" ");
  const investment = joined.match(/investimento\s+é\s+de\s+R\$\s*([0-9.,]+)/i)?.[1];
  const seller =
    lines.map((line) => valueAfterInlineLabel(line, "Vendedor")).find(Boolean) ??
    cleanValue(lines.find((line) => /RENATA CAPUTO|EDUARDO RODRIGUES/i.test(line)));
  const proposalIssuedBy = joined.match(/Emitido por\s+(.+?)\s+em\s+\d{2}\/\d{2}\/\d{4}/i)?.[1];
  const zipCode = extractWorkZipCode(lines);

  return Object.fromEntries(
    Object.entries({
      origem_importacao: "pdf_contrato",
      investimento_total: investment ?? null,
      vendedor: seller ?? null,
      emitido_por: proposalIssuedBy ?? null,
      cep_obra: zipCode ?? null,
    }).filter(([, value]) => value),
  ) as Record<string, string>;
}

function extractWorkZipCode(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    if (!searchable(lines[index]).includes("endereco da obra")) continue;

    const windowText = lines.slice(index, index + 3).join(" ");
    const match = windowText.match(/(\d{2}\.?\d{3}-?\d{3})/);
    if (match?.[1]) return match[1].replace(".", "");
  }

  return null;
}

function boundedLabelValue(line: string, label: string) {
  const labels = ["tipo", "qtde", "qtd", "quantidade", "ambiente", "local", "vidro", "cor", "linha", "sistema"];
  const stopLabels = labels.filter((item) => item !== label).join("|");
  const match = line.match(new RegExp(`${label}\\s*[:\\-]?\\s*(.*?)(?=\\s+(?:${stopLabels})\\s*[:\\-]|$)`, "i"));
  return cleanValue(match?.[1]);
}

function parseLegacyPieceLine(line: string): ParsedTechnicalPiece | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  const codeMatch = normalized.match(/^([A-Z]{1,6}\d{1,4}(?:[_-][A-Z][A-Z0-9]?)?)(?:\s|$)/i);
  if (!codeMatch) return null;

  const code = codeMatch[1].toUpperCase();
  const quantityMatch =
    normalized.match(/(?:qtde|qtd|quantidade)\s*[:\-]?\s*(\d+)/i) ??
    normalized.match(/\s(\d+)\s*(?:un|pç|pc|pcs)\b/i);
  const dimensionMatch =
    normalized.match(/(\d{2,5})\s*[xX]\s*(\d{2,5})/) ??
    normalized.match(/L(?:argura)?\s*[:\-]?\s*(\d{2,5}).*A(?:ltura)?\s*[:\-]?\s*(\d{2,5})/i);

  if (!quantityMatch && !dimensionMatch && !/tipo|ambiente|vidro|linha|cor/i.test(normalized)) {
    return null;
  }

  const pieceType = boundedLabelValue(normalized, "tipo");
  const environment = boundedLabelValue(normalized, "ambiente") ?? boundedLabelValue(normalized, "local");
  const glass = boundedLabelValue(normalized, "vidro");
  const color = boundedLabelValue(normalized, "cor");
  const lineName = boundedLabelValue(normalized, "linha") ?? boundedLabelValue(normalized, "sistema");

  return {
    code,
    piece_type: pieceType,
    quantity: Math.max(1, Math.trunc(parseNumber(quantityMatch?.[1] ?? "1", 1))),
    sale_width_mm: dimensionMatch?.[1] ? parseNumber(dimensionMatch[1], 0) : null,
    sale_height_mm: dimensionMatch?.[2] ? parseNumber(dimensionMatch[2], 0) : null,
    environment,
    description: normalized.slice(code.length).trim() || null,
    glass,
    color,
    line: lineName,
  };
}

function parseJoinedDimensions(value: string) {
  for (let widthLength = 3; widthLength <= 5; widthLength += 1) {
    const heightLength = value.length - widthLength;
    if (heightLength < 3 || heightLength > 5) continue;

    const width = Number(value.slice(0, widthLength));
    const height = Number(value.slice(widthLength));
    if (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= 200 &&
      height >= 200 &&
      width <= 10000 &&
      height <= 10000
    ) {
      return { width, height };
    }
  }

  return { width: null, height: null };
}

function splitSmartCemLineAndQuantity(value: string) {
  const normalized = cleanValue(value);
  if (!normalized) return null;

  for (let quantityLength = 1; quantityLength <= 3; quantityLength += 1) {
    const rawQuantity = normalized.slice(-quantityLength);
    if (!/^\d+$/.test(rawQuantity)) continue;
    if (rawQuantity.length > 1 && rawQuantity.startsWith("0")) continue;

    const quantity = Number(rawQuantity);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 100) continue;

    const line = cleanValue(normalized.slice(0, -quantityLength));
    if (!line) continue;

    return {
      line,
      quantity,
    };
  }

  return null;
}

function parseSmartCemDataLine(line: string): SmartCemPieceData | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  const collapsedBase = normalized.match(/^([A-Z]{1,4}\d{2})(.*)$/i);
  const collapsedCandidates: Array<{ code: string; rest: string }> = [];

  if (collapsedBase) {
    const [, baseCode, rest] = collapsedBase;
    const suffixMatch = rest.match(/^_([A-Z])(\d?)(.*)$/i);
    if (suffixMatch) {
      const [, suffixLetter, suffixDigit, afterSuffix] = suffixMatch;
      collapsedCandidates.push({
        code: `${baseCode}_${suffixLetter}`,
        rest: `${suffixDigit}${afterSuffix}`,
      });
      if (suffixDigit) {
        collapsedCandidates.push({
          code: `${baseCode}_${suffixLetter}${suffixDigit}`,
          rest: afterSuffix,
        });
      }
    } else {
      collapsedCandidates.push({ code: baseCode, rest });
    }
  }

  for (const candidate of collapsedCandidates) {
    const collapsedMatch = candidate.rest.match(/^(\d{6,10})(.+)$/i);
    if (!collapsedMatch) continue;

    const [, joinedDimensions, lineAndQuantity] = collapsedMatch;
    const dimensions = parseJoinedDimensions(joinedDimensions);
    const parsedLineAndQuantity = splitSmartCemLineAndQuantity(lineAndQuantity);
    if (dimensions.width && dimensions.height && parsedLineAndQuantity) {
      return {
        code: candidate.code.toUpperCase(),
        quantity: parsedLineAndQuantity.quantity,
        width: dimensions.width,
        height: dimensions.height,
        line: parsedLineAndQuantity.line,
      };
    }
  }

  const noCodeCollapsedMatch = normalized.match(/^(\d{6,10})(.+)$/i);
  if (noCodeCollapsedMatch) {
    const [, joinedDimensions, lineAndQuantity] = noCodeCollapsedMatch;
    const dimensions = parseJoinedDimensions(joinedDimensions);
    const parsedLineAndQuantity = splitSmartCemLineAndQuantity(lineAndQuantity);

    if (dimensions.width && dimensions.height && parsedLineAndQuantity) {
      return {
        code: null,
        quantity: parsedLineAndQuantity.quantity,
        width: dimensions.width,
        height: dimensions.height,
        line: parsedLineAndQuantity.line,
      };
    }
  }

  const spacedMatch = normalized.match(
    /^([A-Z]{1,4}\d{2}(?:_[A-Z][A-Z0-9]?)?)\s+(\d+)\s+(\d{2,5})\s+(\d{2,5})\s+(.+)$/i,
  );
  if (!spacedMatch) return null;

  const [, code, quantity, width, height, lineName] = spacedMatch;
  return {
    code: code.toUpperCase(),
    quantity: Math.max(1, Number(quantity)),
    width: Number(width),
    height: Number(height),
    line: cleanValue(lineName),
  };
}

function isLocationLabel(line: string) {
  return searchable(line).startsWith("localizacao");
}

function isSmartCemHeader(line: string) {
  const tokens = searchable(line).split(" ");
  return (
    tokens.includes("tipo") &&
    tokens.includes("linha") &&
    tokens.includes("qtd") &&
    tokens.includes("l") &&
    tokens.includes("h")
  );
}

function locationAfterDataLine(lines: string[], index: number) {
  const nextLine = lines[index + 1];
  if (!nextLine) return null;

  const inline = valueAfterInlineLabel(nextLine, "Localização");
  if (inline) return inline;

  if (isLocationLabel(nextLine)) {
    const location = lines[index + 2];
    if (location && !isPageOrDocumentMarker(location) && !parseSmartCemDataLine(location)) {
      return cleanValue(location);
    }
  }

  return null;
}

function contextBeforeDataLine(lines: string[], index: number) {
  const context: string[] = [];

  for (let cursor = index - 1; cursor >= 0 && context.length < 12; cursor -= 1) {
    const line = lines[cursor];
    if (
      isSmartCemHeader(line) ||
      (cursor > 0 && isSmartCemHeader(lines[cursor - 1])) ||
      (cursor > 1 && isSmartCemHeader(lines[cursor - 2]))
    ) {
      continue;
    }

    if (
      isPageOrDocumentMarker(line) ||
      isLocationLabel(line) ||
      parseSmartCemDataLine(line) ||
      (cursor > 0 && isLocationLabel(lines[cursor - 1]))
    ) {
      break;
    }

    context.unshift(line);
  }

  let color: string | null = null;
  let glass: string | null = null;
  const descriptionLines: string[] = [];

  for (const line of context) {
    const normalized = searchable(line);
    if (normalized.startsWith("acabamento")) {
      color = cleanValue(line.replace(/^Acabamento\s*:\s*/i, ""));
    } else if (normalized.startsWith("vidros")) {
      glass = cleanValue(line.replace(/^Vidros\s*:\s*/i, ""));
    } else if (normalized.startsWith("sem vidros")) {
      glass = "sem vidro";
    } else if (!normalized.startsWith("area esquadria") && !normalized.startsWith("tipo")) {
      descriptionLines.push(line);
    }
  }

  const productStart = descriptionLines.findIndex((line) =>
    /^(brise|painel|porta|port[aã]o|janela|quadro|portinhola|persiana|pele|guarda|corrim[aã]o|fixo)\b/i.test(line),
  );
  const productDescriptionLines = productStart >= 0 ? descriptionLines.slice(productStart) : descriptionLines;

  return {
    color,
    glass,
    description: cleanValue(productDescriptionLines.join(" ")),
  };
}

function rowTypeBeforeDataLine(lines: string[], index: number) {
  const values: string[] = [];

  for (let cursor = index - 1; cursor >= 0 && values.length < 4; cursor -= 1) {
    const line = lines[cursor];
    if (isSmartCemHeader(line)) break;
    if (isPageOrDocumentMarker(line) || isLocationLabel(line) || parseSmartCemDataLine(line)) {
      return null;
    }

    values.unshift(line);
  }

  return cleanValue(values.join(" "));
}

function codeSafeSegment(value: string | null | undefined, fallback: string) {
  const normalized = normalizeText(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return (normalized || fallback).slice(0, 24);
}

function generatedSmartCemCode(
  contractNumber: string | null,
  source: string | null,
  index: number,
) {
  const contractSegment = codeSafeSegment(contractNumber, "PDF");
  const pieceSegment = codeSafeSegment(source, "PECA");
  return `${contractSegment}-${pieceSegment}-${String(index + 1).padStart(2, "0")}`;
}

function parseSmartCemPieces(lines: string[], contractNumber: string | null) {
  const pieces: ParsedTechnicalPiece[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const data = parseSmartCemDataLine(lines[index]);
    if (!data) continue;

    const context = contextBeforeDataLine(lines, index);
    const rowType = rowTypeBeforeDataLine(lines, index);
    const location = locationAfterDataLine(lines, index);
    const code =
      data.code ??
      generatedSmartCemCode(
        contractNumber,
        rowType ?? context.description ?? data.line,
        pieces.length,
      );

    pieces.push({
      code,
      piece_type: context.description,
      quantity: data.quantity,
      sale_width_mm: data.width,
      sale_height_mm: data.height,
      environment: location,
      description: context.description,
      glass: context.glass,
      color: context.color,
      line: data.line,
    });
  }

  return pieces;
}

function mergePiece(pieceMap: Map<string, ParsedTechnicalPiece>, piece: ParsedTechnicalPiece) {
  const existing = pieceMap.get(piece.code);
  if (!existing) {
    pieceMap.set(piece.code, piece);
    return;
  }

  pieceMap.set(piece.code, {
    ...existing,
    ...Object.fromEntries(
      Object.entries(piece).filter(([, value]) => value !== null && value !== ""),
    ),
  } as ParsedTechnicalPiece);
}

export function parseTechnicalContractText(text: string, pages = 1): TechnicalPdfParseResult {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const deadline = inferDeadline(lines);
  const tableData = inferContractTableData(lines);
  const clientName = inferClientName(lines, tableData);

  const contract: ParsedTechnicalContract = {
    contract_number: inferContractNumber(lines),
    client_name: clientName,
    contract_date: inferContractDate(lines),
    work_address: inferWorkAddress(lines),
    work_name: inferWorkName(lines, tableData, clientName),
    description: collectAfterLabel(lines, ["descrição", "descricao", "objeto"]),
    deadline_value: deadline.value,
    deadline_unit: deadline.unit,
    authorized_contacts: parseAuthorizedContacts(lines),
    commercial_data: extractCommercialData(lines),
  };

  const pieceMap = new Map<string, ParsedTechnicalPiece>();
  for (const piece of parseSmartCemPieces(lines, contract.contract_number)) {
    mergePiece(pieceMap, piece);
  }
  for (const line of lines) {
    const piece = parseLegacyPieceLine(line);
    if (piece) mergePiece(pieceMap, piece);
  }

  const pieces = Array.from(pieceMap.values());

  if (!contract.contract_number) warnings.push("Número do contrato não identificado.");
  if (!contract.client_name) warnings.push("Cliente não identificado.");
  if (!contract.work_address) warnings.push("Endereço da obra não identificado.");
  if (!pieces.length) warnings.push("Nenhuma peça foi identificada nos desenhos anexados.");

  return {
    contract,
    pieces,
    pages,
    warnings,
    rawTextSample: lines.slice(0, 100).join("\n"),
  };
}

export async function parseTechnicalContractPdf(buffer: Buffer): Promise<TechnicalPdfParseResult> {
  const parsedPdf = await pdfParse(buffer);
  return parseTechnicalContractText(parsedPdf.text, parsedPdf.numpages);
}
