import type { DiscoveredProspect, FranchiseSignal } from "@/lib/enrichment/contracts";
import type { WebsiteType } from "@/lib/types";

export function normalizeText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

const genericBusinessTokens = new Set([
  "a", "an", "and", "the", "of",
  "restaurant", "restaurants", "cafe", "coffee", "bar", "grill", "kitchen", "market", "shop", "store",
  "company", "co", "llc", "inc", "food", "foods", "cuisine", "dining", "eatery",
  "mediterranean", "mexican", "italian", "chinese", "thai", "vietnamese", "pizza", "pizzeria", "bbq", "barbecue",
]);

const usStateAliases = new Map<string, string>();
for (const entry of "AL:Alabama,AK:Alaska,AZ:Arizona,AR:Arkansas,CA:California,CO:Colorado,CT:Connecticut,DE:Delaware,FL:Florida,GA:Georgia,HI:Hawaii,ID:Idaho,IL:Illinois,IN:Indiana,IA:Iowa,KS:Kansas,KY:Kentucky,LA:Louisiana,ME:Maine,MD:Maryland,MA:Massachusetts,MI:Michigan,MN:Minnesota,MS:Mississippi,MO:Missouri,MT:Montana,NE:Nebraska,NV:Nevada,NH:New Hampshire,NJ:New Jersey,NM:New Mexico,NY:New York,NC:North Carolina,ND:North Dakota,OH:Ohio,OK:Oklahoma,OR:Oregon,PA:Pennsylvania,RI:Rhode Island,SC:South Carolina,SD:South Dakota,TN:Tennessee,TX:Texas,UT:Utah,VT:Vermont,VA:Virginia,WA:Washington,WV:West Virginia,WI:Wisconsin,WY:Wyoming,DC:District of Columbia".split(",")) {
  const [code, name] = entry.split(":");
  usStateAliases.set(normalizeText(code), code.toLowerCase());
  usStateAliases.set(normalizeText(name), code.toLowerCase());
}

function identityTokens(value: string) {
  return normalizeText(value).split(" ").filter((token) => token && !genericBusinessTokens.has(token));
}

export function namesMatch(expected: string, actual: string | undefined) {
  if (!actual) return false;
  const left = normalizeText(expected);
  const right = normalizeText(actual);
  if (!left || !right) return false;
  if (left === right) return true;
  const expectedTokens = identityTokens(expected);
  const actualTokens = identityTokens(actual);
  if (!expectedTokens.length || !actualTokens.length) return false;
  const expectedSet = new Set(expectedTokens);
  const actualSet = new Set(actualTokens);
  if (expectedSet.size === actualSet.size && [...expectedSet].every((token) => actualSet.has(token))) return true;
  const shared = [...expectedSet].filter((token) => actualSet.has(token));
  const union = new Set([...expectedSet, ...actualSet]);
  const additional = [...union].filter((token) => !expectedSet.has(token) || !actualSet.has(token));
  return shared.length > 0
    && shared.length === Math.min(expectedSet.size, actualSet.size)
    && shared.length / union.size >= 2 / 3
    && additional.every((token) => token.length <= 3);
}

function normalizeCountry(value: string) {
  const normalized = normalizeText(value);
  if (new Set(["us", "usa", "united states", "united states of america", "etats unis", "etats unis d amerique"]).has(normalized)) return "us";
  return normalized;
}

function normalizeState(value: string) {
  const normalized = normalizeText(value);
  return usStateAliases.get(normalized) ?? normalized;
}

function normalizeCity(value: string) {
  return normalizeText(value).replace(/^city of /, "");
}

export interface BusinessLocation {
  city?: string;
  state?: string;
  country?: string;
}

export function geographyMatches(expected: BusinessLocation, actual: BusinessLocation, options: { geographicallyConstrained?: boolean; exactName?: boolean } = {}) {
  const comparisons = [
    [expected.country, actual.country, normalizeCountry],
    [expected.state, actual.state, normalizeState],
    [expected.city, actual.city, normalizeCity],
  ] as const;
  for (const [left, right, normalize] of comparisons) {
    if (left && right && normalize(left) !== normalize(right)) return false;
  }
  if (options.geographicallyConstrained) return true;
  if (!expected.city && !expected.state && !expected.country) return true;
  if (expected.city && actual.city) return true;
  if (expected.state && actual.state && options.exactName) return true;
  if (!expected.city && expected.state && actual.state) return true;
  if (!expected.city && !expected.state && expected.country && actual.country) return true;
  return false;
}

export function businessCandidateMatches(
  expected: { businessName: string } & BusinessLocation,
  actual: { businessName?: string } & BusinessLocation,
  options: { geographicallyConstrained?: boolean } = {},
) {
  if (!actual.businessName || !namesMatch(expected.businessName, actual.businessName)) return false;
  return geographyMatches(expected, actual, {
    geographicallyConstrained: options.geographicallyConstrained,
    exactName: normalizeText(expected.businessName) === normalizeText(actual.businessName),
  });
}

export function sectorCategory(sector: string) {
  return normalizeText(sector) === "restaurant" ? "catering.restaurant" : undefined;
}

export function normalizeUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    return new Set(["http:", "https:"]).has(url.protocol) ? url.toString() : undefined;
  } catch { return undefined; }
}

export function assessFranchiseSignal(input: {
  brand?: string;
  brandWikidataId?: string;
  websiteUrl?: string;
  websiteType?: WebsiteType;
}): FranchiseSignal {
  if (!input.brand?.trim()) return "unknown";
  if (!input.websiteUrl || input.websiteType !== "dedicated") return "brand_detected";
  try {
    const url = new URL(input.websiteUrl);
    const hostname = normalizeText(url.hostname.replace(/^www\./, "")).replaceAll(" ", "");
    const brandTokens = normalizeText(input.brand).split(" ").filter((token) => token.length >= 3);
    const brandedHostname = brandTokens.some((token) => hostname.includes(token));
    const locatorPattern = /(^|\.)(locations?|restaurants?|stores?)\./i.test(url.hostname)
      || /\/(locations?|restaurants?|stores?|find-a-location)(\/|$)/i.test(url.pathname);
    return brandedHostname && (locatorPattern || Boolean(input.brandWikidataId)) ? "likely_franchise" : "brand_detected";
  } catch { return "brand_detected"; }
}

export function brandSignalLabel(brand: string | undefined, signal: FranchiseSignal) {
  if (!brand || signal === "unknown") return undefined;
  if (signal === "confirmed_franchise") return `Marque : ${brand} · Franchise confirmée`;
  if (signal === "likely_franchise") return `Marque : ${brand} · Chaîne probable`;
  return `Marque : ${brand}`;
}

export function deduplicateProspects(items: DiscoveredProspect[]) {
  const output: DiscoveredProspect[] = [];
  const providerIds = new Set<string>();
  const nameAddresses = new Set<string>();
  const phones = new Set<string>();
  const hostnames = new Set<string>();
  for (const item of items) {
    const providerId = `${item.provider}:${item.providerPlaceId}`;
    const nameAddress = `${normalizeText(item.businessName)}|${normalizeText(item.address ?? "")}`;
    const phone = item.phone?.replace(/\D/g, "");
    let hostname: string | undefined;
    try { hostname = item.websiteUrl ? new URL(item.websiteUrl).hostname.replace(/^www\./, "") : undefined; } catch { hostname = undefined; }
    const closeCoordinate = output.some((candidate) => {
      if (candidate.latitude === undefined || candidate.longitude === undefined || item.latitude === undefined || item.longitude === undefined) return false;
      return normalizeText(candidate.businessName) === normalizeText(item.businessName)
        && Math.abs(candidate.latitude - item.latitude) < 0.0005
        && Math.abs(candidate.longitude - item.longitude) < 0.0005;
    });
    if (providerIds.has(providerId) || nameAddresses.has(nameAddress) || (phone && phones.has(phone)) || (hostname && hostnames.has(hostname)) || closeCoordinate) continue;
    output.push(item);
    providerIds.add(providerId);
    nameAddresses.add(nameAddress);
    if (phone) phones.add(phone);
    if (hostname) hostnames.add(hostname);
  }
  return output;
}
