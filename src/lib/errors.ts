export function toUserFriendlyErrorMessage(error: unknown, fallback = "Não foi possível concluir a operação.") {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error) {
    const message = String((error as { message?: unknown }).message ?? "");
    if (message) return message;
  }
  return fallback;
}
