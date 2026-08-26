import OpenAI from "openai";
import type { ZodType } from "zod";

export async function generateValidated<T>(prompt: string, schema: ZodType<T>): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_NOT_CONFIGURED");
  const client = new OpenAI({ apiKey, timeout: 20_000, maxRetries: 1 });
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await client.responses.create({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", input: prompt });
      const cleaned = response.output_text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
      return schema.parse(JSON.parse(cleaned));
    } catch (error) { lastError = error; }
  }
  throw lastError instanceof Error ? lastError : new Error("Réponse IA invalide.");
}
