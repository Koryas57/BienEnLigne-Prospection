import { NextResponse } from "next/server";
import { z } from "zod";
import { discoverProspectsOnServer } from "@/lib/enrichment/discovery";
import { hasAuthenticatedApiSession } from "@/lib/supabase/api-auth";

const requestSchema = z.object({
  city: z.string().trim().min(1).max(160),
  state: z.string().trim().max(160).optional(),
  country: z.string().trim().max(160).optional(),
  sector: z.string().trim().min(1).max(160),
  limit: z.number().int().min(1).max(100).default(100),
});

export async function POST(request: Request) {
  if (!await hasAuthenticatedApiSession()) return NextResponse.json(
    { error: { code: "unauthorized", message: "Non autorisé" } }, { status: 401 },
  );
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json(
    { error: { code: "invalid_request", message: "Critères de découverte invalides" } }, { status: 400 },
  );
  try {
    return NextResponse.json({ data: await discoverProspectsOnServer(parsed.data) });
  } catch {
    return NextResponse.json(
      { error: { code: "provider_unavailable", message: "Les sources publiques sont temporairement indisponibles" } }, { status: 503 },
    );
  }
}
