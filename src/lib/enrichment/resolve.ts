import type {
  EnrichmentEvidence,
  EnrichmentFactKey,
  EnrichmentSourceKind,
  EnrichmentValue,
  Prospect,
  ProspectEnrichment,
} from "@/lib/types";
import type { EnrichmentProspect, RunEnrichmentInput, RunEnrichmentResult } from "@/lib/enrichment/contracts";

const sourcePriority: Record<EnrichmentSourceKind, number> = {
  manual: 500,
  geoapify: 400,
  openstreetmap: 350,
  direct_inspection: 300,
  web_search: 200,
  llm_interpretation: 100,
};

const derivedWebsiteFields = new Set<EnrichmentFactKey>(["websiteType", "hasWebsite", "websiteHttps"]);

function sameValue(left: EnrichmentValue, right: EnrichmentValue) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function manualEvidence(prospect: EnrichmentProspect, fetchedAt: string, existing?: ProspectEnrichment): EnrichmentEvidence[] {
  const entries: Array<[EnrichmentFactKey, EnrichmentValue | undefined]> = [
    ["businessName", prospect.businessName], ["address", prospect.address], ["city", prospect.city], ["state", prospect.state], ["country", prospect.country],
    ["phone", prospect.phone], ["email", prospect.email],
    ["websiteUrl", prospect.websiteUrl], ["instagramUrl", prospect.instagramUrl], ["facebookUrl", prospect.facebookUrl],
    ["googleMapsUrl", prospect.googleMapsUrl], ["rating", prospect.rating],
    ["reviewCount", prospect.reviewCount],
    ["instagramActive", prospect.instagramActive === "unknown" ? undefined : prospect.instagramActive],
    ["facebookActive", prospect.facebookActive === "unknown" ? undefined : prospect.facebookActive],
    ["googlePresence", prospect.googlePresence === "unknown" ? undefined : prospect.googlePresence],
    ["independentBusiness", prospect.independentBusiness === "unknown" ? undefined : prospect.independentBusiness],
    ["likelyFranchise", prospect.likelyFranchise === "unknown" ? undefined : prospect.likelyFranchise],
  ];
  return entries.flatMap(([field, value]) => {
    if (value === undefined || value === "") return [];
    const existingCandidates = existing?.evidence.filter((item) => item.field === field && sameValue(item.value, value)) ?? [];
    const previouslyProviderDerived = existingCandidates.length > 0 && !existingCandidates.some((item) => item.source.kind === "manual");
    if (previouslyProviderDerived) return [];
    return [{
      field, value, fetchedAt, confidence: 1,
      source: { kind: "manual" as const, provider: "manual", label: "Saisie explicite" },
    }];
  });
}

function evidencePriority(field: EnrichmentFactKey, source: EnrichmentSourceKind) {
  if (derivedWebsiteFields.has(field) && source === "direct_inspection") return 450;
  return sourcePriority[source];
}

function compareEvidence(field: EnrichmentFactKey, left: EnrichmentEvidence, right: EnrichmentEvidence) {
  const priority = evidencePriority(field, right.source.kind) - evidencePriority(field, left.source.kind);
  if (priority) return priority;
  const confidence = (right.confidence ?? 0) - (left.confidence ?? 0);
  if (confidence) return confidence;
  return Date.parse(right.fetchedAt) - Date.parse(left.fetchedAt);
}

function resolveEvidence(evidence: EnrichmentEvidence[]) {
  const grouped = new Map<EnrichmentFactKey, EnrichmentEvidence[]>();
  for (const item of evidence) grouped.set(item.field, [...(grouped.get(item.field) ?? []), item]);
  const selected = new Map<EnrichmentFactKey, EnrichmentEvidence>();
  const conflicts: ProspectEnrichment["conflicts"] = [];
  for (const [field, candidates] of grouped) {
    const ordered = [...candidates].sort((left, right) => compareEvidence(field, left, right));
    const winner = ordered[0];
    selected.set(field, winner);
    const alternatives = ordered.slice(1).filter((item) => !sameValue(item.value, winner.value));
    if (alternatives.length) conflicts.push({ field, selected: winner, alternatives });
  }
  return { selected, conflicts };
}

const prospectFields = new Set<EnrichmentFactKey>([
  "businessName", "address", "city", "state", "country", "phone", "email", "websiteUrl", "instagramUrl", "facebookUrl", "googleMapsUrl", "rating", "reviewCount",
  "websiteType", "hasWebsite", "websiteHttps", "googlePresence", "instagramActive", "facebookActive",
  "independentBusiness", "likelyFranchise",
]);

function selectedProspectPatch(selected: Map<EnrichmentFactKey, EnrichmentEvidence>) {
  const patch: Partial<Prospect> = {};
  for (const [field, item] of selected) {
    if (!prospectFields.has(field)) continue;
    (patch as Record<string, unknown>)[field] = item.value;
  }
  if (patch.websiteType && new Set(["link_in_bio", "social_profile", "marketplace", "booking_platform"]).has(patch.websiteType)) {
    patch.hasWebsite = false;
  }
  return patch;
}

function cachedProviderEvidence(existing: ProspectEnrichment | undefined, provider: string) {
  return existing?.evidence.filter((item) => item.source.provider === provider) ?? [];
}

function latestProviderRun(existing: ProspectEnrichment | undefined, provider: string) {
  return existing?.providers.filter((run) => run.provider === provider).sort((a, b) => Date.parse(b.fetchedAt) - Date.parse(a.fetchedAt))[0];
}

export async function runProspectEnrichment(input: RunEnrichmentInput): Promise<RunEnrichmentResult> {
  const now = input.now ?? new Date();
  const fetchedAt = now.toISOString();
  const runProviders = (providers: RunEnrichmentInput["providers"]) => Promise.all(providers.map(async (provider) => {
    const previous = latestProviderRun(input.existing, provider.id);
    const fresh = previous && ["success", "no_match"].includes(previous.status)
      && now.getTime() - Date.parse(previous.fetchedAt) <= provider.cacheTtlMs;
    if (fresh) return {
      run: { ...previous, cached: true },
      evidence: cachedProviderEvidence(input.existing, provider.id),
    };
    try {
      const result = await provider.enrich(input.prospect, fetchedAt);
      return {
        run: { provider: provider.id, status: result.status, fetchedAt, message: result.message },
        evidence: result.evidence ?? [],
      };
    } catch {
      return {
        run: { provider: provider.id, status: "error" as const, fetchedAt, message: "Provider indisponible" },
        evidence: [] as EnrichmentEvidence[],
      };
    }
  }));
  const outcomes = await runProviders(input.providers);
  const hasGeoapifyEvidence = outcomes.some((outcome) => outcome.evidence.some((item) => item.source.kind === "geoapify"));
  if (input.fallbackProviders?.length && !hasGeoapifyEvidence) outcomes.push(...await runProviders(input.fallbackProviders));
  const evidence = [manualEvidence(input.prospect, fetchedAt, input.existing), ...outcomes.map((item) => item.evidence)].flat();
  const { selected, conflicts } = resolveEvidence(evidence);
  const prospectPatch = selectedProspectPatch(selected);
  const enrichment: ProspectEnrichment = {
    version: 1,
    fetchedAt,
    providers: outcomes.map((item) => item.run),
    evidence,
    conflicts,
  };
  prospectPatch.enrichment = enrichment;
  return {
    enrichment,
    prospectPatch,
    enrichedProspect: { ...input.prospect, ...prospectPatch },
  };
}
