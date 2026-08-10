import { NextResponse } from "next/server";
import { parseTechnicalContractPdf } from "@/lib/technical-pdf";
import { toUserFriendlyErrorMessage } from "@/lib/errors";
import { findDuplicateTechnicalPieceCodes } from "@/lib/technical-piece-codes";
import { getHttpStatus, HttpError, requirePermissionAccess } from "@/lib/server-access";
import { hasSupabaseEnv } from "@/lib/supabase/server";

export const runtime = "nodejs";

function jsonError(error: unknown, fallback: string) {
  return NextResponse.json(
    { error: toUserFriendlyErrorMessage(error, fallback) },
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

    duplicatePieceCodes = findDuplicateTechnicalPieceCodes(parsed.pieces);

    const warnings = [...parsed.warnings];
    if (duplicateContract) warnings.push("Contrato duplicado encontrado. A gravação será bloqueada até revisão.");
    if (duplicatePieceCodes.length) {
      warnings.push(
        `${duplicatePieceCodes.length} código(s) de peça aparecem repetidos neste PDF. Ao gravar, o sistema acrescentará sufixos para manter os códigos únicos.`,
      );
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
