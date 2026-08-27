import type { DiscoveredProspect, DiscoveryInput, ProspectDiscoveryProvider, ProspectEnrichmentProvider } from "@/lib/enrichment/contracts";
import type { EnrichmentEvidence, EnrichmentFactKey, EnrichmentValue } from "@/lib/types";
import { classifyWebsiteUrl } from "./website.ts";
import { assessFranchiseSignal, brandSignalLabel, businessCandidateMatches, geographyMatches, namesMatch, normalizeUrl, sectorCategory } from "./public-data.ts";

type GeoProperties = Record<string, unknown> & {
  place_id?: string; name?: string; formatted?: string; city?: string; state?: string; postcode?: string; country?: string;
  state_code?: string; country_code?: string;
  lat?: number; lon?: number; categories?: string[]; website?: string; opening_hours?: string; brand?: string; operator?: string; official_name?: string;
  brand_details?: { wikidata?: string; wikipedia?: string; website?: string };
  name_other?: { official_name?: string };
  datasource?: { sourcename?: string; attribution?: string; url?: string; raw?: Record<string, unknown> };
  contact?: { phone?: string; email?: string };
};

type GeoFeature = { properties?: GeoProperties };
type GeoCollection = { features?: GeoFeature[]; results?: GeoProperties[] };

function properties(payload: GeoCollection) {
  return payload.results ?? payload.features?.map((feature) => feature.properties ?? {}) ?? [];
}

function stringValue(value: unknown) { return typeof value === "string" && value.trim() ? value.trim() : undefined; }
function numberValue(value: unknown) { return typeof value === "number" && Number.isFinite(value) ? value : undefined; }
function stringList(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : undefined; }

function placeLocation(place: GeoProperties) {
  return {
    city: stringValue(place.city),
    state: stringValue(place.state) ?? stringValue(place.state_code),
    country: stringValue(place.country) ?? stringValue(place.country_code),
  };
}

function rawValue(place: GeoProperties, ...keys: string[]) {
  const raw = place.datasource?.raw;
  for (const key of keys) {
    const value = raw?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function placeContact(place: GeoProperties) {
  return {
    phone: stringValue(place.contact?.phone) ?? rawValue(place, "phone", "contact:phone"),
    email: stringValue(place.contact?.email) ?? rawValue(place, "email", "contact:email"),
    website: normalizeUrl(place.website) ?? normalizeUrl(rawValue(place, "website", "contact:website")),
  };
}

function placeBrand(place: GeoProperties) {
  const brand = stringValue(place.brand) ?? rawValue(place, "brand");
  const brandWikidataId = stringValue(place.brand_details?.wikidata) ?? rawValue(place, "brand:wikidata", "brand_wikidata");
  const operator = stringValue(place.operator) ?? rawValue(place, "operator");
  const officialName = stringValue(place.official_name) ?? stringValue(place.name_other?.official_name) ?? rawValue(place, "official_name");
  return { brand, brandWikidataId, operator, officialName };
}

function evidenceFor(place: GeoProperties, fetchedAt: string): EnrichmentEvidence[] {
  const evidence: EnrichmentEvidence[] = [];
  const contact = placeContact(place);
  const brandFacts = placeBrand(place);
  const websiteType = contact.website ? classifyWebsiteUrl(contact.website) : undefined;
  const franchiseSignal = assessFranchiseSignal({
    brand: brandFacts.brand, brandWikidataId: brandFacts.brandWikidataId, websiteUrl: contact.website, websiteType,
  });
  const lat = numberValue(place.lat);
  const lon = numberValue(place.lon);
  const sourceUrl = lat !== undefined && lon !== undefined ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}` : undefined;
  const source = { kind: "geoapify" as const, provider: "geoapify", label: "Geoapify (données publiques)", url: sourceUrl };
  const add = (field: EnrichmentFactKey, value: EnrichmentValue | undefined, confidence = 0.92) => {
    if (value === undefined || value === "" || (Array.isArray(value) && !value.length)) return;
    evidence.push({ field, value, fetchedAt, confidence, source });
  };
  add("businessName", stringValue(place.name));
  add("placeId", stringValue(place.place_id), 1);
  add("types", stringList(place.categories));
  add("address", stringValue(place.formatted));
  add("city", stringValue(place.city)); add("state", stringValue(place.state));
  add("postcode", stringValue(place.postcode)); add("country", stringValue(place.country));
  add("latitude", lat); add("longitude", lon);
  add("phone", contact.phone); add("email", contact.email); add("websiteUrl", contact.website);
  add("openingHours", stringValue(place.opening_hours) ?? rawValue(place, "opening_hours"));
  add("datasource", stringValue(place.datasource?.sourcename) ?? stringValue(place.datasource?.attribution));
  add("brand", brandFacts.brand);
  if (brandFacts.brand) add("brandDetected", true, 1);
  add("brandWikidataId", brandFacts.brandWikidataId, 1);
  add("operator", brandFacts.operator);
  add("officialName", brandFacts.officialName);
  if (franchiseSignal !== "unknown") add("franchiseSignal", franchiseSignal, franchiseSignal === "likely_franchise" ? 0.95 : 0.9);
  if (franchiseSignal === "likely_franchise" || franchiseSignal === "confirmed_franchise") add("likelyFranchise", true, 0.95);
  add("wiki", rawValue(place, "wikipedia", "wikidata"));
  add("instagramUrl", normalizeUrl(rawValue(place, "contact:instagram", "instagram")));
  add("facebookUrl", normalizeUrl(rawValue(place, "contact:facebook", "facebook")));
  if (contact.website) {
    add("websiteType", websiteType);
    add("hasWebsite", websiteType === "dedicated");
    add("websiteHttps", new URL(contact.website).protocol === "https:");
  }
  return evidence;
}

function discovered(place: GeoProperties, category: string): DiscoveredProspect | undefined {
  const businessName = stringValue(place.name);
  const providerPlaceId = stringValue(place.place_id);
  if (!businessName || !providerPlaceId) return undefined;
  const contact = placeContact(place);
  const brandFacts = placeBrand(place);
  const websiteType = contact.website ? classifyWebsiteUrl(contact.website) : undefined;
  const franchiseSignal = assessFranchiseSignal({
    brand: brandFacts.brand, brandWikidataId: brandFacts.brandWikidataId, websiteUrl: contact.website, websiteType,
  });
  return {
    provider: "geoapify", providerPlaceId, businessName, category,
    address: stringValue(place.formatted), city: stringValue(place.city), state: stringValue(place.state),
    postcode: stringValue(place.postcode), country: stringValue(place.country), latitude: numberValue(place.lat), longitude: numberValue(place.lon),
    phone: contact.phone, email: contact.email, websiteUrl: contact.website,
    brand: brandFacts.brand, brandWikidataId: brandFacts.brandWikidataId, operator: brandFacts.operator,
    officialName: brandFacts.officialName,
    datasource: stringValue(place.datasource?.sourcename) ?? stringValue(place.datasource?.attribution),
    franchiseSignal, brandSignalLabel: brandSignalLabel(brandFacts.brand, franchiseSignal),
    openingHours: stringValue(place.opening_hours) ?? rawValue(place, "opening_hours"), categories: stringList(place.categories) ?? [],
  };
}

export class GeoapifyProvider implements ProspectEnrichmentProvider, ProspectDiscoveryProvider {
  readonly id = "geoapify" as const;
  readonly cacheTtlMs = 7 * 24 * 60 * 60 * 1000;
  private readonly apiKey: string | undefined;
  private readonly fetchImpl: typeof fetch;
  constructor(apiKey: string | undefined, fetchImpl: typeof fetch = fetch) {
    this.apiKey = apiKey;
    this.fetchImpl = fetchImpl;
  }

  private async request(path: string, params: Record<string, string>) {
    const url = new URL(`https://api.geoapify.com${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    url.searchParams.set("apiKey", this.apiKey!.trim());
    const response = await this.fetchImpl(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8_000) });
    if (!response.ok) throw new Error("Geoapify indisponible");
    return await response.json() as GeoCollection;
  }

  private async candidatesFor(prospect: Parameters<ProspectEnrichmentProvider["enrich"]>[0]) {
    const category = sectorCategory(prospect.category);
    if (prospect.city && category) {
      const cityQuery = [prospect.city, prospect.state, prospect.country].filter(Boolean).join(", ");
      const cities = properties(await this.request("/v1/geocode/search", { text: cityQuery, type: "city", format: "json", limit: "5", lang: "fr" }));
      const city = cities.find((candidate) => namesMatch(prospect.city, stringValue(candidate.city) ?? stringValue(candidate.name))
        && geographyMatches(prospect, placeLocation(candidate)));
      if (!city?.place_id) return { candidates: [] as GeoProperties[], geographicallyConstrained: true };
      const candidates = properties(await this.request("/v2/places", {
        categories: category, filter: `place:${city.place_id}`, limit: "100", lang: "fr",
      }));
      return { candidates, geographicallyConstrained: true };
    }
    const query = [prospect.businessName, prospect.address, prospect.city, prospect.state, prospect.country].filter(Boolean).join(", ");
    const candidates = properties(await this.request("/v1/geocode/search", { text: query, format: "json", limit: "5", lang: "fr" }));
    return { candidates, geographicallyConstrained: false };
  }

  async enrich(prospect: Parameters<ProspectEnrichmentProvider["enrich"]>[0], fetchedAt: string) {
    if (!this.apiKey?.trim()) return { status: "not_configured" as const, message: "Geoapify non configuré" };
    try {
      const { candidates, geographicallyConstrained } = await this.candidatesFor(prospect);
      const match = candidates.find((candidate) => businessCandidateMatches(prospect, {
        businessName: stringValue(candidate.name), ...placeLocation(candidate),
      }, { geographicallyConstrained }));
      if (!match) return { status: "no_match" as const, message: "Aucun établissement suffisamment fiable" };
      let combined = match;
      const contact = placeContact(match);
      const needsDetails = Boolean(match.place_id) && !contact.phone && !contact.email && !contact.website && !match.opening_hours;
      if (needsDetails) {
        const details = properties(await this.request("/v2/place-details", { id: match.place_id!, features: "details", lang: "fr" }))[0];
        if (details) combined = { ...match, ...details, datasource: details.datasource ?? match.datasource };
      }
      const evidence = evidenceFor(combined, fetchedAt);
      return evidence.length ? { status: "success" as const, evidence } : { status: "no_match" as const, message: "Aucune donnée exploitable" };
    } catch { return { status: "error" as const, message: "Geoapify indisponible" }; }
  }

  async discover(input: DiscoveryInput) {
    if (!this.apiKey?.trim()) throw new Error("Geoapify non configuré");
    const category = sectorCategory(input.sector);
    if (!category) return [];
    const cityQuery = [input.city, input.state, input.country].filter(Boolean).join(", ");
    const cities = properties(await this.request("/v1/geocode/search", { text: cityQuery, type: "city", format: "json", limit: "5", lang: "fr" }));
    const city = cities.find((candidate) => namesMatch(input.city, stringValue(candidate.city) ?? stringValue(candidate.name))
      && geographyMatches(input, placeLocation(candidate)));
    if (!city?.place_id) return [];
    const places = properties(await this.request("/v2/places", {
      categories: category, filter: `place:${city.place_id}`, limit: String(Math.min(100, input.limit)), lang: "fr",
    }));
    return places.map((place) => discovered(place, input.sector)).filter((item): item is DiscoveredProspect => Boolean(item));
  }
}
