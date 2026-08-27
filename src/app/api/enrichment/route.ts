import { NextResponse } from "next/server";
import { z } from "zod";
import { enrichProspectOnServer } from "@/lib/enrichment/server";
import { hasAuthenticatedApiSession } from "@/lib/supabase/api-auth";

const triState = z.union([z.boolean(), z.literal("unknown")]);
const evidenceSchema = z.object({
  field: z.enum(["businessName", "address", "city", "state", "postcode", "country", "latitude", "longitude", "types", "placeId", "rating", "reviewCount", "phone", "email", "websiteUrl", "instagramUrl", "facebookUrl", "googleMapsUrl", "businessStatus", "openingHours", "datasource", "brand", "brandWikidataId", "brandDetected", "operator", "officialName", "franchiseSignal", "wiki", "websiteType", "hasWebsite", "websiteHttps", "googlePresence", "instagramActive", "facebookActive", "independentBusiness", "likelyFranchise"]),
  value: z.union([z.string(), z.number(), z.boolean(), z.array(z.string())]),
  source: z.object({
    kind: z.enum(["manual", "geoapify", "openstreetmap", "direct_inspection", "web_search", "llm_interpretation"]),
    provider: z.string(), label: z.string(), url: z.string().url().optional(),
  }),
  fetchedAt: z.string(), confidence: z.number().min(0).max(1).optional(),
});
const providerRunSchema = z.object({
  provider: z.string(),
  status: z.enum(["success", "not_configured", "no_match", "error", "skipped"]),
  fetchedAt: z.string(), cached: z.boolean().optional(), message: z.string().optional(),
});
const enrichmentSchema = z.object({
  version: z.literal(1), fetchedAt: z.string(), providers: z.array(providerRunSchema), evidence: z.array(evidenceSchema),
  conflicts: z.array(z.object({ field: evidenceSchema.shape.field, selected: evidenceSchema, alternatives: z.array(evidenceSchema) })),
  prequalification: z.enum(["reject", "low", "potential", "strong"]).optional(),
});
const prospectSchema = z.object({
  businessName: z.string().trim().min(1).max(240),
  category: z.string().max(160),
  city: z.string().max(160),
  state: z.string().max(160),
  country: z.string().max(160),
  address: z.string().max(500).optional(),
  phone: z.string().max(100).optional(),
  email: z.string().email().max(320).optional(),
  websiteUrl: z.string().url().max(2048).optional(),
  instagramUrl: z.string().url().max(2048).optional(),
  facebookUrl: z.string().url().max(2048).optional(),
  googleMapsUrl: z.string().url().max(2048).optional(),
  rating: z.number().min(0).max(5).optional(),
  reviewCount: z.number().int().nonnegative().optional(),
  hasWebsite: triState,
  websiteType: z.enum(["dedicated", "link_in_bio", "social_profile", "marketplace", "booking_platform", "unknown"]).optional(),
  websiteHttps: triState,
  instagramActive: triState,
  facebookActive: triState,
  googlePresence: triState,
  independentBusiness: triState,
  likelyFranchise: triState,
}).passthrough();

const requestSchema = z.object({ prospect: prospectSchema, existing: enrichmentSchema.optional() });

export async function POST(request: Request) {
  if (!await hasAuthenticatedApiSession()) return NextResponse.json(
    { error: { code: "unauthorized", message: "Non autorisé" } },
    { status: 401 },
  );
  const body: unknown = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json(
    { error: { code: "invalid_request", message: "Données d’enrichissement invalides" } },
    { status: 400 },
  );
  return NextResponse.json({ data: await enrichProspectOnServer(parsed.data.prospect, parsed.data.existing) });
}
