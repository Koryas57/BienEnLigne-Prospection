import type { Prospect } from "@/lib/types";

export function scoreProspect(prospect: Prospect) {
  let score = 0;
  const reasons: string[] = [];
  if (prospect.hasWebsite === false) { score += 30; reasons.push("aucun site dédié (+30)"); }
  if (prospect.hasWebsite === true && (prospect.websiteQualityScore ?? 100) < 50) { score += 20; reasons.push("site faible ou ancien (+20)"); }
  if ((prospect.reviewCount ?? 0) >= 100) { score += 15; reasons.push("100 avis ou plus (+15)"); }
  else if ((prospect.reviewCount ?? 0) >= 30) { score += 10; reasons.push("30 à 99 avis (+10)"); }
  if (prospect.instagramActive === true || prospect.facebookActive === true) { score += 10; reasons.push("réseau social actif (+10)"); }
  if (prospect.independentBusiness === true) { score += 10; reasons.push("entreprise indépendante (+10)"); }
  if (["Restaurant", "HVAC", "Auto detailing"].includes(prospect.category)) { score += 10; reasons.push("activité locale (+10)"); }
  if (prospect.instagramActive === true) { score += 5; reasons.push("contenu visuel disponible (+5)"); }
  if ((prospect.websiteQualityScore ?? 0) >= 85) { score -= 30; reasons.push("site déjà moderne (-30)"); }
  if (prospect.likelyFranchise === true) { score -= 30; reasons.push("franchise probable (-30)"); }
  return { score: Math.max(0, Math.min(100, score)), reason: reasons.join(" · ") || "Informations insuffisantes pour scorer." };
}
