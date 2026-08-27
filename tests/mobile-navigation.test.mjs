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

test("la barre mobile expose exactement les cinq entrées principales", () => {
  const primary = section(shell, "const mobileNav = [", "const mobileMoreNav");
  assertOrdered(primary, ["/dashboard", "Aujourd’hui", "/approval", "Validation", "/prospects", "Prospects", "/campaigns", "Campagnes"]);
  assert.doesNotMatch(primary, /\/pipeline|\/stats|\/settings/);
  assert.match(shell, /<span>Plus<\/span>/);
  assert.match(css, /grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/);
});

test("Plus contient les routes secondaires et signale leur état actif", () => {
  const secondary = section(shell, "const mobileMoreNav = [", "const desktopNav");
  assertOrdered(secondary, ["/pipeline", "Pipeline", "/stats", "Stats", "/settings", "Réglages"]);
  assert.match(shell, /mobileMoreNav\.some/);
  assert.match(shell, /aria-current=\{active \? "page" : undefined\}/);
  assert.match(shell, /aria-current=\{moreActive \? "page" : undefined\}/);
});

test("le bottom sheet possède les fermetures et attributs d’accessibilité requis", () => {
  assert.match(shell, /aria-haspopup="dialog"/);
  assert.match(shell, /role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"/);
  assert.match(shell, /mobile-more-overlay[\s\S]*aria-label="Fermer le menu Plus"[\s\S]*onClick=\{\(\) => closeSheet\(\)\}/);
  assert.match(shell, /event\.key === "Escape"/);
  assert.match(shell, /querySelectorAll<HTMLElement>/);
  assert.match(shell, /document\.body\.style\.overflow = "hidden"/);
});

test("le statut, l’entreprise et le logout existant sont présents", () => {
  assert.match(shell, /Supabase connecté/);
  assert.match(shell, /Mode démo local/);
  assert.match(shell, /companyName \? <small>\{companyName\}<\/small> : null/);
  assert.match(shell, /<form action="\/auth\/logout" method="post">/);
  assert.match(shell, /Déconnexion/);
});

test("la sidebar desktop affiche toujours le workflow de déconnexion existant", () => {
  const sidebar = section(shell, '<aside className="sidebar">', "</aside>");
  assert.match(sidebar, /<form action="\/auth\/logout" method="post">/);
  assert.match(sidebar, /className="button ghost logout-button"/);
  assert.match(sidebar, /<LogOut size=\{16\} \/>Déconnexion/);
  assert.doesNotMatch(sidebar, /mode === "supabase" \? <form/);
});

test("les contraintes tactiles, safe areas et séparation desktop restent explicites", () => {
  assert.match(css, /\.mobile-nav-link \{[^}]*min-height:\s*52px/);
  assert.match(css, /\.mobile-more-link \{[^}]*min-height:\s*52px/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /safe-area-inset-left/);
  assert.match(css, /safe-area-inset-right/);
  assert.match(css, /@media \(min-width: 1024px\)[\s\S]*\.mobile-nav, \.mobile-more-layer \{ display: none; \}/);
  const desktop = section(shell, "const desktopNav = [", "function NavLink");
  assertOrdered(desktop, ["/approval", "/dashboard", "/prospects", "/campaigns", "/pipeline", "/stats", "/settings"]);
});
