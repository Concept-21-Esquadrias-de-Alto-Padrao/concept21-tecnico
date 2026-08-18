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
  location: string | null;
  rowType: string | null;
  source: "collapsed" | "labeled" | "layout";
};

type PdfTextItem = {
  str?: string;
  transform?: number[];
  width?: number;
};

type PdfPageData = {
  getTextContent: (options: {
    normalizeWhitespace: boolean;
    disableCombineTextItems: boolean;
  }) => Promise<{ items?: PdfTextItem[] }>;
};

type PdfParseWithOptions = (
  buffer: Buffer,
  options?: { pagerender?: (pageData: PdfPageData) => Promise<string> },
) => Promise<{ text: string; numpages: number }>;

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
  "responsável",
  "responsavel financeiro",
  "responsavel",
  "nome responsabilidade telefone",
  "proposta nº",
  "proposta no",
  "cliente",
  "contato",
  "cidade",
  "vendedor",
];

function repairPdfTextArtifacts(value: string) {
  return value
    .replace(/(\d)\s*([.,/-])\s*(\d)/g, "$1$2$3")
    .replace(/\bI\s+bicui\b/gi, "Ibicui")
    .replace(/\bR\s+UA\b/gi, "RUA")
    .replace(/\bQ\s+D\b/gi, "QD")
    .replace(/\bL\s+T\b/gi, "LT")
    .replace(/\bEDUA\s+R\s+DO\b/gi, "EDUARDO")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([;:])(?=\S)/g, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLines(text: string) {
  return text
    .replace(/\uFFFD/g, "")
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map((line) => repairPdfTextArtifacts(line.replace(/[ \t]+/g, " ").trim()))
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
    return Boolean(rest) && /^(cep|telefone|email|e mail|cpf|rg|data nascimento)(?:\b|$)/.test(rest);
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
    repairPdfTextArtifacts(
      value
        ?.replace(/\s+/g, " ")
        .replace(/\s+,/g, ",")
        .replace(/,\s*,/g, ",")
        .trim() ?? "",
    ),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimAtInlineFieldLabels(value: string | null | undefined, labelPatterns: string[]) {
  const cleaned = cleanValue(value);
  if (!cleaned) return null;

  return cleanValue(cleaned.replace(new RegExp(`\\s+(?:${labelPatterns.join("|")})\\s*:\\s*.*$`, "i"), ""));
}

function cleanClientNameValue(value: string | null | undefined) {
  const withoutInlineFields = trimAtInlineFieldLabels(value, ["CNPJ", "CPF", "RG", "Telefone", "E-?mail", "Email"]);
  return cleanValue(withoutInlineFields?.replace(/\s+-?\s*\d{1,2}\s*[-/]\s*\d{3,5}\s*$/i, ""));
}

function cleanWorkAddressValue(value: string | null | undefined) {
  const withoutInlineFields = trimAtInlineFieldLabels(value, ["E-?mail", "Email", "Telefone", "Vendedor"]);
  const withoutZipCode = withoutInlineFields ? stripTrailingZipCode(withoutInlineFields) : null;
  return cleanValue(withoutZipCode?.replace(/[.,;]\s*$/g, ""));
}

function parseBrazilianDate(value: string | null) {
  if (!value) return null;

  const normalized = repairPdfTextArtifacts(value)
    .replace(/\b(\d)\s+(\d)(?=\s+de\b)/i, "$1$2")
    .replace(/\b(\d{3})\s+(\d)\b/g, "$1$2");
  const numericMatch = normalized.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    return `${year}-${month}-${day}`;
  }

  const longDateMatch = normalized.match(/(\d{1,2})\s+de\s+([a-zçãéêíóôú]+)\s+de\s+(\d{4})/i);
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

function extractContractIdentifier(value: string | null | undefined) {
  const normalized = cleanValue(value)
    ?.replace(/\b(\d)\s+(?=\d\s*[-/.])/g, "$1")
    .replace(/\s*([./-])\s*/g, "$1");
  const matches = Array.from(normalized?.matchAll(/([A-Z0-9][A-Z0-9./-]{3,})/gi) ?? []);
  const match = matches.find((candidate) => /\d/.test(candidate[1]) && !/comercial/i.test(candidate[1]));
  return match?.[1]?.trim() ?? null;
}

function inferContractNumber(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = searchable(lines[index]);
    if (normalized === "no do contrato" || normalized === "numero do contrato") {
      const identifier = extractContractIdentifier(lines[index + 1]);
      if (identifier) return identifier;
    }

    if (normalized.startsWith("contrato no") || normalized.startsWith("proposta no")) {
      const identifier = extractContractIdentifier(lines[index]);
      if (identifier && !/comercial/i.test(lines[index])) return identifier;
    }
  }

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
    cleanClientNameValue(collectAfterLabel(lines, ["nome do cliente"])) ??
    cleanClientNameValue(tableData.clientName) ??
    cleanClientNameValue(collectAfterLabel(lines, ["cliente"])) ??
    null
  );
}

function inferWorkAddress(lines: string[]) {
  const contractCandidates = collectAllAfterLabel(lines, ["endereço da obra", "endereco da obra"], {
    maxLines: 4,
    multiline: true,
  })
    .map((value) => ({
      address: cleanWorkAddressValue(value),
      hasZipCode: Boolean(extractZipCodeFromText(value)),
    }))
    .filter((candidate): candidate is { address: string; hasZipCode: boolean } => Boolean(candidate.address));
  const fromContract = contractCandidates.sort(
    (left, right) =>
      Number(right.hasZipCode) - Number(left.hasZipCode) ||
      right.address.length - left.address.length,
  )[0]?.address;
  if (fromContract) return stripTrailingZipCode(fromContract);

  const proposalCandidates = collectAllAfterLabel(lines, ["end. obra", "end obra"], {
    maxLines: 2,
    multiline: true,
  }).map(cleanWorkAddressValue);
  const fromProposal = proposalCandidates
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => right.length - left.length)[0];
  if (!fromProposal) return null;

  const city = inferProposalCity(lines);
  if (city && !searchable(fromProposal).includes(searchable(city).split(" ")[0] ?? "")) {
    return cleanValue(`${fromProposal}, ${city}`);
  }

  return stripTrailingZipCode(fromProposal);
}

function extractZipCodeFromText(value: string) {
  const normalized = repairPdfTextArtifacts(value);
  const direct = normalized.match(/\b(\d{2})\.?(\d{3})-?(\d{3})\b/);
  if (direct) return `${direct[1]}${direct[2]}-${direct[3]}`;

  const loose = value.match(/(\d\s*\d)\s*\.?\s*(\d\s*\d\s*\d)\s*-?\s*(\d\s*\d\s*\d)/);
  if (!loose) return null;

  return `${loose[1].replace(/\D/g, "")}${loose[2].replace(/\D/g, "")}-${loose[3].replace(/\D/g, "")}`;
}

function stripTrailingZipCode(value: string) {
  return cleanValue(
    repairPdfTextArtifacts(value).replace(/\s+\d\s*\d\s*\.?\s*\d\s*\d\s*\d\s*-?\s*\d\s*\d\s*\d\s*$/, ""),
  );
}

function inferProposalCity(lines: string[]) {
  return (
    lines
      .map((line) => valueAfterInlineLabel(line, "Cidade"))
      .map((value) => trimAtInlineFieldLabels(value, ["CEP", "Telefone", "E-?mail", "Email"]))
      .find(Boolean) ?? null
  );
}

function inferWorkName(lines: string[], tableData: ContractTableData, clientName: string | null) {
  const inlineWork = lines
    .map((line) => {
      const colonIndex = line.indexOf(":");
      if (colonIndex < 0 || searchable(line.slice(0, colonIndex)) !== "obra") return null;
      if (/^\s*obra\s*:\s*\d{2}\s*[-/]\s*\d{4}\s+-/i.test(line)) return null;
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
  const normalizedLine = repairPdfTextArtifacts(line);
  const phoneMatch = normalizedLine.match(/(\(?\d{2}\)?\s*\d?\s*\d{4,5}\s*[-\s]?\s*\d{4})/);
  if (!phoneMatch) return null;

  const beforePhone = cleanValue(normalizedLine.replace(phoneMatch[0], ""));
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
    phone: cleanValue(phoneMatch[1]),
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
    lines
      .map((line) => trimAtInlineFieldLabels(valueAfterInlineLabel(line, "Vendedor"), ["Telefone", "E-?mail", "Email"]))
      .find(Boolean) ??
    cleanValue(lines.find((line) => /RENATA CAPUTO|EDUARDO RODRIGUES/i.test(line)));
  const proposalIssuedBy = joined.match(/Emitido por\s+(.+?)\s+em\s+\d{2}\/\d{2}\/\d{4}/i)?.[1];
  const zipCode = extractWorkZipCode(lines);
  const proposalCity = inferProposalCity(lines);
  const isDrawingProposal = lines.some((line) => searchable(line).startsWith("proposta no")) && lines.some(isSmartCemHeader);

  return Object.fromEntries(
    Object.entries({
      origem_importacao: isDrawingProposal ? "pdf_desenhos" : "pdf_contrato",
      investimento_total: investment ?? null,
      vendedor: seller ?? null,
      emitido_por: proposalIssuedBy ?? null,
      cep_obra: zipCode ?? null,
      cidade_obra: proposalCity ?? null,
    }).filter(([, value]) => value),
  ) as Record<string, string>;
}

function extractWorkZipCode(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const normalized = searchable(lines[index]);
    if (!normalized.includes("endereco da obra") && !normalized.includes("end obra")) continue;

    const windowText = lines.slice(index, index + 3).join(" ");
    const zipCode = extractZipCodeFromText(windowText);
    if (zipCode) return zipCode;
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

  const pieceType = boundedLabelValue(normalized, "tipo");
  const environment = boundedLabelValue(normalized, "ambiente") ?? boundedLabelValue(normalized, "local");
  const glass = boundedLabelValue(normalized, "vidro");
  const color = boundedLabelValue(normalized, "cor");
  const lineName = boundedLabelValue(normalized, "linha") ?? boundedLabelValue(normalized, "sistema");
  const hasUsefulLabel = Boolean(pieceType || environment || glass || color || lineName);

  if (!dimensionMatch && !hasUsefulLabel) {
    return null;
  }

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

const DEFAULT_SMARTCEM_DIMENSION_MM = 10000;
const WIDE_SMARTCEM_DIMENSION_MM = 50000;

function parseDimensionSegment(
  value: string,
  {
    allowSmall = false,
    max = DEFAULT_SMARTCEM_DIMENSION_MM,
    min,
  }: { allowSmall?: boolean; max?: number; min?: number } = {},
) {
  if (!/^\d+$/.test(value)) return null;
  if (value.length > 1 && value.startsWith("0")) return null;

  const parsed = Number(value);
  const minimum = min ?? (allowSmall ? 1 : 200);
  if (
    !Number.isFinite(parsed) ||
    parsed < minimum ||
    parsed > max
  ) {
    return null;
  }
  return parsed;
}

function parseJoinedDimensions(value: string) {
  for (let widthLength = 3; widthLength <= 5; widthLength += 1) {
    const heightLength = value.length - widthLength;
    if (heightLength < 3 || heightLength > 5) continue;

    const width = parseDimensionSegment(value.slice(0, widthLength));
    const height = parseDimensionSegment(value.slice(widthLength));
    if (width && height) {
      return { width, height };
    }
  }

  return { width: null, height: null };
}

function isProfileSmartCemIdentifier(value: string | null | undefined) {
  const normalized = searchable(value ?? "");
  return /^tub(?:\b|\d)/.test(normalized) || /^tubo\b/.test(normalized) || /^perfi(?:l|s)\b/.test(normalized);
}

function smartCemDimensionOptions(value: string | null | undefined) {
  if (isProfileSmartCemIdentifier(value)) return { allowSmall: true, min: 1 };

  const normalized = searchable(value ?? "");
  if (/^(fixo|fechamento)(?:\b|\d)/.test(normalized)) {
    return { allowSmall: true, min: 20 };
  }

  return { allowSmall: false, min: 200 };
}

const smartCemLineNames = [
  "CONCEPT LINE 50",
  "CONCEPT LINE",
  "QUADRO FIXO",
  "PELE DE VIDRO",
  "SUPREMA",
  "SUPREME",
  "BRISE",
  "GOLD",
  "PRIME",
  "GRID",
  "UNIT",
  "UNNITY",
  "INFINITY",
  "SLIM",
];

function splitSmartCemLineAndLocation(value: string) {
  const normalized = cleanValue(value);
  if (!normalized) return { line: null, location: null };

  for (const lineName of smartCemLineNames) {
    const match = normalized.match(new RegExp(`^(${escapeRegExp(lineName)})(?:\\s+(.+))?$`, "i"));
    if (match) {
      return {
        line: cleanValue(match[1]),
        location: cleanValue(match[2]),
      };
    }
  }

  const numericLineMatch = normalized.match(/^(\d{1,3})(?:\s+(.+))$/);
  if (numericLineMatch) {
    return {
      line: cleanValue(numericLineMatch[1]),
      location: cleanValue(numericLineMatch[2]),
    };
  }

  return { line: normalized, location: null };
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
    const lineAndLocation = splitSmartCemLineAndLocation(line);

    return {
      line: lineAndLocation.line,
      location: lineAndLocation.location,
      quantity,
    };
  }

  return null;
}

function parseSmartCemLayoutTokenLine(line: string): SmartCemPieceData | null {
  const tokens = line.split(/\s+/).filter(Boolean);
  if (tokens.length < 5) return null;

  for (let quantityIndex = 1; quantityIndex <= tokens.length - 4; quantityIndex += 1) {
    const quantityValue = tokens[quantityIndex];
    const widthValue = tokens[quantityIndex + 1];
    const heightValue = tokens[quantityIndex + 2];
    const lineAndLocation = cleanValue(tokens.slice(quantityIndex + 3).join(" "));
    const rowType = cleanValue(tokens.slice(0, quantityIndex).join(" "));

    if (!rowType || !lineAndLocation || !looksLikeSmartCemPieceIdentifier(rowType)) continue;
    if (!/^\d{1,3}$/.test(quantityValue)) continue;
    if (!/^\d{1,5}$/.test(widthValue) || !/^\d{1,5}$/.test(heightValue)) continue;

    const quantity = Number(quantityValue);
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > 999) continue;

    const dimensionOptions = smartCemDimensionOptions(rowType);
    const width = parseDimensionSegment(widthValue, {
      ...dimensionOptions,
      max: WIDE_SMARTCEM_DIMENSION_MM,
    });
    const height = parseDimensionSegment(heightValue, {
      ...dimensionOptions,
      max: WIDE_SMARTCEM_DIMENSION_MM,
    });
    const splitLine = splitSmartCemLineAndLocation(lineAndLocation);
    if (!width || !height || !splitLine.line) continue;

    return {
      code: null,
      quantity,
      width,
      height,
      line: splitLine.line,
      location: splitLine.location,
      rowType,
      source: "layout",
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
        location: parsedLineAndQuantity.location,
        rowType: null,
        source: "collapsed",
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
        location: parsedLineAndQuantity.location,
        rowType: null,
        source: "collapsed",
      };
    }
  }

  const spacedMatch = normalized.match(
    /^([A-Z]{1,4}\d{2}(?:_[A-Z][A-Z0-9]?)?)\s+(\d+)\s+(\d{1,5})\s+(\d{1,5})\s+(.+)$/i,
  );
  if (spacedMatch) {
    const [, code, quantity, width, height, lineAndLocation] = spacedMatch;
    const dimensionOptions = smartCemDimensionOptions(code);
    const parsedWidth = parseDimensionSegment(width, {
      ...dimensionOptions,
      max: WIDE_SMARTCEM_DIMENSION_MM,
    });
    const parsedHeight = parseDimensionSegment(height, {
      ...dimensionOptions,
      max: WIDE_SMARTCEM_DIMENSION_MM,
    });
    const splitLine = splitSmartCemLineAndLocation(lineAndLocation);
    if (!parsedWidth || !parsedHeight || !splitLine.line) return null;

    return {
      code: code.toUpperCase(),
      quantity: Math.max(1, Number(quantity)),
      width: parsedWidth,
      height: parsedHeight,
      line: splitLine.line,
      location: splitLine.location,
      rowType: null,
      source: "layout",
    };
  }

  const tokenLayout = parseSmartCemLayoutTokenLine(normalized);
  if (tokenLayout) return tokenLayout;

  const layoutMatch = normalized.match(/^(.+?)\s+(\d{1,3})\s+(\d{1,5})\s+(\d{1,5})\s+(.+)$/i);
  if (!layoutMatch) return null;

  const [, rowType, quantity, width, height, lineAndLocation] = layoutMatch;
  const dimensionOptions = smartCemDimensionOptions(rowType);
  const parsedWidth = parseDimensionSegment(width, {
    ...dimensionOptions,
    max: WIDE_SMARTCEM_DIMENSION_MM,
  });
  const parsedHeight = parseDimensionSegment(height, {
    ...dimensionOptions,
    max: WIDE_SMARTCEM_DIMENSION_MM,
  });
  const splitLine = splitSmartCemLineAndLocation(lineAndLocation);
  const cleanRowType = cleanValue(rowType);
  if (!cleanRowType || !parsedWidth || !parsedHeight || !splitLine.line) return null;

  return {
    code: null,
    quantity: Math.max(1, Number(quantity)),
    width: parsedWidth,
    height: parsedHeight,
    line: splitLine.line,
    location: splitLine.location,
    rowType: cleanRowType,
    source: "layout",
  };
}

function isStandaloneSmartCemLabel(line: string, label: string) {
  return searchable(line) === searchable(label);
}

function isAnyStandaloneSmartCemLabel(line: string) {
  return ["tipo", "qtd", "l", "h", "linha", "localizacao"].includes(searchable(line));
}

function collectUntilSmartCemLabel(lines: string[], startIndex: number, label: string, maxLines: number) {
  const values: string[] = [];
  let cursor = startIndex;

  while (cursor < lines.length && !isStandaloneSmartCemLabel(lines[cursor], label)) {
    if (isAnyStandaloneSmartCemLabel(lines[cursor]) || isPageOrDocumentMarker(lines[cursor])) return null;
    values.push(lines[cursor]);
    cursor += 1;
    if (values.length > maxLines) return null;
  }

  if (!values.length || cursor >= lines.length) return null;
  return { values, cursor };
}

function readSmartCemScalarAfterLabel(lines: string[], startIndex: number, label: string) {
  if (!isStandaloneSmartCemLabel(lines[startIndex], label)) return null;
  const value = lines[startIndex + 1];
  if (!value || isAnyStandaloneSmartCemLabel(value) || isPageOrDocumentMarker(value)) return null;
  return { value, cursor: startIndex + 2 };
}

function parseSmartCemLabeledBlock(
  lines: string[],
  index: number,
): { data: SmartCemPieceData; endIndex: number } | null {
  if (!isStandaloneSmartCemLabel(lines[index], "tipo")) return null;

  const typeValue = collectUntilSmartCemLabel(lines, index + 1, "qtd", 4);
  if (!typeValue) return null;

  const quantityValue = readSmartCemScalarAfterLabel(lines, typeValue.cursor, "qtd");
  if (!quantityValue) return null;

  const widthValue = readSmartCemScalarAfterLabel(lines, quantityValue.cursor, "l");
  if (!widthValue) return null;

  const heightValue = readSmartCemScalarAfterLabel(lines, widthValue.cursor, "h");
  if (!heightValue) return null;

  const lineValue = readSmartCemScalarAfterLabel(lines, heightValue.cursor, "linha");
  if (!lineValue) return null;

  const locationValue = readSmartCemScalarAfterLabel(lines, lineValue.cursor, "localizacao");
  const rawType = cleanValue(typeValue.values.join(" "));
  const dimensionOptions = smartCemDimensionOptions(rawType);
  const quantity = parseNumber(quantityValue.value, 1);
  const width = parseDimensionSegment(widthValue.value, {
    ...dimensionOptions,
    max: WIDE_SMARTCEM_DIMENSION_MM,
  });
  const height = parseDimensionSegment(heightValue.value, {
    ...dimensionOptions,
    max: WIDE_SMARTCEM_DIMENSION_MM,
  });
  const splitLine = splitSmartCemLineAndLocation(
    [lineValue.value, locationValue?.value].filter(Boolean).join(" "),
  );

  if (!rawType || !width || !height || !splitLine.line) return null;

  return {
    data: {
      code: null,
      quantity: Math.max(1, Math.trunc(quantity)),
      width,
      height,
      line: splitLine.line,
      location: splitLine.location ?? cleanValue(locationValue?.value),
      rowType: rawType,
      source: "labeled",
    },
    endIndex: (locationValue?.cursor ?? lineValue.cursor) - 1,
  };
}

function isLocationLabel(line: string) {
  return searchable(line).startsWith("localiza");
}

function looksLikeProductDescriptionLine(line: string) {
  const normalized = searchable(line);
  return [
    "brise",
    "painel",
    "porta",
    "portao",
    "janela",
    "quadro",
    "portinhola",
    "persiana",
    "pele",
    "guarda",
    "corrimao",
    "perfil",
    "perfis",
    "tubo",
    "fixo",
  ].some((prefix) => normalized.startsWith(`${prefix} `));
}

function findLastProductDescriptionStart(lines: string[]) {
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (looksLikeProductDescriptionLine(lines[index])) return index;
  }

  return -1;
}

function isPieceContextMetadataLine(line: string) {
  const normalized = searchable(line);
  return (
    normalized.startsWith("acabamento") ||
    normalized.startsWith("vidros") ||
    normalized.startsWith("sem vidros") ||
    normalized.startsWith("area esquadria") ||
    normalized.startsWith("tipo")
  );
}

function isSmartCemRowTypeFragment(line: string) {
  const normalized = searchable(line);
  return /^\d+x\d+(?:\s+[a-z0-9]+)?$/.test(normalized) || /\bmux\b/.test(normalized);
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

function hasSmartCemHeaderBefore(lines: string[], index: number, maxDistance: number) {
  for (let cursor = index - 1; cursor >= Math.max(0, index - maxDistance); cursor -= 1) {
    if (isSmartCemHeader(lines[cursor])) return true;
  }

  return false;
}

function isInvalidLocationCandidate(line: string) {
  return (
    isPageOrDocumentMarker(line) ||
    isLocationLabel(line) ||
    isSmartCemHeader(line) ||
    isPieceContextMetadataLine(line) ||
    looksLikeProductDescriptionLine(line) ||
    Boolean(parseSmartCemDataLine(line))
  );
}

function locationAfterDataLine(lines: string[], index: number) {
  const nextLine = lines[index + 1];
  if (!nextLine) return null;

  const inline = valueAfterInlineLabel(nextLine, "Localização");
  if (inline && !isInvalidLocationCandidate(inline)) return inline;

  if (isLocationLabel(nextLine)) {
    const location = lines[index + 2];
    if (location && !isInvalidLocationCandidate(location)) {
      return cleanValue(location);
    }
  }

  return null;
}

function contextBeforeDataLine(lines: string[], index: number) {
  const context: string[] = [];

  for (let cursor = index - 1; cursor >= 0 && context.length < 12; cursor -= 1) {
    const line = lines[cursor];
    if (isPageOrDocumentMarker(line) || isLocationLabel(line) || parseSmartCemDataLine(line)) {
      break;
    }

    if (
      isSmartCemHeader(line) ||
      (cursor > 0 && isSmartCemHeader(lines[cursor - 1])) ||
      (cursor > 1 && isSmartCemHeader(lines[cursor - 2]) && isSmartCemRowTypeFragment(line))
    ) {
      continue;
    }

    if (cursor > 0 && isLocationLabel(lines[cursor - 1]) && !looksLikeProductDescriptionLine(line)) {
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
  const profileStart = descriptionLines.findIndex((line) => searchable(line).startsWith("perfis "));
  const normalizedProductStart = findLastProductDescriptionStart(descriptionLines);
  const effectiveProductStart =
    profileStart >= 0 ? profileStart : normalizedProductStart >= 0 ? normalizedProductStart : productStart;
  const productDescriptionLines =
    effectiveProductStart >= 0 ? descriptionLines.slice(effectiveProductStart) : descriptionLines;

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

function looksLikeSmartCemPieceIdentifier(value: string | null | undefined) {
  const normalized = cleanValue(value);
  if (!normalized) return false;
  if (normalized.length > 36) return false;
  if (!/[a-z]/i.test(normalized)) return false;
  if (/^(porta|portao|janela|quadro|brise|painel|pele|guarda|corrimao)\b/i.test(normalized)) {
    return false;
  }
  if (/^\d+x\d+$/i.test(normalized)) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length > 6) return false;

  return /^[a-z0-9_./ -]+$/i.test(normalized);
}

function smartCemCodeFromRowType(rowType: string | null) {
  const normalized = cleanValue(rowType);
  return looksLikeSmartCemPieceIdentifier(normalized) ? normalized : null;
}

function uniqueSmartCemCode(code: string, pieces: ParsedTechnicalPiece[]) {
  const usedCodes = new Set(pieces.map((piece) => searchable(piece.code)));
  if (!usedCodes.has(searchable(code))) return code;

  for (let suffix = 2; suffix <= 999; suffix += 1) {
    const candidate = `${code}-${String(suffix).padStart(2, "0")}`;
    if (!usedCodes.has(searchable(candidate))) return candidate;
  }

  return `${code}-${pieces.length + 1}`;
}

function rowTypeWithTrailingFragment(rowType: string | null, lines: string[], index: number) {
  const cleanRowType = cleanValue(rowType);
  const nextLine = lines[index + 1];
  if (!cleanRowType || !nextLine || !isSmartCemRowTypeFragment(nextLine)) return cleanRowType;

  const cleanFragment = cleanValue(nextLine);
  if (!cleanFragment || searchable(cleanRowType).includes(searchable(cleanFragment))) return cleanRowType;
  return cleanValue(`${cleanRowType} ${cleanFragment}`);
}

function appendSmartCemPiece(
  lines: string[],
  index: number,
  data: SmartCemPieceData,
  contractNumber: string | null,
  pieces: ParsedTechnicalPiece[],
) {
  const context = contextBeforeDataLine(lines, index);
  const rowType = rowTypeWithTrailingFragment(
    data.rowType ?? rowTypeBeforeDataLine(lines, index),
    lines,
    index,
  );
  const location = data.location ?? locationAfterDataLine(lines, index);
  const code = uniqueSmartCemCode(
    data.code ??
      smartCemCodeFromRowType(rowType) ??
      generatedSmartCemCode(
        contractNumber,
        rowType ?? context.description ?? data.line,
        pieces.length,
      ),
    pieces,
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

function parseSmartCemPieces(lines: string[], contractNumber: string | null) {
  const pieces: ParsedTechnicalPiece[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const labeledBlock = parseSmartCemLabeledBlock(lines, index);
    if (labeledBlock) {
      appendSmartCemPiece(lines, index, labeledBlock.data, contractNumber, pieces);
      index = labeledBlock.endIndex;
      continue;
    }

    const data = parseSmartCemDataLine(lines[index]);
    if (!data) continue;
    if (!data.code && !hasSmartCemHeaderBefore(lines, index, data.source === "layout" ? 8 : 4)) {
      continue;
    }

    appendSmartCemPiece(lines, index, data, contractNumber, pieces);
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

async function renderPdfPageWithLayout(pageData: PdfPageData) {
  const textContent = await pageData.getTextContent({
    normalizeWhitespace: false,
    disableCombineTextItems: false,
  });
  const items = (textContent.items ?? [])
    .filter((item) => item.str?.trim() && item.transform && item.transform.length >= 6)
    .map((item) => ({
      str: item.str?.trim() ?? "",
      x: item.transform?.[4] ?? 0,
      y: item.transform?.[5] ?? 0,
      width: item.width ?? 0,
    }));
  const lines: Array<{ y: number; items: typeof items }> = [];
  const yTolerance = 2.5;

  for (const item of items) {
    let line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= yTolerance);
    if (!line) {
      line = { y: item.y, items: [] };
      lines.push(line);
    }
    line.items.push(item);
  }

  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) => {
      const sorted = line.items.sort((left, right) => left.x - right.x);
      let text = "";
      let lastRight: number | null = null;

      for (const item of sorted) {
        const gap = lastRight === null ? 0 : item.x - lastRight;
        const needsSpace = Boolean(text) && (gap > 1.5 || !/[\s([{/-]$/.test(text));
        text += `${needsSpace ? " " : ""}${item.str}`;
        lastRight = item.x + item.width;
      }

      return text.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

export async function parseTechnicalContractPdf(buffer: Buffer): Promise<TechnicalPdfParseResult> {
  const parsedPdf = await (pdfParse as PdfParseWithOptions)(buffer, {
    pagerender: renderPdfPageWithLayout,
  });
  return parseTechnicalContractText(parsedPdf.text, parsedPdf.numpages);
}
