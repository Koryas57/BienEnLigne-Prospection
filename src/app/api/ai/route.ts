import { NextResponse } from "next/server";
import { aiRequestSchema, analysisSchema, messageSchema, replyAnalysisSchema } from "@/lib/ai/schemas";
import { analysisPrompt, messagePrompt, replyPrompt } from "@/lib/ai/prompts";
import type { OpenAIErrorPayload } from "@/lib/ai/contracts";
import { openAIErrorPayload } from "@/lib/ai/errors";
import { generateValidated } from "@/lib/ai/openai";
import { hasAuthenticatedApiSession } from "@/lib/supabase/api-auth";

export async function POST(request: Request) {
  if (!await hasAuthenticatedApiSession()) return NextResponse.json(
    { error: { code: "unauthorized", message: "Non autorisé" } } satisfies OpenAIErrorPayload,
    { status: 401 },
  );
  const body: unknown = await request.json().catch(() => null);
  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(
    { error: { code: "invalid_request", message: "Données invalides" } } satisfies OpenAIErrorPayload,
    { status: 400 },
  );
  try {
    if (parsed.data.task === "analyzeProspect") return NextResponse.json({ data: await generateValidated(analysisPrompt(parsed.data.prospect), analysisSchema), demo: false });
    if (parsed.data.task === "generateOutreachMessage") return NextResponse.json({ data: await generateValidated(messagePrompt(parsed.data.prospect, parsed.data.campaign, parsed.data.channel, parsed.data.kind), messageSchema), demo: false });
    return NextResponse.json({ data: await generateValidated(replyPrompt(parsed.data.prospect, parsed.data.reply), replyAnalysisSchema), demo: false });
  } catch (error) {
    const response = openAIErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
