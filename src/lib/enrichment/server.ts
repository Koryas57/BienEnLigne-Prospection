import "server-only";
import { GeoapifyProvider } from "@/lib/enrichment/geoapify";
import { OverpassProvider } from "@/lib/enrichment/overpass";
import { WebsiteInspectionProvider } from "@/lib/enrichment/website";
import { runProspectEnrichment } from "@/lib/enrichment/resolve";
import type { EnrichmentProspect } from "@/lib/enrichment/contracts";
import type { ProspectEnrichment } from "@/lib/types";
import type { Prospect } from "@/lib/types";
import { prequalifyProspect } from "@/lib/scoring";

export async function enrichProspectOnServer(prospect: EnrichmentProspect, existing?: ProspectEnrichment) {
  const result = await runProspectEnrichment({
    prospect,
    existing,
    providers: [
      new GeoapifyProvider(process.env.GEOAPIFY_API_KEY),
      new WebsiteInspectionProvider(),
    ],
    fallbackProviders: [new OverpassProvider()],
  });
  const prequalification = prequalifyProspect(result.enrichedProspect as Prospect);
  result.enrichment.prequalification = prequalification.tier;
  result.prospectPatch.enrichment = result.enrichment;
  return { ...result, prequalification: { tier: prequalification.tier, score: prequalification.score, reason: prequalification.reason } };
}
