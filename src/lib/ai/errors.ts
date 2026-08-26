import OpenAI from "openai";
import type { OpenAIErrorCode, OpenAIErrorPayload } from "@/lib/ai/contracts";

export class OpenAINotConfiguredError extends Error {
  constructor() {
    super("OpenAI is not configured");
    this.name = "OpenAINotConfiguredError";
  }
}

type PublicOpenAIError = OpenAIErrorPayload["error"] & { status: number };

const publicErrors: Record<Exclude<OpenAIErrorCode, "unauthorized">, PublicOpenAIError> = {
  not_configured: { code: "not_configured", message: "OpenAI n’est pas configuré sur le serveur.", status: 503 },
  invalid_auth: { code: "invalid_auth", message: "L’authentification OpenAI a échoué. Vérifiez la clé serveur.", status: 502 },
  quota_or_rate_limit: { code: "quota_or_rate_limit", message: "Le quota, les crédits ou la limite de débit OpenAI ne permettent pas cette opération.", status: 429 },
  model_unavailable: { code: "model_unavailable", message: "Le modèle OpenAI configuré n’est pas disponible pour ce projet.", status: 502 },
  timeout_or_unavailable: { code: "timeout_or_unavailable", message: "OpenAI ne répond pas actuellement. Réessayez plus tard.", status: 503 },
  invalid_request: { code: "invalid_request", message: "La requête OpenAI a été refusée par le service.", status: 502 },
};

export function classifyOpenAIError(error: unknown): PublicOpenAIError {
  if (error instanceof OpenAINotConfiguredError) return publicErrors.not_configured;
  if (error instanceof OpenAI.RateLimitError) return publicErrors.quota_or_rate_limit;
  if (error instanceof OpenAI.NotFoundError) return publicErrors.model_unavailable;
  if (error instanceof OpenAI.BadRequestError && (error.code === "model_not_found" || error.param === "model")) return publicErrors.model_unavailable;
  if (error instanceof OpenAI.PermissionDeniedError && (error.code === "model_not_found" || error.param === "model")) return publicErrors.model_unavailable;
  if (error instanceof OpenAI.AuthenticationError || error instanceof OpenAI.PermissionDeniedError) return publicErrors.invalid_auth;
  if (error instanceof OpenAI.BadRequestError || error instanceof OpenAI.UnprocessableEntityError) return publicErrors.invalid_request;
  if (error instanceof OpenAI.APIConnectionTimeoutError || error instanceof OpenAI.APIConnectionError || error instanceof OpenAI.InternalServerError) return publicErrors.timeout_or_unavailable;
  if (error instanceof OpenAI.APIError && error.status === 429) return publicErrors.quota_or_rate_limit;
  return publicErrors.timeout_or_unavailable;
}

export function openAIErrorPayload(error: unknown) {
  const classified = classifyOpenAIError(error);
  return {
    body: { error: { code: classified.code, message: classified.message } } satisfies OpenAIErrorPayload,
    status: classified.status,
  };
}
