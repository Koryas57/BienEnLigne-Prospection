import type { PrequalificationTier, Prospect, ScoreContribution } from "@/lib/types";

const verifiedStatusSources = new Set(["manual", "geoapify", "openstreetmap", "direct_inspection"]);
const closedBusinessStatuses = new Set(["closed", "permanently_closed", "closed_permanently", "defunct", "disused"]);

function confirmedBusinessStatus(prospect: Prospect) {
  const conflictSelection = prospect.enrichment?.conflicts.find((conflict) => conflict.field === "businessStatus")?.selected;
  const evidence = conflictSelection ?? prospect.enrichment?.evidence.find((item) => item.field === "businessStatus");
  return evidence && verifiedStatusSources.has(evidence.source.kind) && typeof evidence.value === "string"
    ? evidence.value.trim().toLowerCase().replace(/[\s-]+/g, "_")
    : undefined;
}

export function scoreProspect(prospect: Prospect) {
  let score = 0;
  const breakdown: ScoreContribution[] = [];
  const apply = (code: string, label: string, points: number) => {
    score += points;
    breakdown.push({ code, label, points });
  };
  const nonDedicatedTypes = new Set(["link_in_bio", "social_profile", "marketplace", "booking_platform"]);
  const hasNoDedicatedWebsite = prospect.hasWebsite === false || (prospect.websiteType ? nonDedicatedTypes.has(prospect.websiteType) : false);
  if (hasNoDedicatedWebsite) apply("no_dedicated_website", "Aucun site dédié", 30);
  if (!hasNoDedicatedWebsite && prospect.hasWebsite === true && prospect.websiteQualityScore !== undefined && prospect.websiteQualityScore < 50) {
    apply("weak_website", "Site faible ou ancien", 20);
  }
  if (prospect.reviewCount !== undefined && prospect.reviewCount >= 100) apply("reviews_100", "100 avis ou plus", 15);
  else if (prospect.reviewCount !== undefined && prospect.reviewCount >= 30) apply("reviews_30", "30 à 99 avis", 10);
  if (prospect.instagramActive === true || prospect.facebookActive === true) apply("active_social", "Réseau social actif confirmé", 10);
  if (prospect.independentBusiness === true) apply("independent", "Entreprise indépendante confirmée", 10);
  if (prospect.phone || prospect.email) apply("direct_contact", "Contact direct public ou saisi", 5);
  const category = prospect.category.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const targetedLocalCategories = [
    "restaurant", "cafe", "bakery", "boulanger", "hvac", "plumb", "electric", "roof", "landscap",
    "salon", "barber", "spa", "dent", "chiropr", "auto detailing", "garage", "contractor", "cleaning",
  ];
  if (targetedLocalCategories.some((candidate) => category.includes(candidate))) apply("targeted_local_category", "Activité locale ciblée", 10);
  if (prospect.instagramActive === true) apply("visual_instagram", "Contenu visuel Instagram confirmé", 5);
  if (prospect.hasWebsite === true && prospect.websiteType === "dedicated" && prospect.websiteQualityScore !== undefined && prospect.websiteQualityScore >= 85) {
    apply("modern_website", "Site déjà moderne", -30);
  }
  if (prospect.likelyFranchise === true) apply("likely_franchise", "Franchise probable confirmée", -30);
  const boundedScore = Math.max(0, Math.min(100, score));
  const reason = breakdown.length
    ? breakdown.map((item) => `${item.label} (${item.points > 0 ? "+" : ""}${item.points})`).join(" · ")
    : "Informations insuffisantes pour scorer.";
  return { score: boundedScore, reason, breakdown };
}

export function prequalifyProspect(prospect: Prospect): { tier: PrequalificationTier; score: number; reason: string; breakdown: ScoreContribution[] } {
  const scored = scoreProspect(prospect);
  const businessStatus = confirmedBusinessStatus(prospect);
  if (businessStatus && closedBusinessStatuses.has(businessStatus)) {
    return { tier: "reject", ...scored, reason: "Commerce fermé confirmé par une source factuelle." };
  }
  if (prospect.likelyFranchise === true && prospect.hasWebsite === true && prospect.websiteType === "dedicated") {
    return { tier: "reject", ...scored, reason: "Franchise confirmée avec site corporate dédié." };
  }
  if (prospect.hasWebsite === true && prospect.websiteType === "dedicated" && prospect.websiteQualityScore !== undefined && prospect.websiteQualityScore >= 85) {
    return { tier: "reject", ...scored, reason: "Site dédié moderne confirmé par des preuves suffisantes." };
  }
  const tier: PrequalificationTier = scored.score >= 55 ? "strong" : scored.score >= 30 ? "potential" : "low";
  return { tier, ...scored };
}

export function shouldAnalyzeWithOpenAI(tier: PrequalificationTier, explicitManualAnalysis = false) {
  if (tier === "reject") return false;
  if (tier === "low") return explicitManualAnalysis;
  return true;
}
