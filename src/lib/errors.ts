type ErrorLike = {
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  issues?: unknown;
  message?: unknown;
  name?: unknown;
};

type IssueLike = {
  message?: unknown;
};

function errorParts(error: unknown) {
  if (typeof error === "string") return [error];
  if (error instanceof Error) return [error.name, error.message];
  if (typeof error === "object" && error) {
    const candidate = error as ErrorLike;
    return [candidate.name, candidate.code, candidate.message, candidate.details, candidate.hint]
      .map((value) => (typeof value === "string" ? value : ""))
      .filter(Boolean);
  }
  return [];
}

function rawMessage(error: unknown) {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as ErrorLike).message ?? "");
  }
  return "";
}

function firstIssueMessage(error: unknown) {
  if (!error || typeof error !== "object" || !("issues" in error)) return "";
  const issues = (error as ErrorLike).issues;
  if (!Array.isArray(issues)) return "";
  const firstIssue = issues[0] as IssueLike | undefined;
  return typeof firstIssue?.message === "string" ? firstIssue.message : "";
}

function isTechnicalMessage(message: string) {
  const normalized = message.toLowerCase();
  return [
    "duplicate key",
    "foreign key",
    "violates",
    "constraint",
    "null value in column",
    "invalid input syntax",
    "invalid input:",
    "expected nonoptional",
    "received undefined",
    "schema cache",
    "postgrest",
    "jwt",
    "failed to fetch",
  ].some((pattern) => normalized.includes(pattern));
}

export function toUserFriendlyErrorMessage(error: unknown, fallback = "Não foi possível concluir a operação.") {
  const technicalText = errorParts(error).join(" ");
  const normalized = technicalText.toLowerCase();
  const issueMessage = firstIssueMessage(error);

  if (issueMessage) {
    return isTechnicalMessage(issueMessage) ? fallback : issueMessage;
  }

  if (normalized.includes("technical_pieces_code_active_idx")) {
    return "Existem peças com o mesmo código neste contrato. Revise os códigos repetidos na lista de peças e tente gravar novamente.";
  }

  if (normalized.includes("production_contracts_company_id_contract_number_key")) {
    return "Já existe um contrato ativo com este número. Abra o contrato existente ou altere o número antes de gravar.";
  }

  if (normalized.includes("duplicate key value violates unique constraint")) {
    return "Já existe um cadastro com essas mesmas informações. Revise os dados repetidos e tente novamente.";
  }

  if (normalized.includes("foreign key") || normalized.includes("violates foreign key constraint")) {
    return "Não foi possível concluir porque este registro está vinculado a outros dados do sistema.";
  }

  if (normalized.includes("null value in column") || normalized.includes("not-null constraint")) {
    return "Preencha todos os campos obrigatórios antes de salvar.";
  }

  if (normalized.includes("invalid input syntax")) {
    return "Há uma informação em formato inválido. Atualize a página, confira os campos e tente novamente.";
  }

  if (normalized.includes("row-level security") || normalized.includes("permission denied")) {
    return "Seu usuário não tem permissão para executar esta operação.";
  }

  if (normalized.includes("schema cache") || normalized.includes("could not find the table")) {
    return "A estrutura do banco ainda não está atualizada. Aplique as migrations pendentes e tente novamente.";
  }

  const message = rawMessage(error);
  if (message && !isTechnicalMessage(message)) return message;

  return fallback;
}
