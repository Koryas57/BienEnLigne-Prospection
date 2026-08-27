import "server-only";
import OpenAI from "openai";
import type { Response as OpenAIResponse } from "openai/resources/responses/responses";
import { toJSONSchema, type ZodType } from "zod";
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

type GenerationOptions = { schemaName?: string; webSearch?: boolean };

function webSources(response: OpenAIResponse) {
  const urls = response.output.flatMap((item) => item.type === "web_search_call" && item.action.type === "search"
    ? (item.action.sources ?? []).map((source) => source.url)
    : []);
  return [...new Set(urls)].map((url) => {
    try { return { title: new URL(url).hostname, url }; }
    catch { return { title: "Source web", url }; }
  });
}

export async function generateValidatedWithMetadata<T>(prompt: string, schema: ZodType<T>, options: GenerationOptions = {}) {
  const client = createOpenAIClient({ timeout: 20_000, maxRetries: 1 });
  const { model } = getOpenAIPublicStatus();
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.responses.create({
        model,
        input: prompt,
        store: false,
        text: { format: { type: "json_schema", name: options.schemaName ?? "validated_response", strict: true, schema: toJSONSchema(schema) } },
        ...(options.webSearch ? {
          tools: [{ type: "web_search" as const, search_context_size: "low" as const }],
          tool_choice: "auto" as const,
          max_tool_calls: 2,
          include: ["web_search_call.action.sources" as const],
        } : {}),
      });
      const cleaned = response.output_text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      return { data: schema.parse(JSON.parse(cleaned)), webSources: webSources(response) };
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Réponse IA invalide.");
}

export async function generateValidated<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  return (await generateValidatedWithMetadata(prompt, schema)).data;
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
