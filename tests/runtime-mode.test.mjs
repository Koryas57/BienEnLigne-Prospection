import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { hasCompleteSupabaseConfig, resolveRuntimeDataMode } from "../src/lib/runtime-mode.ts";

const login = readFileSync(new URL("../src/app/login/page.tsx", import.meta.url), "utf8");
const loginForm = readFileSync(new URL("../src/components/login-form.tsx", import.meta.url), "utf8");
const protectedLayout = readFileSync(new URL("../src/app/(app)/layout.tsx", import.meta.url), "utf8");
const appStore = readFileSync(new URL("../src/components/app-store.tsx", import.meta.url), "utf8");
const apiAuth = readFileSync(new URL("../src/lib/supabase/api-auth.ts", import.meta.url), "utf8");

test("une configuration Supabase partielle ou vide reste invalide", () => {
  assert.equal(hasCompleteSupabaseConfig(undefined, undefined), false);
  assert.equal(hasCompleteSupabaseConfig("https://example.supabase.co", undefined), false);
  assert.equal(hasCompleteSupabaseConfig(undefined, "anon-key"), false);
  assert.equal(hasCompleteSupabaseConfig("   ", "anon-key"), false);
  assert.equal(hasCompleteSupabaseConfig("https://example.supabase.co", "anon-key"), true);
});

test("production sans Supabase devient une erreur de configuration, jamais une démo", () => {
  assert.equal(resolveRuntimeDataMode("production", false), "configuration_error");
  assert.equal(resolveRuntimeDataMode("test", false), "configuration_error");
  assert.equal(resolveRuntimeDataMode(undefined, false), "configuration_error");
  assert.equal(resolveRuntimeDataMode("production", true), "supabase");
});

test("development conserve explicitement le mode démo local", () => {
  assert.equal(resolveRuntimeDataMode("development", false), "demo");
  assert.equal(resolveRuntimeDataMode("development", true), "supabase");
});

test("la page de connexion masque la démo et désactive le formulaire en erreur de configuration", () => {
  assert.match(login, /<LoginForm disabled=\{!supabaseReady\} \/>/);
  assert.equal((loginForm.match(/disabled=\{disabled \|\| submitting\}/g) ?? []).length, 3);
  assert.match(login, /runtimeMode === "configuration_error"/);
  assert.match(login, /Configuration serveur incomplète/);
  assert.match(login, /runtimeMode === "demo" \? <>/);
  assert.match(login, /Ouvrir la démo locale/);
  assert.doesNotMatch(login, /!supabaseReady \? <>/);
});

test("le dashboard production redirige avant de charger les données démo", () => {
  assert.doesNotMatch(protectedLayout, /import \{ initialState \} from "@\/lib\/demo-data"/);
  const redirectIndex = protectedLayout.indexOf('redirect("/login?error=configuration-error")');
  const demoImportIndex = protectedLayout.indexOf('await import("@/lib/demo-data")');
  assert.ok(redirectIndex >= 0 && demoImportIndex > redirectIndex);
  assert.doesNotMatch(appStore, /@\/lib\/demo-data/);
  assert.match(apiAuth, /resolveRuntimeDataMode\(process\.env\.NODE_ENV, false\) === "demo"/);
});
