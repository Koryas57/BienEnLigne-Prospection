import "server-only";
import type { DiscoveryInput } from "@/lib/enrichment/contracts";
import { deduplicateProspects } from "@/lib/enrichment/public-data";
import { GeoapifyProvider } from "@/lib/enrichment/geoapify";
import { OverpassProvider } from "@/lib/enrichment/overpass";

export async function discoverProspectsOnServer(input: DiscoveryInput) {
  const geoapify = new GeoapifyProvider(process.env.GEOAPIFY_API_KEY);
  const overpass = new OverpassProvider();
  if (process.env.GEOAPIFY_API_KEY?.trim()) {
    try {
      const results = deduplicateProspects(await geoapify.discover(input));
      if (results.length) return { results, provider: "geoapify" as const, preview: true, duplicatesRemoved: 0 };
    } catch { /* Le repli communautaire reste indépendant. */ }
  }
  const raw = await overpass.discover(input);
  const results = deduplicateProspects(raw);
  return { results, provider: "openstreetmap" as const, preview: true, duplicatesRemoved: raw.length - results.length };
}
