type ContractNumberRow = {
  contract_number: string | null | undefined;
};

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[–—]/g, "-")
    .trim();
}

function canonicalContractNumber(year: string, sequence: string, suffix = "") {
  const normalizedYear = year.length === 1 ? `2${year}` : year.slice(-2);
  const normalizedSequence = sequence.padStart(4, "0");
  return `${normalizedYear}-${normalizedSequence}${suffix.replace(/[^A-Z]/g, "")}`;
}

export function normalizeContractNumberKey(value: string | null | undefined) {
  const normalized = normalizeText(value ?? "");
  if (!normalized) return "";

  const compact = normalized.replace(/\s+/g, "");
  const fullMatch = compact.match(/^(\d{1,2})[-/.]?(\d{3,5})([A-Z]{0,4})$/);
  if (fullMatch) {
    const [, year, sequence, suffix] = fullMatch;
    return canonicalContractNumber(year, sequence, suffix);
  }

  const separatedMatch = normalized.match(
    /(?:^|[^A-Z0-9])(\d{1,2})\s*[-/.]\s*(\d{3,5})\s*([A-Z]{0,4})(?=$|[^A-Z0-9])/,
  );
  if (separatedMatch) {
    const [, year, sequence, suffix] = separatedMatch;
    return canonicalContractNumber(year, sequence, suffix);
  }

  return compact.replace(/[^A-Z0-9]/g, "");
}

export function sameContractNumber(left: string | null | undefined, right: string | null | undefined) {
  const leftKey = normalizeContractNumberKey(left);
  const rightKey = normalizeContractNumberKey(right);
  return Boolean(leftKey && rightKey && leftKey === rightKey);
}

export function findBestContractNumberMatch<T extends ContractNumberRow>(
  rows: T[],
  contractNumber: string | null | undefined,
) {
  const targetKey = normalizeContractNumberKey(contractNumber);
  if (!targetKey) return null;

  const targetText = normalizeText(contractNumber ?? "");
  const exactMatch = rows.find((row) => normalizeText(row.contract_number ?? "") === targetText);
  if (exactMatch) return exactMatch;

  return rows.find((row) => normalizeContractNumberKey(row.contract_number) === targetKey) ?? null;
}
