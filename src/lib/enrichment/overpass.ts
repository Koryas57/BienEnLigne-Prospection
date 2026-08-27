import type { DiscoveredProspect, DiscoveryInput, ProspectDiscoveryProvider, ProspectEnrichmentProvider } from "@/lib/enrichment/contracts";
import type { EnrichmentEvidence, EnrichmentFactKey, EnrichmentValue } from "@/lib/types";
import { classifyWebsiteUrl } from "./website.ts";
import { assessFranchiseSignal, brandSignalLabel, businessCandidateMatches, normalizeUrl, sectorCategory } from "./public-data.ts";

type OsmTags = Record<string, string | undefined>;
type OsmElement = { type: "node" | "way" | "relation"; id: number; lat?: number; lon?: number; center?: { lat?: number; lon?: number }; tags?: OsmTags };
type OverpassPayload = { elements?: OsmElement[] };

let nextAllowedAt = 0;
const discoveryCache = new Map<string, { expiresAt: number; results: DiscoveredProspect[] }>();

function ql(value: string) { return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"'); }
function coordinate(element: OsmElement) { return { latitude: element.lat ?? element.center?.lat, longitude: element.lon ?? element.center?.lon }; }
function first(tags: OsmTags, ...keys: string[]) {
  for (const key of keys) { const value = tags[key]?.trim(); if (value) return value; }
  return undefined;
}
function address(tags: OsmTags) {
  const street = [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" ");
  const locality = [tags["addr:postcode"], tags["addr:city"]].filter(Boolean).join(" ");
  return [street, locality].filter(Boolean).join(", ") || undefined;
}
function categories(tags: OsmTags) {
  return [tags.amenity, tags.shop, tags.craft, tags.office, tags.tourism].filter((value): value is string => Boolean(value));
}
function osmUrl(element: OsmElement) { return `https://www.openstreetmap.org/${element.type}/${element.id}`; }

function toDiscovered(element: OsmElement, category: string): DiscoveredProspect | undefined {
  const tags = element.tags ?? {};
  const businessName = first(tags, "name", "brand");
  if (!businessName) return undefined;
  const position = coordinate(element);
  const brand = tags.brand;
  const brandWikidataId = tags["brand:wikidata"];
  const websiteUrl = normalizeUrl(first(tags, "contact:website", "website"));
  const websiteType = websiteUrl ? classifyWebsiteUrl(websiteUrl) : undefined;
  const franchiseSignal = assessFranchiseSignal({ brand, brandWikidataId, websiteUrl, websiteType });
  return {
    provider: "openstreetmap", providerPlaceId: `${element.type}/${element.id}`, businessName, category,
    address: address(tags), city: tags["addr:city"], state: tags["addr:state"], postcode: tags["addr:postcode"], country: tags["addr:country"],
    ...position, phone: first(tags, "contact:phone", "phone"), email: first(tags, "contact:email", "email"),
    websiteUrl, openingHours: tags.opening_hours, brand, brandWikidataId, operator: tags.operator, officialName: tags.official_name,
    datasource: "OpenStreetMap", franchiseSignal, brandSignalLabel: brandSignalLabel(brand, franchiseSignal), categories: categories(tags),
  };
}

function toEvidence(element: OsmElement, fetchedAt: string): EnrichmentEvidence[] {
  const tags = element.tags ?? {};
  const position = coordinate(element);
  const source = { kind: "openstreetmap" as const, provider: "openstreetmap", label: "OpenStreetMap / Overpass", url: osmUrl(element) };
  const evidence: EnrichmentEvidence[] = [];
  const add = (field: EnrichmentFactKey, value: EnrichmentValue | undefined, confidence = 0.85) => {
    if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) return;
    evidence.push({ field, value, source, fetchedAt, confidence });
  };
  const website = normalizeUrl(first(tags, "contact:website", "website"));
  const websiteType = website ? classifyWebsiteUrl(website) : undefined;
  const brand = tags.brand;
  const brandWikidataId = tags["brand:wikidata"];
  const franchiseSignal = assessFranchiseSignal({ brand, brandWikidataId, websiteUrl: website, websiteType });
  add("businessName", first(tags, "name", "brand")); add("placeId", `${element.type}/${element.id}`, 1);
  add("types", categories(tags)); add("address", address(tags)); add("city", tags["addr:city"]); add("state", tags["addr:state"]);
  add("postcode", tags["addr:postcode"]); add("country", tags["addr:country"]); add("latitude", position.latitude); add("longitude", position.longitude);
  add("phone", first(tags, "contact:phone", "phone")); add("email", first(tags, "contact:email", "email")); add("websiteUrl", website);
  add("openingHours", tags.opening_hours); add("brand", brand); if (brand) add("brandDetected", true, 1);
  add("brandWikidataId", brandWikidataId, 1); add("operator", tags.operator); add("officialName", tags.official_name);
  if (franchiseSignal !== "unknown") add("franchiseSignal", franchiseSignal, franchiseSignal === "likely_franchise" ? 0.9 : 0.85);
  if (franchiseSignal === "likely_franchise" || franchiseSignal === "confirmed_franchise") add("likelyFranchise", true, 0.9);
  add("wiki", first(tags, "wikipedia", "wikidata")); add("datasource", "OpenStreetMap");
  add("instagramUrl", normalizeUrl(first(tags, "contact:instagram", "instagram")));
  add("facebookUrl", normalizeUrl(first(tags, "contact:facebook", "facebook")));
  if (website) {
    add("websiteType", websiteType); add("hasWebsite", websiteType === "dedicated"); add("websiteHttps", new URL(website).protocol === "https:");
  }
  return evidence;
}

export class OverpassProvider implements ProspectEnrichmentProvider, ProspectDiscoveryProvider {
  readonly id = "openstreetmap" as const;
  readonly cacheTtlMs = 3 * 24 * 60 * 60 * 1000;
  private readonly options: { fetchImpl?: typeof fetch; endpoint?: string; rateLimitMs?: number; timeoutMs?: number };
  constructor(options: { fetchImpl?: typeof fetch; endpoint?: string; rateLimitMs?: number; timeoutMs?: number } = {}) {
    this.options = options;
  }

  private async query(query: string) {
    const delay = Math.max(0, nextAllowedAt - Date.now());
    if (delay) await new Promise((resolve) => setTimeout(resolve, delay));
    nextAllowedAt = Date.now() + (this.options.rateLimitMs ?? 1_200);
    const fetchImpl = this.options.fetchImpl ?? fetch;
    const response = await fetchImpl(this.options.endpoint ?? "https://overpass-api.de/api/interpreter", {
      method: "POST", body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(this.options.timeoutMs ?? 15_000),
      headers: {
        Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "BienEnLigne-Prospection/1.0", Referer: process.env.NEXT_PUBLIC_APP_URL ?? "https://bienenligne.fr",
      },
    });
    if (!response.ok) throw new Error("Overpass indisponible");
    return await response.json() as OverpassPayload;
  }

  private discoveryQuery(input: DiscoveryInput) {
    if (!sectorCategory(input.sector)) return undefined;
    return `[out:json][timeout:20];area["boundary"="administrative"]["name"="${ql(input.city)}"]->.searchArea;nwr(area.searchArea)["amenity"="restaurant"]["name"];out center ${Math.min(100, input.limit)};`;
  }

  async discover(input: DiscoveryInput) {
    const query = this.discoveryQuery(input);
    if (!query) return [];
    const cacheKey = JSON.stringify([input.city, input.state, input.country, input.sector, input.limit]);
    const cached = discoveryCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return structuredClone(cached.results);
    const payload = await this.query(query);
    const results = (payload.elements ?? []).map((element) => toDiscovered(element, input.sector)).filter((item): item is DiscoveredProspect => Boolean(item));
    discoveryCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60 * 1000, results });
    return structuredClone(results);
  }

  async enrich(prospect: Parameters<ProspectEnrichmentProvider["enrich"]>[0], fetchedAt: string) {
    try {
      if (!sectorCategory(prospect.category)) return { status: "skipped" as const, message: "Secteur sans correspondance OSM vérifiée" };
      const query = `[out:json][timeout:20];area["boundary"="administrative"]["name"="${ql(prospect.city)}"]->.searchArea;nwr(area.searchArea)["amenity"="restaurant"]["name"~"${ql(prospect.businessName)}",i];out center 10;`;
      const payload = await this.query(query);
      const match = payload.elements?.find((element) => {
        const tags = element.tags ?? {};
        return businessCandidateMatches(prospect, {
          businessName: first(tags, "name", "brand"),
          city: tags["addr:city"], state: tags["addr:state"], country: tags["addr:country"],
        }, { geographicallyConstrained: true });
      });
      if (!match) return { status: "no_match" as const, message: "Aucun établissement suffisamment fiable" };
      return { status: "success" as const, evidence: toEvidence(match, fetchedAt) };
    } catch { return { status: "error" as const, message: "OpenStreetMap / Overpass indisponible" }; }
  }
}
