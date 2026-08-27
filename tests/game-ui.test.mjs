import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const home = read("../src/app/(app)/dashboard/page.tsx");
const deck = read("../src/app/(app)/prospects/page.tsx");
const scan = read("../src/app/(app)/scan/page.tsx");
const missions = read("../src/app/(app)/campaigns/page.tsx");
const collection = read("../src/app/(app)/collection/page.tsx");
const detail = read("../src/app/(app)/prospects/[id]/prospect-detail.tsx");
const settings = read("../src/app/(app)/settings/page.tsx");
const shell = read("../src/components/app-shell.tsx");
const gameUi = read("../src/components/game-ui.tsx");
const gameAsset = read("../src/components/game-asset.tsx");
const css = read("../src/app/globals.css");

test("Accueil reste focalisé sur une mission, les objectifs et la collection", () => {
  assert.match(home, /Mission active/);
  assert.match(home, /Missions du jour/);
  assert.match(home, /Collection/);
  assert.doesNotMatch(home, /Supabase|télémétrie|Données synchronisées|CA gagné|Radar prioritaire|Console d’action/i);
  assert.equal((home.match(/<Stat\b/g) ?? []).length, 0);
});

test("le deck implémente les gestes, le clavier et les trois décisions", () => {
  assert.match(deck, /onPointerDown=\{pointerDown\}/);
  assert.match(deck, /onPointerMove=\{pointerMove\}/);
  assert.match(deck, /onPointerUp=\{pointerUp\}/);
  assert.match(deck, /event\.key === "ArrowLeft"/);
  assert.match(deck, /event\.key === "ArrowUp"/);
  assert.match(deck, /event\.key === "ArrowRight"/);
  assert.match(deck, />Passer</);
  assert.match(deck, />Analyser</);
  assert.match(deck, />Garder</);
  assert.match(css, /\.draggable-card/);
});

test("Scanner accompagne uniquement le véritable appel réseau", () => {
  assert.match(scan, /fetch\("\/api\/discovery"/);
  assert.match(scan, /setPhase\("scanning"\)/);
  assert.match(scan, /setPhase\("complete"\)/);
  assert.doesNotMatch(scan, /setTimeout|delay|sleep/);
  assert.match(scan, /Aperçu uniquement : aucune carte n’est ajoutée automatiquement/);
  assert.doesNotMatch(scan, /Geoapify|OpenStreetMap/i);
});

test("Missions et Collection possèdent leurs écrans dédiés", () => {
  assert.match(missions, /Progression du jour/);
  assert.match(missions, /large-mission-card/);
  assert.match(collection, /Votre collection/);
  assert.match(collection, /AchievementCard/);
  assert.match(collection, /XP de collection/);
});

test("la fiche masque les données techniques derrière une ouverture volontaire", () => {
  assert.match(detail, /Pourquoi cette cible/);
  assert.match(detail, /Analyser avec Terra/);
  assert.match(detail, /Préparer l’approche/);
  assert.match(detail, /<details><summary>Détails techniques<\/summary>/);
});

test("la technique est regroupée dans Paramètres puis Diagnostics", () => {
  assert.match(settings, /id: "diagnostics"/);
  assert.match(settings, /tab === "diagnostics"/);
  assert.match(settings, /OpenAIStatusCard/);
  assert.match(settings, /Supabase/);
  assert.match(settings, /Données & sources/);
});

test("la direction visuelle est lumineuse et respecte reduced motion", () => {
  assert.match(css, /color-scheme:\s*light/);
  assert.match(css, /--bg:\s*#edf5f6/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /\.rarity-violet/);
  assert.match(css, /\.achievement-celebration/);
});

test("les dix assets 3D sont centralisés et réellement intégrés", () => {
  const names = ["xp-crystal", "scanner", "deck", "mission-map", "trophy", "streak-flame", "achievement-unlocked", "achievement-locked", "restaurant", "rank-premium"];
  const primaryUi = [home, deck, scan, missions, collection, shell, gameUi].join("\n");
  for (const name of names) {
    assert.match(gameAsset, new RegExp(`${name.replace("-", "\\-")}\\.png`));
    assert.match(primaryUi, new RegExp(`["']${name}["']`));
  }
  assert.doesNotMatch([home, deck, scan, missions, collection, shell, gameUi].join("\n"), /\/assets\/game\//);
  assert.match(gameAsset, /preload: true/);
  assert.match(gameAsset, /loading: "lazy"/);
});

test("le système de profondeur et les animations physiques restent accessibles", () => {
  assert.match(css, /--depth-0:/);
  assert.match(css, /--depth-1:/);
  assert.match(css, /--depth-2:/);
  assert.match(css, /--depth-3:/);
  assert.match(css, /--contact-shadow:/);
  assert.match(css, /--rim-light:/);
  assert.match(css, /@keyframes hero-hover/);
  assert.match(css, /@keyframes scanner-active/);
  assert.match(css, /@keyframes reward-pop/);
  assert.match(deck, /--shine-x/);
  assert.match(deck, /--tilt-x/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
