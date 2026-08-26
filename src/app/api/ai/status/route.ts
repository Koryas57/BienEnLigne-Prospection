import { NextResponse } from "next/server";
import type { OpenAIErrorPayload } from "@/lib/ai/contracts";
import { openAIErrorPayload } from "@/lib/ai/errors";
import { getOpenAIPublicStatus, testOpenAIAvailability } from "@/lib/ai/openai";
import { hasAuthenticatedApiSession } from "@/lib/supabase/api-auth";

const unauthorized = () => NextResponse.json(
  { error: { code: "unauthorized", message: "Non autorisé" } } satisfies OpenAIErrorPayload,
  { status: 401 },
);

export async function GET() {
  if (!await hasAuthenticatedApiSession()) return unauthorized();
  return NextResponse.json({ data: getOpenAIPublicStatus() });
}

export async function POST() {
  if (!await hasAuthenticatedApiSession()) return unauthorized();
  try {
    const status = await testOpenAIAvailability();
    return NextResponse.json({ data: { ...status, operational: true, message: `Connexion OpenAI opérationnelle - ${status.model}` } });
  } catch (error) {
    const response = openAIErrorPayload(error);
    return NextResponse.json(response.body, { status: response.status });
  }
}
