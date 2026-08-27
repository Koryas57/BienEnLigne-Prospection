import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GeoapifyProvider } from "../src/lib/enrichment/geoapify.ts";
import { OverpassProvider } from "../src/lib/enrichment/overpass.ts";
import { businessCandidateMatches, deduplicateProspects, sectorCategory } from "../src/lib/enrichment/public-data.ts";

function geoDiscoveryFixture(place) {
  return new GeoapifyProvider("fixture-key", async (url) => String(url).includes("/v1/geocode/search")
    ? Response.json({ results: [{ place_id: "little-rock-boundary", city: "Little Rock", name: "Little Rock" }] })
    : Response.json({ features: [{ properties: place }] }));
}

test("matching A: Yafa Little Rock rejette Sahara Dallas", () => {
  assert.equal(businessCandidateMatches(
    { businessName: "Yafa Mediterranean Restaurant", city: "Little Rock", state: "Arkansas", country: "USA" },
    { businessName: "Sahara Mediterranean Restaurant", city: "Dallas", state: "Texas", country: "United States" },
  ), false);
});

test("matching B: Yafa Mediterranean Grill correspond a Yafa a Little Rock", () => {
  assert.equal(businessCandidateMatches(
    { businessName: "Yafa Mediterranean Restaurant", city: "Little Rock", state: "Arkansas", country: "USA" },
    { businessName: "Yafa Mediterranean Grill", city: "Little Rock", state: "AR", country: "United States of America" },
  ), true);
});

test("matching C: The Purple Cow correspond a Purple Cow Restaurant", () => {
  assert.equal(businessCandidateMatches(
    { businessName: "The Purple Cow", city: "Little Rock" },
    { businessName: "Purple Cow Restaurant", city: "Little Rock" },
  ), true);
});

test("matching D: Saigon Noodle Station accepte le suffixe local LR", () => {
  assert.equal(businessCandidateMatches(
    { businessName: "Saigon Noodle Station", city: "Little Rock" },
    { businessName: "Saigon Noodle Station LR", city: "Little Rock" },
  ), true);
});

test("matching E: un nom exact dans un autre Etat est rejete", () => {
  assert.equal(businessCandidateMatches(
    { businessName: "Yafa Mediterranean Restaurant", city: "Little Rock", state: "Arkansas", country: "US" },
    { businessName: "Yafa Mediterranean Restaurant", city: "Dallas", state: "Texas", country: "USA" },
  ), false);
});

test("matching F: un nom seulement proche sans localisation provider n'est pas accepte", () => {
  assert.equal(businessCandidateMatches(
    { businessName: "Yafa Mediterranean Restaurant", city: "Little Rock", state: "Arkansas", country: "US" },
    { businessName: "Yafa Mediterranean Grill" },
  ), false);
});

test("matching G: Geoapify retourne no_match quand aucun candidat local n'est fiable", async () => {
  const provider = new GeoapifyProvider("fixture-key", async (url) => String(url).includes("/v1/geocode/search")
    ? Response.json({ results: [{ place_id: "little-rock-boundary", name: "Little Rock", city: "Little Rock", state: "AR", country: "US" }] })
    : Response.json({ features: [{ properties: { place_id: "sahara", name: "Sahara Mediterranean Restaurant", city: "Dallas", state: "Texas", country: "US" } }] }));
  const result = await provider.enrich({
    businessName: "Yafa Mediterranean Restaurant", category: "Restaurant", city: "Little Rock", state: "Arkansas", country: "USA",
    hasWebsite: "unknown", websiteHttps: "unknown", instagramActive: "unknown", facebookActive: "unknown",
    googlePresence: "unknown", independentBusiness: "unknown", likelyFranchise: "unknown",
  }, "2026-08-27T00:00:00.000Z");
  assert.equal(result.status, "no_match");
  assert.equal(result.evidence, undefined);
});

test("Restaurant correspond exactement à catering.restaurant; un secteur inconnu n’est pas inventé", () => {
  assert.equal(sectorCategory("Restaurant"), "catering.restaurant");
  assert.equal(sectorCategory("Architecte quantique"), undefined);
});

test("Geoapify géocode la ville puis utilise sa limite administrative", async () => {
  const calls = [];
  const provider = new GeoapifyProvider("fixture-key", async (url) => {
    calls.push(String(url));
    if (String(url).includes("/v1/geocode/search")) return Response.json({ results: [{ place_id: "little-rock-boundary", city: "Little Rock", name: "Little Rock" }] });
    return Response.json({ features: [{ properties: { place_id: "restaurant-1", name: "Yafa", formatted: "Little Rock, AR", city: "Little Rock", categories: ["catering.restaurant"], lat: 34.7, lon: -92.3 } }] });
  });
  const results = await provider.discover({ city: "Little Rock", state: "Arkansas", country: "USA", sector: "Restaurant", limit: 100 });
  assert.equal(results.length, 1);
  const placesUrl = new URL(calls[1]);
  assert.equal(placesUrl.pathname, "/v2/places");
  assert.equal(placesUrl.searchParams.get("filter"), "place:little-rock-boundary");
  assert.equal(placesUrl.searchParams.get("categories"), "catering.restaurant");
  assert.equal(placesUrl.searchParams.get("limit"), "100");
  assert.doesNotMatch(JSON.stringify(results), /fixture-key/);
});

test("un secteur non mappé n’appelle pas Geoapify", async () => {
  let called = false;
  const provider = new GeoapifyProvider("fixture-key", async () => { called = true; return new Response(); });
  assert.deepEqual(await provider.discover({ city: "Paris", sector: "Inconnu", limit: 20 }), []);
  assert.equal(called, false);
});

test("Waffle House conserve brand, Wikidata, opérateur, nom officiel et le signal de chaîne probable", async () => {
  const provider = geoDiscoveryFixture({
    place_id: "waffle-house-1", name: "Waffle House", official_name: "Waffle House #488",
    formatted: "201 North Shackleford Road, Little Rock, AR", website: "https://locations.wafflehouse.com/littlerock-ar-488/",
    brand: "Waffle House", operator: "WH Capital, LLC", categories: ["catering.restaurant"],
    datasource: { sourcename: "openstreetmap", raw: { "brand:wikidata": "Q212133" } },
  });
  const [result] = await provider.discover({ city: "Little Rock", state: "Arkansas", country: "USA", sector: "Restaurant", limit: 20 });
  assert.equal(result.brand, "Waffle House");
  assert.equal(result.brandWikidataId, "Q212133");
  assert.equal(result.operator, "WH Capital, LLC");
  assert.equal(result.officialName, "Waffle House #488");
  assert.equal(result.datasource, "openstreetmap");
  assert.equal(result.franchiseSignal, "likely_franchise");
  assert.equal(result.brandSignalLabel, "Marque : Waffle House · Chaîne probable");
});

test("IHOP avec brand et locator corporate est une chaîne probable sans être déclarée confirmée", async () => {
  const provider = geoDiscoveryFixture({
    place_id: "ihop-1", name: "IHOP", formatted: "Little Rock, AR", brand: "IHOP",
    website: "https://restaurants.ihop.com/en-us/ar/little-rock/101-n-university-ave", categories: ["catering.restaurant"],
  });
  const [result] = await provider.discover({ city: "Little Rock", sector: "Restaurant", limit: 20 });
  assert.equal(result.brand, "IHOP");
  assert.equal(result.franchiseSignal, "likely_franchise");
  assert.notEqual(result.franchiseSignal, "confirmed_franchise");
});

test("un restaurant local sans brand conserve un signal inconnu", async () => {
  const provider = geoDiscoveryFixture({ place_id: "local-1", name: "Chez Agathe", formatted: "Little Rock, AR", website: "https://chezagathe.example", categories: ["catering.restaurant"] });
  const [result] = await provider.discover({ city: "Little Rock", sector: "Restaurant", limit: 20 });
  assert.equal(result.brand, undefined);
  assert.equal(result.franchiseSignal, "unknown");
  assert.equal(result.brandSignalLabel, undefined);
});

test("une marque locale sans preuve corporate reste seulement brand_detected", async () => {
  const provider = geoDiscoveryFixture({
    place_id: "local-brand-1", name: "Purple Cow", formatted: "Little Rock, AR", brand: "Purple Cow",
    website: "https://purplecowlr.com/", categories: ["catering.restaurant"],
  });
  const [result] = await provider.discover({ city: "Little Rock", sector: "Restaurant", limit: 20 });
  assert.equal(result.brand, "Purple Cow");
  assert.equal(result.franchiseSignal, "brand_detected");
  assert.equal(result.brandSignalLabel, "Marque : Purple Cow");
});

test("operator sans brand ne transforme aucun unknown en signal positif", async () => {
  const provider = geoDiscoveryFixture({ place_id: "operator-only-1", name: "Local Kitchen", operator: "Local Hospitality LLC", categories: ["catering.restaurant"] });
  const [result] = await provider.discover({ city: "Little Rock", sector: "Restaurant", limit: 20 });
  assert.equal(result.operator, "Local Hospitality LLC");
  assert.equal(result.brand, undefined);
  assert.equal(result.franchiseSignal, "unknown");
});

test("Overpass limite la requête à la ville, au secteur vérifié et au plafond demandé", async () => {
  let body = "";
  const provider = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async (_url, init) => {
    body = new URLSearchParams(String(init.body)).get("data") ?? "";
    return Response.json({ elements: [{ type: "node", id: 1, lat: 1, lon: 2, tags: { name: "Local", amenity: "restaurant" } }] });
  } });
  const results = await provider.discover({ city: "Little Rock", sector: "Restaurant", limit: 25 });
  assert.equal(results[0].providerPlaceId, "node/1");
  assert.match(body, /area\["boundary"="administrative"\]\["name"="Little Rock"\]/);
  assert.match(body, /\["amenity"="restaurant"\]/);
  assert.match(body, /out center 25/);
});

test("Overpass met en cache un aperçu identique pendant quinze minutes", async () => {
  let calls = 0;
  const provider = new OverpassProvider({ rateLimitMs: 0, fetchImpl: async () => { calls++; return Response.json({ elements: [] }); } });
  const input = { city: "Cache Test City", sector: "Restaurant", limit: 7 };
  await provider.discover(input);
  await provider.discover(input);
  assert.equal(calls, 1);
});

test("la déduplication combine ID provider, nom/adresse, téléphone, hôte et coordonnées proches", () => {
  const base = { provider: "geoapify", providerPlaceId: "1", businessName: "Café Démo", category: "Restaurant", address: "1 Main St", categories: [], latitude: 1, longitude: 2 };
  const results = deduplicateProspects([
    base,
    { ...base },
    { ...base, providerPlaceId: "2", businessName: "Cafe Demo" },
    { ...base, providerPlaceId: "3", businessName: "Autre", address: "2 Main", phone: "+33 1 02 03 04 05" },
    { ...base, providerPlaceId: "4", businessName: "Encore", address: "3 Main", phone: "33 1 02 03 04 05" },
  ]);
  assert.equal(results.length, 2);
});

test("la route de découverte est authentifiée, limitée et sans écriture DB", () => {
  const route = readFileSync(new URL("../src/app/api/discovery/route.ts", import.meta.url), "utf8");
  assert.match(route, /hasAuthenticatedApiSession/);
  assert.match(route, /max\(100\)/);
  assert.doesNotMatch(route, /createProspect|\.insert\(|supabase\.from/);
});
