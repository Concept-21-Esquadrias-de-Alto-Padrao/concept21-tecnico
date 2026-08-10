type PieceWithCode = {
  code: string;
};

function fallbackPieceCode(index: number) {
  return `P${String(index + 1).padStart(2, "0")}`;
}

function normalizePieceCode(value: string | null | undefined, index: number) {
  return (value ?? "").replace(/\s+/g, " ").trim() || fallbackPieceCode(index);
}

function codeKey(value: string) {
  return value.toLocaleLowerCase("pt-BR");
}

export function ensureUniqueTechnicalPieceCodes<T extends PieceWithCode>(pieces: T[]) {
  const usedCodes = new Set<string>();
  const duplicateCodeKeys = new Set<string>();
  const duplicateCodes = new Set<string>();
  let adjustedCount = 0;

  const normalizedPieces = pieces.map((piece, index) => {
    const baseCode = normalizePieceCode(piece.code, index);
    let code = baseCode;
    let suffix = 2;

    const baseKey = codeKey(baseCode);
    if (usedCodes.has(baseKey) && !duplicateCodeKeys.has(baseKey)) {
      duplicateCodeKeys.add(baseKey);
      duplicateCodes.add(baseCode);
    }

    while (usedCodes.has(codeKey(code))) {
      code = `${baseCode}-${String(suffix).padStart(2, "0")}`;
      suffix += 1;
    }

    usedCodes.add(codeKey(code));
    if (code !== piece.code) adjustedCount += 1;

    return { ...piece, code };
  });

  return {
    adjustedCount,
    duplicateCodes: Array.from(duplicateCodes),
    pieces: normalizedPieces,
  };
}

export function findDuplicateTechnicalPieceCodes(pieces: PieceWithCode[]) {
  return ensureUniqueTechnicalPieceCodes(pieces).duplicateCodes;
}
