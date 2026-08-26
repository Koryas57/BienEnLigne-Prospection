import { NextResponse } from "next/server";
import { aiRequestSchema, analysisSchema, messageSchema, replyAnalysisSchema } from "@/lib/ai/schemas";
import { analysisPrompt, messagePrompt, replyPrompt } from "@/lib/ai/prompts";
import { generateValidated } from "@/lib/ai/openai";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  const parsed = aiRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Données invalides", details: parsed.error.flatten() }, { status: 400 });
  try {
    if (parsed.data.task === "analyzeProspect") return NextResponse.json({ data: await generateValidated(analysisPrompt(parsed.data.prospect), analysisSchema), demo: false });
    if (parsed.data.task === "generateOutreachMessage") return NextResponse.json({ data: await generateValidated(messagePrompt(parsed.data.prospect, parsed.data.campaign, parsed.data.channel, parsed.data.kind), messageSchema), demo: false });
    return NextResponse.json({ data: await generateValidated(replyPrompt(parsed.data.prospect, parsed.data.reply), replyAnalysisSchema), demo: false });
  } catch (error) {
    const notConfigured = error instanceof Error && error.message === "OPENAI_NOT_CONFIGURED";
    return NextResponse.json({ error: notConfigured ? "OpenAI n’est pas configuré. Utilisez le fallback Demo AI result." : "Le service IA est temporairement indisponible." }, { status: notConfigured ? 503 : 502 });
  }
}
