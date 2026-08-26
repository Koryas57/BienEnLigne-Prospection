import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import OpenAI from "openai";
import {
  DEFAULT_OPENAI_MODEL,
  isOpenAIConfigured,
  resolveAIRequest,
  resolveOpenAIModel,
} from "../src/lib/ai/contracts.ts";
import { classifyOpenAIError, OpenAINotConfiguredError, openAIErrorPayload } from "../src/lib/ai/errors.ts";

test("détecte une clé absente sans révéler de métadonnée", () => {
  assert.equal(isOpenAIConfigured(undefined), false);
  assert.equal(isOpenAIConfigured(""), false);
  assert.equal(isOpenAIConfigured("   "), false);
});

test("détecte une clé présente et résout le modèle attendu", () => {
  assert.equal(isOpenAIConfigured("server-only-test-value"), true);
  assert.equal(resolveOpenAIModel(undefined), DEFAULT_OPENAI_MODEL);
  assert.equal(resolveOpenAIModel("  gpt-5.6-terra  "), "gpt-5.6-terra");
});

test("le composant Réglages affiche le modèle public sans champ de clé", () => {
  const component = readFileSync(new URL("../src/components/openai-status-card.tsx", import.meta.url), "utf8");
  assert.match(component, /Modèle :/);
  assert.match(component, /status\?\.model/);
  assert.doesNotMatch(component, /OPENAI_API_KEY|apiKey|keyPrefix|keyLength/);
});

test("une erreur OpenAI Supabase interrompt le flux avant persistance", async () => {
  let persisted = false;
  await assert.rejects(async () => {
    const result = await resolveAIRequest("supabase", async () => { throw new Error("OpenAI indisponible"); }, () => ({ demo: true }));
    persisted = Boolean(result.data);
  }, /OpenAI indisponible/);
  assert.equal(persisted, false);
});

test("le fallback démo reste disponible uniquement en mode local", async () => {
  const result = await resolveAIRequest("demo", async () => { throw new Error("OpenAI indisponible"); }, () => ({ source: "demo" }));
  assert.deepEqual(result, { data: { source: "demo" }, demo: true });
});

test("les succès OpenAI ne sont jamais marqués démo", async () => {
  const result = await resolveAIRequest("supabase", async () => ({ source: "openai" }), () => ({ source: "demo" }));
  assert.deepEqual(result, { data: { source: "openai" }, demo: false });
});

test("classifie les erreurs OpenAI sans reprendre leur message sensible", () => {
  const headers = new Headers();
  const cases = [
    [new OpenAINotConfiguredError(), "not_configured"],
    [OpenAI.APIError.generate(401, { code: "invalid_api_key" }, "sensitive-auth-detail", headers), "invalid_auth"],
    [OpenAI.APIError.generate(429, { code: "credit_balance_exhausted" }, "sensitive-quota-detail", headers), "quota_or_rate_limit"],
    [OpenAI.APIError.generate(404, { code: "model_not_found", param: "model" }, "sensitive-model-detail", headers), "model_unavailable"],
    [OpenAI.APIError.generate(400, { code: "invalid_value", param: "input" }, "sensitive-request-detail", headers), "invalid_request"],
    [new OpenAI.APIConnectionTimeoutError({ message: "sensitive-timeout-detail" }), "timeout_or_unavailable"],
    [OpenAI.APIError.generate(500, {}, "sensitive-service-detail", headers), "timeout_or_unavailable"],
  ];
  for (const [error, code] of cases) {
    const classified = classifyOpenAIError(error);
    assert.equal(classified.code, code);
    assert.doesNotMatch(JSON.stringify(openAIErrorPayload(error)), /sensitive-/);
  }
});
