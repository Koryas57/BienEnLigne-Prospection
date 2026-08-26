import "server-only";
import OpenAI from "openai";
import type { ZodType } from "zod";
import { isOpenAIConfigured, resolveOpenAIModel, type OpenAIPublicStatus } from "@/lib/ai/contracts";
import { OpenAINotConfiguredError } from "@/lib/ai/errors";

export function getOpenAIPublicStatus(): OpenAIPublicStatus {
  return {
    configured: isOpenAIConfigured(process.env.OPENAI_API_KEY),
    model: resolveOpenAIModel(process.env.OPENAI_MODEL),
  };
}

function createOpenAIClient(options: { timeout: number; maxRetries: number }) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new OpenAINotConfiguredError();
  return new OpenAI({ apiKey, ...options });
}

export async function generateValidated<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  const client = createOpenAIClient({ timeout: 20_000, maxRetries: 1 });
  const { model } = getOpenAIPublicStatus();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.responses.create({ model, input: prompt });
      const cleaned = response.output_text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      return schema.parse(JSON.parse(cleaned));
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Réponse IA invalide.");
}

export async function testOpenAIAvailability() {
  const status = getOpenAIPublicStatus();
  const client = createOpenAIClient({ timeout: 8_000, maxRetries: 0 });
  await client.responses.create({
    model: status.model,
    input: "Reply OK.",
    max_output_tokens: 16,
    reasoning: { effort: "none" },
  });
  return status;
}
