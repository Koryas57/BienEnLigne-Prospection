import assert from "node:assert/strict";
import test from "node:test";
import { deriveGameProgress, getLeadRank, getProspectSignals } from "../src/lib/gameplay.ts";

function prospect(overrides = {}) {
  return {
    id: "p-1", campaignId: "c-1", businessName: "Cible locale", category: "Restaurant", city: "Little Rock",
    state: "Arkansas", country: "USA", timezone: "America/Chicago", source: "Test", status: "NEW", leadScore: 0,
    qualificationReason: "À analyser", hasWebsite: "unknown", websiteMobileFriendly: "unknown", websiteHttps: "unknown",
    instagramActive: "unknown", facebookActive: "unknown", googlePresence: "unknown", independentBusiness: "unknown",
    likelyFranchise: "unknown", createdAt: "2026-08-27T08:00:00.000Z", updatedAt: "2026-08-27T08:00:00.000Z", ...overrides,
  };
}

function workspace(overrides = {}) {
  return {
    profile: { id: "u-1", displayName: "Agathe", companyName: "Bien En Ligne" }, settings: { followUp1Days: 3, followUp2Days: 8, defaultCurrency: "USD", defaultPrice: 350, scoringRules: {} },
    campaigns: [], prospects: [], messages: [], activities: [], deals: [], ...overrides,
  };
}

test("les six rangs commerciaux respectent exactement les seuils de score", () => {
  assert.equal(getLeadRank(0).label, "Faible");
  assert.equal(getLeadRank(25).label, "À surveiller");
  assert.equal(getLeadRank(45).label, "Prometteur");
  assert.equal(getLeadRank(60).label, "Fort potentiel");
  assert.equal(getLeadRank(75).label, "Prioritaire");
  assert.equal(getLeadRank(90).label, "Cible premium");
});

test("les signaux de carte restent factuels et les unknown ne deviennent pas des affirmations", () => {
  assert.deepEqual(getProspectSignals(prospect()), []);
  assert.deepEqual(getProspectSignals(prospect({ hasWebsite: false, instagramUrl: "https://instagram.com/example", likelyFranchise: "unknown" })), ["Pas de site dédié", "Instagram présent"]);
  assert.deepEqual(getProspectSignals(prospect({ hasWebsite: true, likelyFranchise: true })), ["Site dédié présent", "Chaîne probable"]);
});

test("XP, niveau et objectifs quotidiens sont dérivés des données enregistrées", () => {
  const state = workspace({
    prospects: [prospect({ status: "QUALIFIED", leadScore: 72 }), prospect({ id: "p-2", status: "REPLIED", leadScore: 65 })],
    messages: [{ id: "m-1", prospectId: "p-1", campaignId: "c-1", channel: "email", kind: "FIRST_CONTACT", body: "Hello", status: "SENT", scheduledFor: "", recommendedLocalTime: "", sentAt: "2026-08-27T09:00:00.000Z", createdAt: "2026-08-27T08:00:00.000Z", updatedAt: "2026-08-27T09:00:00.000Z" }],
    activities: [
      { id: "a-1", prospectId: "p-1", type: "ANALYZED", label: "Analyse", createdAt: "2026-08-27T08:00:00.000Z" },
      { id: "a-2", prospectId: "p-1", type: "APPROVED", label: "Validation", createdAt: "2026-08-27T08:30:00.000Z" },
      { id: "a-3", prospectId: "p-1", type: "CONTACTED", label: "Contact", createdAt: "2026-08-27T09:00:00.000Z" },
      { id: "a-4", prospectId: "p-2", type: "ANALYZED", label: "Analyse veille", createdAt: "2026-08-26T09:00:00.000Z" },
    ],
  });
  const progress = deriveGameProgress(state, new Date("2026-08-27T12:00:00"));
  assert.equal(progress.baseXp, 135);
  assert.equal(progress.achievementXp, 175);
  assert.equal(progress.totalXp, 310);
  assert.equal(progress.level, 2);
  assert.equal(progress.levelXp, 60);
  assert.equal(progress.streak, 2);
  assert.deepEqual(progress.objectives.map(({ current }) => current), [1, 1, 1]);
  assert.equal(progress.achievements.find(({ id }) => id === "first-analysis")?.unlocked, true);
  assert.equal(progress.achievements.find(({ id }) => id === "first-contact")?.unlocked, true);
  assert.equal(progress.achievements.find(({ id }) => id === "first-reply")?.unlocked, true);
  assert.equal(progress.achievements.find(({ id }) => id === "first-win")?.unlocked, false);
  assert.equal(progress.achievements.find(({ id }) => id === "first-analysis")?.xp, 50);
});

test("un espace vide reste niveau 1 sans faux streak ni succès", () => {
  const progress = deriveGameProgress(workspace(), new Date("2026-08-27T12:00:00"));
  assert.equal(progress.totalXp, 0);
  assert.equal(progress.level, 1);
  assert.equal(progress.streak, 0);
  assert.ok(progress.achievements.every(({ unlocked }) => !unlocked));
});
