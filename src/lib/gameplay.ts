import type { AppState, Prospect } from "@/lib/types";

export type LeadRank = {
  label: "Faible" | "À surveiller" | "Prometteur" | "Fort potentiel" | "Prioritaire" | "Cible premium";
  tone: "muted" | "blue" | "cyan" | "green" | "amber" | "violet";
};

export type DailyObjective = {
  id: "analyze" | "approve" | "contact";
  label: string;
  current: number;
  target: number;
  xp: number;
};

export type Achievement = {
  id: "first-analysis" | "scout" | "first-contact" | "first-reply" | "first-win" | "local-expert";
  label: string;
  description: string;
  unlocked: boolean;
  current: number;
  target: number;
  xp: number;
  unlockedAt?: string;
};

const ANALYZED_STATUSES = new Set([
  "ANALYZED", "QUALIFIED", "REJECTED", "DRAFT_READY", "APPROVED", "CONTACTED",
  "FOLLOW_UP", "REPLIED", "INTERESTED", "WON", "LOST",
]);
const CONTACTED_STATUSES = new Set(["CONTACTED", "FOLLOW_UP", "REPLIED", "INTERESTED", "WON", "LOST"]);
const REPLY_STATUSES = new Set(["REPLIED", "INTERESTED", "WON", "LOST"]);

function localDateKey(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function countActivityTypes(state: AppState, dayKey: string, types: Set<string>) {
  return state.activities.filter((activity) => localDateKey(activity.createdAt) === dayKey && types.has(activity.type)).length;
}

function calculateStreak(state: AppState, now: Date) {
  const activeDays = new Set(state.activities.map((activity) => localDateKey(activity.createdAt)).filter(Boolean));
  if (!activeDays.size) return 0;
  const cursor = new Date(now);
  if (!activeDays.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (activeDays.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function largestAnalyzedCityGroup(prospects: Prospect[]) {
  const cities = new Map<string, number>();
  for (const prospect of prospects) {
    if (!ANALYZED_STATUSES.has(prospect.status)) continue;
    const city = prospect.city.trim().toLocaleLowerCase("fr");
    if (city) cities.set(city, (cities.get(city) ?? 0) + 1);
  }
  return Math.max(0, ...cities.values());
}

function earliest(values: Array<string | undefined>) {
  return values.filter((value): value is string => Boolean(value)).toSorted().at(0);
}

export function getLeadRank(score: number): LeadRank {
  if (score >= 90) return { label: "Cible premium", tone: "violet" };
  if (score >= 75) return { label: "Prioritaire", tone: "amber" };
  if (score >= 60) return { label: "Fort potentiel", tone: "green" };
  if (score >= 45) return { label: "Prometteur", tone: "cyan" };
  if (score >= 25) return { label: "À surveiller", tone: "blue" };
  return { label: "Faible", tone: "muted" };
}

export function getProspectSignals(prospect: Prospect): string[] {
  const signals: string[] = [];
  if (prospect.hasWebsite === false) signals.push("Pas de site dédié");
  else if (prospect.websiteType === "link_in_bio") signals.push("Page de liens détectée");
  else if (prospect.hasWebsite === true) signals.push("Site dédié présent");
  if (prospect.reviewCount !== undefined) signals.push(`${prospect.reviewCount} avis${prospect.rating !== undefined ? ` · ${prospect.rating}/5` : ""}`);
  if (prospect.instagramUrl) signals.push("Instagram présent");
  if (prospect.facebookUrl) signals.push("Facebook présent");
  if (prospect.phone || prospect.email) signals.push("Contact direct disponible");
  if (prospect.likelyFranchise === true) signals.push("Chaîne probable");
  return signals.slice(0, 5);
}

export function deriveGameProgress(state: AppState, now = new Date()) {
  const analyzed = state.prospects.filter((prospect) => ANALYZED_STATUSES.has(prospect.status)).length;
  const qualified = state.prospects.filter((prospect) => prospect.leadScore >= 55 && !["REJECTED", "DO_NOT_CONTACT"].includes(prospect.status)).length;
  const approved = state.messages.filter((message) => message.status === "APPROVED" || message.status === "SENT").length;
  const sent = state.messages.filter((message) => message.status === "SENT").length;
  const replies = state.prospects.filter((prospect) => REPLY_STATUSES.has(prospect.status)).length;
  const largestCityGroup = largestAnalyzedCityGroup(state.prospects);
  const achievements: Achievement[] = [
    { id: "first-analysis", label: "Premier radar", description: "Analyser une première cible", unlocked: analyzed >= 1, current: Math.min(analyzed, 1), target: 1, xp: 50, unlockedAt: analyzed >= 1 ? earliest(state.activities.filter((activity) => ["ANALYZED", "PREQUALIFIED"].includes(activity.type)).map((activity) => activity.createdAt)) : undefined },
    { id: "scout", label: "Scout", description: "Découvrir 10 entreprises", unlocked: state.prospects.length >= 10, current: Math.min(state.prospects.length, 10), target: 10, xp: 100, unlockedAt: state.prospects.length >= 10 ? state.prospects.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt))[9]?.createdAt : undefined },
    { id: "first-contact", label: "Premier contact", description: "Envoyer un premier message", unlocked: sent >= 1, current: Math.min(sent, 1), target: 1, xp: 50, unlockedAt: sent >= 1 ? earliest(state.messages.map((message) => message.sentAt)) : undefined },
    { id: "first-reply", label: "Signal reçu", description: "Obtenir une première réponse", unlocked: replies >= 1, current: Math.min(replies, 1), target: 1, xp: 75, unlockedAt: replies >= 1 ? earliest(state.prospects.filter((prospect) => REPLY_STATUSES.has(prospect.status)).map((prospect) => prospect.updatedAt)) : undefined },
    { id: "first-win", label: "Première victoire", description: "Décrocher une première vente", unlocked: state.deals.length >= 1, current: Math.min(state.deals.length, 1), target: 1, xp: 150, unlockedAt: state.deals.length >= 1 ? earliest(state.deals.map((deal) => deal.wonAt)) : undefined },
    { id: "local-expert", label: "Légende locale", description: "Traiter 100 entreprises dans une ville", unlocked: largestCityGroup >= 100, current: Math.min(largestCityGroup, 100), target: 100, xp: 300 },
  ];
  const baseXp = analyzed * 20 + qualified * 15 + approved * 15 + sent * 20 + replies * 30 + state.deals.length * 100;
  const achievementXp = achievements.reduce((sum, achievement) => sum + (achievement.unlocked ? achievement.xp : 0), 0);
  const totalXp = baseXp + achievementXp;
  const xpPerLevel = 250;
  const level = Math.floor(totalXp / xpPerLevel) + 1;
  const levelXp = totalXp % xpPerLevel;
  const dayKey = localDateKey(now);
  const objectives: DailyObjective[] = [
    { id: "analyze", label: "Analyser 5 cibles", current: countActivityTypes(state, dayKey, new Set(["ANALYZED", "PREQUALIFIED"])), target: 5, xp: 60 },
    { id: "approve", label: "Valider 3 messages", current: countActivityTypes(state, dayKey, new Set(["APPROVED"])), target: 3, xp: 45 },
    { id: "contact", label: "Contacter 3 prospects", current: countActivityTypes(state, dayKey, new Set(["CONTACTED"])), target: 3, xp: 60 },
  ];
  const title = level >= 10 ? "Stratège" : level >= 5 ? "Scout" : "Prospecteur";

  return {
    totalXp,
    baseXp,
    achievementXp,
    level,
    levelXp,
    xpPerLevel,
    title,
    streak: calculateStreak(state, now),
    analyzed,
    qualified,
    contacted: state.prospects.filter((prospect) => CONTACTED_STATUSES.has(prospect.status)).length,
    replies,
    objectives,
    achievements,
  };
}
