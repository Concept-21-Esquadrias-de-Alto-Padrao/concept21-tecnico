import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { parseNumber, textOrNull } from "@/lib/utils";

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

function normalizeLines(text: string) {
  return text
    .replace(/\uFFFD/g, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function matchAfterLabel(lines: string[], labels: string[]) {
  for (const line of lines) {
    for (const label of labels) {
      const pattern = new RegExp(`^${label}\\s*[:\\-]?\\s*(.+)$`, "i");
      const match = line.match(pattern);
      if (match?.[1]) return match[1].trim();
    }
  }
  return null;
}

function parseBrazilianDate(value: string | null) {
  if (!value) return null;
  const match = value.match(/(\d{2})[\/.-](\d{2})[\/.-](\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function inferContractNumber(lines: string[]) {
  const labeled = matchAfterLabel(lines, ["contrato", "número do contrato", "numero do contrato"]);
  const source = labeled ?? lines.find((line) => /contrato/i.test(line));
  const match = source?.match(/(?:contrato\s*)?(?:n[ºo]\.?\s*)?([A-Z0-9][A-Z0-9./-]{3,})/i);
  return match?.[1]?.trim() ?? null;
}

function inferDeadline(lines: string[]) {
  const line = lines.find((item) => /prazo/i.test(item));
  const match = line?.match(/(\d+)\s*dias?\s*(úteis|uteis|corridos)?/i);
  if (!match) return { value: null, unit: "dias_uteis" as const };
  return {
    value: Number(match[1]),
    unit: /corrido/i.test(match[2] ?? "") ? ("dias_corridos" as const) : ("dias_uteis" as const),
  };
}

function parseAuthorizedContacts(lines: string[]) {
  const contacts: Array<{ name: string; role?: string | null; phone?: string | null }> = [];
  const start = lines.findIndex((line) => /respons[aá]veis autorizados|contatos autorizados/i.test(line));
  if (start < 0) return contacts;

  for (const line of lines.slice(start + 1, start + 8)) {
    if (/pe[cç]as|itens|desenhos|observa/i.test(line)) break;
    const phoneMatch = line.match(/(\(?\d{2}\)?\s?\d{4,5}[-\s]?\d{4})/);
    const cleaned = line.replace(phoneMatch?.[1] ?? "", "").replace(/^[-•]\s*/, "").trim();
    if (cleaned.length >= 3) {
      contacts.push({
        name: cleaned.split(/\s+-\s+|\s+\|\s+/)[0]?.trim() || cleaned,
        role: cleaned.includes("-") ? cleaned.split("-").slice(1).join("-").trim() : null,
        phone: phoneMatch?.[1] ?? null,
      });
    }
  }

  return contacts;
}

function parsePieceLine(line: string): ParsedTechnicalPiece | null {
  const normalized = line.replace(/\s+/g, " ").trim();
  const codeMatch = normalized.match(/^([A-Z]{1,6}\d{1,4}(?:[_-][A-Z0-9]+)?)/i);
  if (!codeMatch) return null;

  const code = codeMatch[1].toUpperCase();
  const quantityMatch = normalized.match(/(?:qtde|qtd|quantidade)\s*[:\-]?\s*(\d+)/i) ?? normalized.match(/\s(\d+)\s*(?:un|pç|pc|pcs)\b/i);
  const dimensionMatch =
    normalized.match(/(\d{2,5})\s*[xX]\s*(\d{2,5})/) ??
    normalized.match(/L(?:argura)?\s*[:\-]?\s*(\d{2,5}).*A(?:ltura)?\s*[:\-]?\s*(\d{2,5})/i);
  const environmentMatch = normalized.match(/(?:ambiente|local)\s*[:\-]?\s*([^|;]+)/i);
  const glassMatch = normalized.match(/(?:vidro)\s*[:\-]?\s*([^|;]+)/i);
  const colorMatch = normalized.match(/(?:cor)\s*[:\-]?\s*([^|;]+)/i);
  const lineMatch = normalized.match(/(?:linha|sistema)\s*[:\-]?\s*([^|;]+)/i);
  const typeMatch = normalized.match(/(?:tipo)\s*[:\-]?\s*([^|;]+)/i);

  return {
    code,
    piece_type: textOrNull(typeMatch?.[1]) ?? null,
    quantity: Math.max(1, Math.trunc(parseNumber(quantityMatch?.[1] ?? "1", 1))),
    sale_width_mm: dimensionMatch?.[1] ? parseNumber(dimensionMatch[1], 0) : null,
    sale_height_mm: dimensionMatch?.[2] ? parseNumber(dimensionMatch[2], 0) : null,
    environment: textOrNull(environmentMatch?.[1]) ?? null,
    description: normalized.slice(code.length).trim() || null,
    glass: textOrNull(glassMatch?.[1]) ?? null,
    color: textOrNull(colorMatch?.[1]) ?? null,
    line: textOrNull(lineMatch?.[1]) ?? null,
  };
}

export function parseTechnicalContractText(text: string, pages = 1): TechnicalPdfParseResult {
  const lines = normalizeLines(text);
  const warnings: string[] = [];
  const deadline = inferDeadline(lines);
  const contractDateLine = matchAfterLabel(lines, ["data do contrato", "data"]);
  const contract: ParsedTechnicalContract = {
    contract_number: inferContractNumber(lines),
    client_name: matchAfterLabel(lines, ["cliente", "contratante", "nome do cliente"]),
    contract_date: parseBrazilianDate(contractDateLine),
    work_address: matchAfterLabel(lines, ["endereço da obra", "endereco da obra", "obra endereço", "obra endereco", "endereço"]),
    work_name: matchAfterLabel(lines, ["obra", "nome da obra"]),
    description: matchAfterLabel(lines, ["descrição", "descricao", "objeto"]),
    deadline_value: deadline.value,
    deadline_unit: deadline.unit,
    authorized_contacts: parseAuthorizedContacts(lines),
    commercial_data: {
      origem_importacao: "pdf_contrato",
    },
  };

  const pieceMap = new Map<string, ParsedTechnicalPiece>();
  for (const line of lines) {
    const piece = parsePieceLine(line);
    if (piece && !pieceMap.has(piece.code)) {
      pieceMap.set(piece.code, piece);
    }
  }
  const pieces = Array.from(pieceMap.values());

  if (!contract.contract_number) warnings.push("Número do contrato não identificado.");
  if (!contract.client_name) warnings.push("Cliente não identificado.");
  if (!pieces.length) warnings.push("Nenhuma peça foi identificada nos desenhos anexados.");

  return {
    contract,
    pieces,
    pages,
    warnings,
    rawTextSample: lines.slice(0, 80).join("\n"),
  };
}

export async function parseTechnicalContractPdf(buffer: Buffer): Promise<TechnicalPdfParseResult> {
  const parsedPdf = await pdfParse(buffer);
  return parseTechnicalContractText(parsedPdf.text, parsedPdf.numpages);
}
