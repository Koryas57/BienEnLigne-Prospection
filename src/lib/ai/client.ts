import type { OpenAIErrorPayload } from "@/lib/ai/contracts";
import type { ProspectEnrichment } from "@/lib/types";

export async function requestAI<T>(body: unknown): Promise<T> {
  const response = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const apiError = payload as Partial<OpenAIErrorPayload> | null;
    throw new Error(apiError?.error?.message || "L’appel OpenAI a échoué.");
  }
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Réponse OpenAI invalide.");
  return (payload as { data: T }).data;
}

export async function requestProspectEnrichment<T>(prospect: unknown, existing?: ProspectEnrichment): Promise<T> {
  const response = await fetch("/api/enrichment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prospect, existing }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = payload && typeof payload === "object" && "error" in payload
      ? String((payload as { error?: { message?: unknown } }).error?.message ?? "")
      : "";
    throw new Error(message || "L’enrichissement du prospect a échoué.");
  }
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Réponse d’enrichissement invalide.");
  return (payload as { data: T }).data;
}
