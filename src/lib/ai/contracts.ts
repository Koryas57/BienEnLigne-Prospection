import type { DataMode, Prospect, ProspectEnrichment } from "@/lib/types";

export const DEFAULT_OPENAI_MODEL = "gpt-5.6-terra";

export type OpenAIErrorCode =
  | "not_configured"
  | "invalid_auth"
  | "quota_or_rate_limit"
  | "model_unavailable"
  | "timeout_or_unavailable"
  | "invalid_request"
  | "unauthorized";

export type OpenAIPublicStatus = {
  configured: boolean;
  model: string;
};

export type OpenAIErrorPayload = {
  error: {
    code: OpenAIErrorCode;
    message: string;
  };
};

export function isOpenAIConfigured(apiKey: string | undefined) {
  return Boolean(apiKey?.trim());
}

export function resolveOpenAIModel(model: string | undefined) {
  return model?.trim() || DEFAULT_OPENAI_MODEL;
}

export function shouldUseOpenAIWebSearch(enabled: boolean, prospect: Partial<Prospect>, enrichment?: ProspectEnrichment) {
  if (!enabled) return false;
  const materialConflicts = new Set(["businessStatus", "hasWebsite", "websiteType", "likelyFranchise", "independentBusiness"]);
  if (enrichment?.conflicts.some((conflict) => materialConflicts.has(conflict.field))) return true;
  const hasBrandSignal = enrichment?.evidence.some((item) => item.field === "brand" && typeof item.value === "string" && item.value.trim());
  return Boolean(hasBrandSignal && prospect.likelyFranchise === "unknown");
}

export async function resolveAIRequest<T>(mode: DataMode, request: () => Promise<T>, demoFallback: () => T) {
  try {
    return { data: await request(), demo: false } as const;
  } catch (error) {
    if (mode === "supabase") throw error;
    return { data: demoFallback(), demo: true } as const;
  }
}
