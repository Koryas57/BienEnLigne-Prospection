import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const shell = readFileSync(new URL("../src/components/app-shell.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../src/app/globals.css", import.meta.url), "utf8");

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Début de section absent: ${start}`);
  assert.notEqual(endIndex, -1, `Fin de section absente: ${end}`);
  return source.slice(startIndex, endIndex);
}

function assertOrdered(source, values) {
  let cursor = -1;
  for (const value of values) {
    const next = source.indexOf(value, cursor + 1);
    assert.notEqual(next, -1, `Valeur absente: ${value}`);
    assert.ok(next > cursor, `Ordre incorrect pour: ${value}`);
    cursor = next;
  }
}

test("la navigation de jeu expose exactement cinq destinations principales", () => {
  const nav = section(shell, "const gameNav = [", "\n\nfunction GameNavLink");
  assertOrdered(nav, ["/dashboard", "Accueil", "/prospects", "Deck", "/scan", "Scanner", "/campaigns", "Missions", "/collection", "Collection"]);
  assert.equal((nav.match(/href:/g) ?? []).length, 5);
  assert.doesNotMatch(nav, /approval|pipeline|stats|settings/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
});

test("Scanner est le bouton central visuellement surélevé", () => {
  assert.match(shell, /href: "\/scan"[\s\S]*featured: true/);
  assert.match(css, /\.mobile-nav-link\.featured \.nav-icon \{[^}]*margin-top:\s*-31px/);
  assert.match(css, /\.mobile-nav-link\.featured \.nav-icon \{[^}]*border-radius:\s*50%/);
});

test("la navigation conserve états actifs, labels et grandes cibles tactiles", () => {
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shell, /aria-label=\{featured \? "Scanner de nouvelles entreprises" : undefined\}/);
  assert.match(css, /\.mobile-nav-link \{[^}]*min-height:\s*54px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /safe-area-inset-right/);
});

test("les paramètres restent accessibles et proposent le logout existant", () => {
  assert.match(shell, /href="\/settings" aria-label="Ouvrir les paramètres"/);
  assert.match(shell, /<form action="\/auth\/logout" method="post">/);
  assert.match(shell, /Déconnexion/);
});

test("desktop reprend les mêmes cinq destinations sans la barre mobile", () => {
  assert.match(shell, /<nav className="side-nav"[\s\S]*gameNav\.map/);
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*\.mobile-nav \{ display: none; \}/);
});
