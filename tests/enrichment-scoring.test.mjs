import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GeoapifyProvider } from "../src/lib/enrichment/geoapify.ts";
import { OverpassProvider } from "../src/lib/enrichment/overpass.ts";
import { runProspectEnrichment } from "../src/lib/enrichment/resolve.ts";
import { classifyWebsiteUrl, WebsiteInspectionProvider } from "../src/lib/enrichment/website.ts";
import { prequalifyProspect, scoreProspect, shouldAnalyzeWithOpenAI } from "../src/lib/scoring.ts";

const baseProspect = {
  id: "prospect-test", campaignId: "campaign-test", businessName: "Test Restaurant", category: "Restaurant",
  city: "Little Rock", state: "AR", country: "US", timezone: "America/Chicago", source: "Test", status: "NEW",
  leadScore: 0, qualificationReason: "À analyser", hasWebsite: "unknown", websiteMobileFriendly: "unknown",
  websiteHttps: "unknown", instagramActive: "unknown", facebookActive: "unknown", googlePresence: "unknown",
  independentBusiness: "unknown", likelyFranchise: "unknown", createdAt: "2026-08-26T00:00:00.000Z", updatedAt: "2026-08-26T00:00:00.000Z",
};
const publicDns = async () => ["93.184.216.34"];
const okFetch = async () => new Response("", { status: 200, headers: { "content-type": "text/html" } });

function geoEnrichmentFixture(place) {
  return new GeoapifyProvider("fixture-key", async (url) => String(url).includes("/v1/geocode/search")
    ? Response.json({ results: [{ place_id: "little-rock-boundary", name: "Little Rock", city: "Little Rock", state: "AR", country: "US" }] })
    : Response.json({ features: [{ properties: place }] }));
}

test("Geoapify absent reste explicitement non configuré et ne déclenche aucun appel", async () => {
  let called = false;
  const provider = new GeoapifyProvider(undefined, async () => { called = true; return new Response(); });
  const result = await provider.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(result.status, "not_configured");
  assert.equal(called, false);
});

test("Geoapify mappe uniquement des faits publics réels et ne fabrique aucun avis", async () => {
  const calls = [];
  const provider = new GeoapifyProvider("server-test-key", async (url) => {
    calls.push(String(url));
    if (String(url).includes("/v1/geocode/search")) return Response.json({ results: [{
      place_id: "little-rock-boundary", name: "Little Rock", city: "Little Rock", state: "Arkansas", country: "United States",
    }] });
    return Response.json({ features: [{ properties: {
      place_id: "geo-place-1", name: "Test Restaurant", formatted: "1 Main St, Little Rock, AR 72201, USA",
      city: "Little Rock", state: "Arkansas", postcode: "72201", country: "United States", lat: 34.7, lon: -92.3,
      categories: ["catering.restaurant"], website: "https://testrestaurant.example",
      opening_hours: "Mo-Fr 09:00-17:00", contact: { phone: "+1 501-555-0100", email: "hello@testrestaurant.example" },
      brand: "Test Brand", datasource: { sourcename: "openstreetmap", raw: { wikidata: "Q123" } },
    } }] });
  });
  const result = await provider.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(result.status, "success");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /\/v1\/geocode\/search/);
  assert.match(calls[1], /\/v2\/places/);
  assert.equal(result.evidence.find((item) => item.field === "phone")?.value, "+1 501-555-0100");
  assert.equal(result.evidence.find((item) => item.field === "address")?.value, "1 Main St, Little Rock, AR 72201, USA");
  assert.equal(result.evidence.find((item) => item.field === "latitude")?.value, 34.7);
  assert.deepEqual(result.evidence.find((item) => item.field === "types")?.value, ["catering.restaurant"]);
  assert.equal(result.evidence.find((item) => item.field === "hasWebsite")?.value, true);
  assert.equal(result.evidence.some((item) => item.field === "rating" || item.field === "reviewCount"), false);
  assert.equal(result.evidence.every((item) => item.source.kind === "geoapify"), true);
  assert.doesNotMatch(JSON.stringify(result), /server-test-key/);
});

test("une réponse Geoapify vide reste un no_match explicite", async () => {
  const result = await new GeoapifyProvider("fixture-key", async () => Response.json({ results: [] })).enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(result.status, "no_match");
  assert.equal(result.evidence, undefined);
});

test("Geoapify isole les erreurs sans exposer la clé ni la réponse brute", async () => {
  const provider = new GeoapifyProvider("secret-provider-key", async () => new Response("private provider detail", { status: 429 }));
  const result = await provider.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(result.status, "error");
  assert.doesNotMatch(JSON.stringify(result), /secret-provider-key|private provider detail/);
});

test("une chaîne Geoapify suffisamment établie peut être rejetée sans OpenAI", async () => {
  const provider = geoEnrichmentFixture({
    place_id: "waffle-house-1", name: "Waffle House", official_name: "Waffle House #488", brand: "Waffle House",
    website: "https://locations.wafflehouse.com/littlerock-ar-488/", phone: "+1-501-224-3047",
    categories: ["catering.restaurant"], datasource: { sourcename: "openstreetmap", raw: { "brand:wikidata": "Q212133", operator: "WH Capital, LLC" } },
  });
  const enriched = await runProspectEnrichment({ prospect: { ...baseProspect, businessName: "Waffle House" }, providers: [provider] });
  const prospect = { ...baseProspect, businessName: "Waffle House", ...enriched.prospectPatch };
  const prequalification = prequalifyProspect(prospect);
  assert.equal(enriched.prospectPatch.likelyFranchise, true);
  assert.equal(enriched.enrichment.evidence.find((item) => item.field === "brand")?.value, "Waffle House");
  assert.equal(enriched.enrichment.evidence.find((item) => item.field === "brandWikidataId")?.value, "Q212133");
  assert.equal(enriched.enrichment.evidence.find((item) => item.field === "officialName")?.value, "Waffle House #488");
  assert.equal(prequalification.tier, "reject");
  assert.equal(shouldAnalyzeWithOpenAI(prequalification.tier), false);
});

test("brand seul survit à l’enrichment sans devenir franchise ni reject", async () => {
  const provider = geoEnrichmentFixture({
    place_id: "local-brand-1", name: "Purple Cow", brand: "Purple Cow", phone: "+1-501-221-3555",
    categories: ["catering.restaurant"], datasource: { sourcename: "openstreetmap" },
  });
  const enriched = await runProspectEnrichment({ prospect: { ...baseProspect, businessName: "Purple Cow" }, providers: [provider] });
  const prospect = { ...baseProspect, businessName: "Purple Cow", ...enriched.prospectPatch };
  assert.equal(enriched.enrichment.evidence.find((item) => item.field === "brand")?.value, "Purple Cow");
  assert.equal(enriched.enrichment.evidence.find((item) => item.field === "brandDetected")?.value, true);
  assert.equal(enriched.enrichment.evidence.find((item) => item.field === "franchiseSignal")?.value, "brand_detected");
  assert.equal(enriched.enrichment.evidence.some((item) => item.field === "likelyFranchise"), false);
  assert.equal(prospect.likelyFranchise, "unknown");
  assert.notEqual(prequalifyProspect(prospect).tier, "reject");
});

test("Overpass mappe les tags OSM utiles sans note ni avis", async () => {
  let request;
  const provider = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async (url, init) => {
    request = { url: String(url), init };
    return Response.json({ elements: [{ type: "node", id: 42, lat: 34.74, lon: -92.28, tags: {
      name: "Test Restaurant", amenity: "restaurant", "addr:housenumber": "1", "addr:street": "Main St",
      "addr:city": "Little Rock", phone: "+15015550100", website: "testrestaurant.example", opening_hours: "Mo-Sa 11:00-21:00",
    } }] });
  } });
  const result = await provider.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(result.status, "success");
  assert.equal(request.url, "https://overpass-api.de/api/interpreter");
  assert.equal(request.init.headers["User-Agent"], "BienEnLigne-Prospection/1.0");
  assert.match(String(request.init.body), /timeout%3A20/);
  assert.equal(result.evidence.find((item) => item.field === "websiteUrl")?.value, "https://testrestaurant.example/");
  assert.equal(result.evidence.some((item) => item.field === "rating" || item.field === "reviewCount"), false);
});

test("Overpass tolère les tags partiels et isole une panne réseau", async () => {
  const partial = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async () => Response.json({ elements: [{ type: "node", id: 9, tags: { name: "Test Restaurant", amenity: "restaurant" } }] }) });
  const partialResult = await partial.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(partialResult.status, "success");
  assert.equal(partialResult.evidence.some((item) => item.field === "phone"), false);
  const unavailable = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async () => { throw new Error("private network detail"); } });
  const error = await unavailable.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(error.status, "error");
  assert.doesNotMatch(JSON.stringify(error), /private network detail/);
});

test("Overpass rejette un nom exact lorsque les tags contredisent la géographie connue", async () => {
  const provider = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async () => Response.json({ elements: [{
    type: "node", id: 77, tags: {
      name: "Test Restaurant", amenity: "restaurant", "addr:city": "Dallas", "addr:state": "Texas", "addr:country": "US",
    },
  }] }) });
  const result = await provider.enrich(baseProspect, baseProspect.updatedAt);
  assert.equal(result.status, "no_match");
  assert.equal(result.evidence, undefined);
});

test("le repli Overpass ne s’exécute que si Geoapify n’apporte aucun fait", async () => {
  let fallbackCalls = 0;
  const geoSuccess = { id: "geo", cacheTtlMs: 0, async enrich(_prospect, fetchedAt) { return { status: "success", evidence: [{ field: "phone", value: "123", fetchedAt, source: { kind: "geoapify", provider: "geo", label: "Geo" } }] }; } };
  const fallback = { id: "osm", cacheTtlMs: 0, async enrich(_prospect, fetchedAt) { fallbackCalls++; return { status: "success", evidence: [{ field: "email", value: "x@example.com", fetchedAt, source: { kind: "openstreetmap", provider: "osm", label: "OSM" } }] }; } };
  await runProspectEnrichment({ prospect: baseProspect, providers: [geoSuccess], fallbackProviders: [fallback] });
  assert.equal(fallbackCalls, 0);
  const noMatchGeo = { id: "geo", cacheTtlMs: 0, async enrich() { return { status: "no_match" }; } };
  const result = await runProspectEnrichment({ prospect: baseProspect, providers: [noMatchGeo], fallbackProviders: [fallback] });
  assert.equal(fallbackCalls, 1);
  assert.equal(result.prospectPatch.email, "x@example.com");
});

test("la priorité est manuel puis Geoapify puis OSM puis inspection directe", async () => {
  const providers = [
    { id: "geo", cacheTtlMs: 0, async enrich(_prospect, fetchedAt) { return { status: "success", evidence: [{ field: "phone", value: "geo", fetchedAt, source: { kind: "geoapify", provider: "geo", label: "Geo" } }] }; } },
    { id: "osm", cacheTtlMs: 0, async enrich(_prospect, fetchedAt) { return { status: "success", evidence: [{ field: "phone", value: "osm", fetchedAt, source: { kind: "openstreetmap", provider: "osm", label: "OSM" } }] }; } },
    { id: "web", cacheTtlMs: 0, async enrich(_prospect, fetchedAt) { return { status: "success", evidence: [{ field: "phone", value: "inspection", fetchedAt, source: { kind: "direct_inspection", provider: "web", label: "Web" } }] }; } },
  ];
  const external = await runProspectEnrichment({ prospect: baseProspect, providers });
  assert.equal(external.prospectPatch.phone, "geo");
  const manual = await runProspectEnrichment({ prospect: { ...baseProspect, phone: "manual" }, providers });
  assert.equal(manual.prospectPatch.phone, "manual");
  assert.equal(manual.enrichment.conflicts.find((item) => item.field === "phone")?.alternatives.length, 3);
});

test("le cache persistant évite un nouvel appel Geoapify pendant plusieurs jours", async () => {
  let calls = 0;
  const provider = { id: "geoapify", cacheTtlMs: 7 * 86_400_000, async enrich(_prospect, fetchedAt) { calls++; return { status: "success", evidence: [{ field: "phone", value: "123", fetchedAt, source: { kind: "geoapify", provider: "geoapify", label: "Geo" } }] }; } };
  const first = await runProspectEnrichment({ prospect: baseProspect, providers: [provider], now: new Date("2026-08-26T00:00:00Z") });
  const second = await runProspectEnrichment({ prospect: baseProspect, providers: [provider], existing: first.enrichment, now: new Date("2026-08-28T00:00:00Z") });
  assert.equal(calls, 1);
  assert.equal(second.enrichment.providers[0].cached, true);
});

test("l’inspection distingue site dédié et plateformes non dédiées sans contradiction", async () => {
  assert.equal(classifyWebsiteUrl("https://restaurant.example/menu"), "dedicated");
  assert.equal(classifyWebsiteUrl("https://linktr.ee/restaurant"), "link_in_bio");
  assert.equal(classifyWebsiteUrl("https://instagram.com/restaurant"), "social_profile");
  assert.equal(classifyWebsiteUrl("https://yelp.com/biz/restaurant"), "marketplace");
  assert.equal(classifyWebsiteUrl("https://opentable.com/restaurant"), "booking_platform");
  const provider = new WebsiteInspectionProvider({ fetchImpl: okFetch, resolveHostname: publicDns });
  const result = await provider.enrich({ ...baseProspect, websiteUrl: "https://linktr.ee/yafa" }, baseProspect.updatedAt);
  assert.equal(result.evidence.find((item) => item.field === "websiteType")?.value, "link_in_bio");
  assert.equal(result.evidence.find((item) => item.field === "hasWebsite")?.value, false);
  assert.equal(result.evidence.find((item) => item.field === "websiteHttps")?.value, true);
  const dedicated = await provider.enrich({ ...baseProspect, websiteUrl: "https://restaurant.example" }, baseProspect.updatedAt);
  assert.equal(dedicated.evidence.find((item) => item.field === "hasWebsite")?.value, true);
  const social = await provider.enrich({ ...baseProspect, websiteUrl: "https://instagram.com/yafa" }, baseProspect.updatedAt);
  assert.equal(social.evidence.find((item) => item.field === "websiteType")?.value, "social_profile");
  assert.equal(social.evidence.find((item) => item.field === "hasWebsite")?.value, false);
  const marketplace = await provider.enrich({ ...baseProspect, websiteUrl: "https://yelp.com/biz/yafa" }, baseProspect.updatedAt);
  assert.equal(marketplace.evidence.find((item) => item.field === "websiteType")?.value, "marketplace");
  assert.equal(marketplace.evidence.find((item) => item.field === "hasWebsite")?.value, false);
  const booking = await provider.enrich({ ...baseProspect, websiteUrl: "https://opentable.com/r/yafa" }, baseProspect.updatedAt);
  assert.equal(booking.evidence.find((item) => item.field === "websiteType")?.value, "booking_platform");
  assert.equal(booking.evidence.find((item) => item.field === "hasWebsite")?.value, false);
});

test("legacy Yafa: l’inspection Linktree corrige hasWebsite=true sans conflit manuel artificiel", async () => {
  const legacy = { ...baseProspect, websiteUrl: "https://linktr.ee/yafa", hasWebsite: true, websiteType: undefined };
  const website = new WebsiteInspectionProvider({ fetchImpl: okFetch, resolveHostname: publicDns });
  const enriched = await runProspectEnrichment({ prospect: legacy, providers: [website], now: new Date(baseProspect.updatedAt) });
  const prospect = { ...legacy, ...enriched.prospectPatch };
  const scoring = scoreProspect(prospect);

  assert.equal(prospect.websiteType, "link_in_bio");
  assert.equal(prospect.hasWebsite, false);
  assert.equal(prospect.websiteHttps, true);
  assert.equal(enriched.enrichment.evidence.some((item) => ["websiteType", "hasWebsite", "websiteHttps"].includes(item.field) && item.source.kind === "manual"), false);
  assert.equal(enriched.enrichment.conflicts.some((item) => item.field === "hasWebsite"), false);
  assert.deepEqual(scoring.breakdown.find((item) => item.code === "no_dedicated_website"), {
    code: "no_dedicated_website", label: "Aucun site dédié", points: 30,
  });
});

test("l’inspection suit les redirections et bloque les destinations privées", async () => {
  let calls = 0;
  const redirected = new WebsiteInspectionProvider({ resolveHostname: publicDns, fetchImpl: async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 302, headers: { location: "https://final.example" } }) : new Response("", { status: 200 });
  } });
  const result = await redirected.enrich({ ...baseProspect, websiteUrl: "https://start.example" }, baseProspect.updatedAt);
  assert.equal(calls, 2);
  assert.equal(result.evidence.find((item) => item.field === "hasWebsite")?.value, true);
  const blocked = await new WebsiteInspectionProvider({ fetchImpl: okFetch, resolveHostname: async () => ["127.0.0.1"] }).enrich({ ...baseProspect, websiteUrl: "http://internal.example" }, baseProspect.updatedAt);
  assert.equal(blocked.status, "error");
});

test("une information inconnue reste neutre et un contact réel apporte un signal", () => {
  const unknown = scoreProspect({ ...baseProspect, category: "Consulting" });
  const contacted = scoreProspect({ ...baseProspect, category: "Consulting", email: "hello@example.com" });
  assert.equal(unknown.score, 0);
  assert.equal(unknown.breakdown.some((item) => item.code.startsWith("reviews_")), false);
  assert.equal(contacted.score, 5);
  assert.equal(scoreProspect({ ...baseProspect, instagramUrl: "https://instagram.com/test" }).breakdown.some((item) => item.code === "active_social"), false);
  assert.equal(scoreProspect({ ...baseProspect, hasWebsite: true, websiteType: "dedicated" }).breakdown.some((item) => item.code === "no_dedicated_website"), false);
});

test("beaucoup de valeurs unknown réduisent la certitude sans provoquer un rejet", () => {
  const result = prequalifyProspect(baseProspect);
  assert.equal(result.tier, "low");
  assert.notEqual(result.tier, "reject");
  assert.deepEqual(result, prequalifyProspect(structuredClone(baseProspect)));
});

test("un restaurant OSM très partiel reste low ou devient potential si l’absence de site est établie", () => {
  const partialEnrichment = {
    version: 1, fetchedAt: baseProspect.updatedAt, providers: [], conflicts: [],
    evidence: [{ field: "types", value: ["restaurant"], fetchedAt: baseProspect.updatedAt, source: { kind: "openstreetmap", provider: "openstreetmap", label: "OSM" } }],
  };
  const partial = prequalifyProspect({ ...baseProspect, enrichment: partialEnrichment });
  const noWebsite = prequalifyProspect({ ...baseProspect, enrichment: partialEnrichment, hasWebsite: false });
  assert.equal(partial.tier, "low");
  assert.equal(noWebsite.tier, "potential");
});

test("une franchise avec site corporate dédié peut être rejetée", () => {
  const result = prequalifyProspect({ ...baseProspect, likelyFranchise: true, hasWebsite: true, websiteType: "dedicated" });
  assert.equal(result.tier, "reject");
  assert.match(result.reason, /Franchise confirmée/);
});

test("une franchise sans preuve de site corporate n’est pas rejetée automatiquement", () => {
  assert.notEqual(prequalifyProspect({ ...baseProspect, likelyFranchise: true }).tier, "reject");
});

test("un commerce fermé par une source factuelle peut être rejeté", () => {
  const enrichment = {
    version: 1, fetchedAt: baseProspect.updatedAt, providers: [], conflicts: [],
    evidence: [{ field: "businessStatus", value: "PERMANENTLY_CLOSED", fetchedAt: baseProspect.updatedAt, source: { kind: "geoapify", provider: "geoapify", label: "Geoapify" } }],
  };
  const result = prequalifyProspect({ ...baseProspect, enrichment });
  assert.equal(result.tier, "reject");
  assert.match(result.reason, /fermé confirmé/);
});

test("un statut fermé issu d’une interprétation LLM ne contrôle pas le rejet", () => {
  const enrichment = {
    version: 1, fetchedAt: baseProspect.updatedAt, providers: [], conflicts: [],
    evidence: [{ field: "businessStatus", value: "CLOSED", fetchedAt: baseProspect.updatedAt, source: { kind: "llm_interpretation", provider: "terra", label: "LLM" } }],
  };
  assert.notEqual(prequalifyProspect({ ...baseProspect, enrichment }).tier, "reject");
});

test("un site moderne dédié est rejeté seulement avec des preuves suffisantes", () => {
  const proven = prequalifyProspect({ ...baseProspect, hasWebsite: true, websiteType: "dedicated", websiteQualityScore: 90 });
  const incomplete = prequalifyProspect({ ...baseProspect, hasWebsite: "unknown", websiteType: "unknown", websiteQualityScore: 90 });
  assert.equal(proven.tier, "reject");
  assert.notEqual(incomplete.tier, "reject");
  assert.equal(incomplete.breakdown.some((item) => item.code === "modern_website"), false);
});

test("low ne lance pas OpenAI automatiquement mais reste analysable explicitement", () => {
  assert.equal(shouldAnalyzeWithOpenAI("low"), false);
  assert.equal(shouldAnalyzeWithOpenAI("low", true), true);
  assert.equal(shouldAnalyzeWithOpenAI("reject", true), false);
  assert.equal(shouldAnalyzeWithOpenAI("potential"), true);
  assert.equal(shouldAnalyzeWithOpenAI("strong"), true);
  const detail = readFileSync(new URL("../src/app/(app)/prospects/[id]/prospect-detail.tsx", import.meta.url), "utf8");
  assert.match(detail, /Analyser avec Terra/);
  assert.match(detail, /forceOpenAI: manualLowAnalysis/);
});

test("la préqualification potential reste reproductible", () => {
  const potential = prequalifyProspect({ ...baseProspect, hasWebsite: false, websiteType: "link_in_bio" });
  assert.equal(potential.tier, "potential");
  assert.deepEqual(potential, prequalifyProspect({ ...structuredClone(baseProspect), hasWebsite: false, websiteType: "link_in_bio" }));
});

test("régression Yafa sans avis: les avis restent inconnus; la saisie 4.7/500 devient forte", async () => {
  const yafa = { ...baseProspect, businessName: "Yafa Mediterranean Restaurant", phone: "+1 501-555-0198", websiteUrl: "https://linktr.ee/yafalittlerock", instagramUrl: "https://instagram.com/yafalittlerock", facebookUrl: "https://facebook.com/yafalittlerock" };
  const geo = geoEnrichmentFixture({ place_id: "yafa", name: "Yafa Mediterranean Restaurant", website: "https://linktr.ee/yafalittlerock", categories: ["catering.restaurant"] });
  const website = new WebsiteInspectionProvider({ fetchImpl: okFetch, resolveHostname: publicDns });
  const enriched = await runProspectEnrichment({ prospect: yafa, providers: [geo, website], now: new Date(baseProspect.updatedAt) });
  assert.equal(enriched.prospectPatch.rating, undefined);
  assert.equal(enriched.prospectPatch.reviewCount, undefined);
  const withoutReviews = prequalifyProspect({ ...baseProspect, ...yafa, ...enriched.prospectPatch });
  assert.equal(withoutReviews.tier, "potential");
  assert.equal(withoutReviews.score, 45);
  const manual = await runProspectEnrichment({ prospect: { ...yafa, rating: 4.7, reviewCount: 500 }, providers: [geo, website], now: new Date(baseProspect.updatedAt) });
  assert.equal(manual.prospectPatch.rating, 4.7);
  assert.equal(manual.prospectPatch.reviewCount, 500);
  const withReviews = prequalifyProspect({ ...baseProspect, ...yafa, ...manual.prospectPatch });
  assert.equal(withReviews.tier, "strong");
  assert.equal(withReviews.score, 60);
});

test("pipeline partiel Yafa: no_match lieux conserve les faits manuels et inspecte Linktree", async () => {
  let geoCalls = 0;
  let overpassCalls = 0;
  let websiteCalls = 0;
  const yafa = {
    ...baseProspect,
    businessName: "Yafa Mediterranean Restaurant",
    phone: "+1 501-555-0198",
    websiteUrl: "https://linktr.ee/yafalittlerock",
    instagramUrl: "https://instagram.com/yafalittlerock",
    facebookUrl: "https://facebook.com/yafalittlerock",
  };
  const geo = new GeoapifyProvider("fixture-key", async (url) => {
    geoCalls++;
    return String(url).includes("/v1/geocode/search")
      ? Response.json({ results: [{ place_id: "little-rock-boundary", name: "Little Rock", city: "Little Rock", state: "AR", country: "US" }] })
      : Response.json({ features: [] });
  });
  const overpass = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async () => {
    overpassCalls++;
    return Response.json({ elements: [] });
  } });
  const website = new WebsiteInspectionProvider({ resolveHostname: publicDns, fetchImpl: async (...args) => {
    websiteCalls++;
    return okFetch(...args);
  } });
  const enriched = await runProspectEnrichment({ prospect: yafa, providers: [geo, website], fallbackProviders: [overpass] });
  const prospect = { ...yafa, ...enriched.prospectPatch };
  const prequalification = prequalifyProspect(prospect);

  assert.equal(geoCalls, 2);
  assert.equal(overpassCalls, 1);
  assert.equal(websiteCalls, 1);
  assert.equal(enriched.enrichment.providers.find((item) => item.provider === "geoapify")?.status, "no_match");
  assert.equal(enriched.enrichment.providers.find((item) => item.provider === "openstreetmap")?.status, "no_match");
  assert.equal(enriched.enrichment.providers.find((item) => item.provider === "website_inspection")?.status, "success");
  assert.equal(prospect.websiteType, "link_in_bio");
  assert.equal(prospect.hasWebsite, false);
  assert.equal(prospect.phone, yafa.phone);
  assert.equal(prospect.instagramActive, "unknown");
  assert.equal(prospect.facebookActive, "unknown");
  assert.equal(prequalification.tier, "potential");
  assert.notEqual(prequalification.tier, "reject");
  assert.equal(shouldAnalyzeWithOpenAI(prequalification.tier), true);
});

test("le store persiste l’enrichissement puis applique la politique OpenAI des tiers", () => {
  const store = readFileSync(new URL("../src/components/app-store.tsx", import.meta.url), "utf8");
  const enrichment = store.indexOf("requestProspectEnrichment");
  const persisted = store.indexOf("updateProspectRow(supabase, id, enrichmentResult.prospectPatch)");
  const guard = store.indexOf("shouldAnalyzeWithOpenAI(prequalification.tier");
  const terra = store.indexOf("requestAI<ProspectAnalysis>");
  assert.ok(enrichment >= 0 && enrichment < persisted && persisted < guard && guard < terra);
  assert.match(store.slice(guard, terra), /savePrequalification/);
  assert.match(store.slice(guard, terra), /options\.forceOpenAI/);
  assert.equal((store.slice(terra, store.indexOf("const generateMessage", terra)).match(/requestAI<ProspectAnalysis>/g) ?? []).length, 1);
});
