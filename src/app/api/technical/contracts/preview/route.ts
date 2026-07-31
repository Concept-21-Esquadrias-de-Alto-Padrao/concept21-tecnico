import { NextResponse } from "next/server";
import { parseTechnicalContractPdf } from "@/lib/technical-pdf";
import { getErrorMessage, getHttpStatus, HttpError, requirePermissionAccess } from "@/lib/server-access";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(error: unknown, fallback: string) {
  return NextResponse.json(
    { error: getErrorMessage(error, fallback) },
    { status: getHttpStatus(error) },
  );
}

export async function POST(request: Request) {
  try {
    const context = hasSupabaseEnv()
      ? await requirePermissionAccess(
          "technical.contracts.import_pdf",
          "Você não possui permissão para importar contratos por PDF.",
        )
      : null;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new HttpError(400, "Envie um PDF válido.");
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new HttpError(400, "O PDF deve ter até 10 MB.");
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseTechnicalContractPdf(buffer);
    let duplicateContract = false;
    let duplicatePieceCodes: string[] = [];

    if (context && parsed.contract.contract_number) {
      const { data: contractData, error: contractError } = await context.admin
        .from("production_contracts")
        .select("id")
        .eq("company_id", context.profile.company_id)
        .eq("contract_number", parsed.contract.contract_number)
        .eq("active", true)
        .limit(1);

      if (contractError) throw new HttpError(500, contractError.message);
      duplicateContract = Boolean((contractData ?? []).length);
    }

    if (context && parsed.pieces.length) {
      const pieceCodes = parsed.pieces.map((piece) => piece.code);
      const { data: piecesData, error: piecesError } = await context.admin
        .from("technical_contract_pieces")
        .select("code")
        .eq("company_id", context.profile.company_id)
        .in("code", pieceCodes);

      if (piecesError && piecesError.code !== "42P01") throw new HttpError(500, piecesError.message);
      duplicatePieceCodes = ((piecesData ?? []) as Array<{ code: string }>).map((piece) => piece.code);
    }

    const warnings = [...parsed.warnings];
    if (duplicateContract) warnings.push("Contrato duplicado encontrado. A gravação será bloqueada até revisão.");
    if (duplicatePieceCodes.length) {
      warnings.push(`${duplicatePieceCodes.length} peça(s) com código já existente no módulo técnico.`);
    }

    return NextResponse.json({
      fileName: file.name,
      ...parsed,
      duplicateContract,
      duplicatePieceCodes,
      warnings,
    });
  } catch (error) {
    return jsonError(error, "Não foi possível ler a prévia do PDF.");
  }
}
