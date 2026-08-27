import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loginControlState } from "../src/lib/auth/login-controls.ts";
import { parseLoginCredentials } from "../src/lib/auth/login-credentials.ts";

const loginForm = readFileSync(new URL("../src/components/login-form.tsx", import.meta.url), "utf8");
const loginRoute = readFileSync(new URL("../src/app/auth/login/route.ts", import.meta.url), "utf8");

function submittedLoginData(configurationDisabled, submitting, values) {
  const controls = loginControlState(configurationDisabled, submitting);
  const form = new FormData();
  if (!controls.fieldsDisabled) {
    form.set("email", values.email);
    form.set("password", values.password);
  }
  return { controls, form };
}

test("une soumission valide conserve email et password dans FormData", () => {
  const { form } = submittedLoginData(false, false, { email: "user@example.com", password: "secret" });
  assert.equal(form.get("email"), "user@example.com");
  assert.equal(form.get("password"), "secret");
});

test("submitting rend les champs readOnly sans les retirer de FormData", () => {
  const { controls, form } = submittedLoginData(false, true, { email: "user@example.com", password: "short" });
  assert.equal(controls.fieldsDisabled, false);
  assert.equal(controls.fieldsReadOnly, true);
  assert.equal(controls.submitDisabled, true);
  assert.equal(form.get("email"), "user@example.com");
  assert.equal(form.get("password"), "short");
});

test("configuration_error désactive réellement les champs et toute soumission", () => {
  const { controls, form } = submittedLoginData(true, false, { email: "user@example.com", password: "secret" });
  assert.equal(controls.fieldsDisabled, true);
  assert.equal(controls.submitDisabled, true);
  assert.equal(form.has("email"), false);
  assert.equal(form.has("password"), false);
});

test("le composant ne désactive jamais les champs à cause de submitting", () => {
  assert.equal((loginForm.match(/disabled=\{controls\.fieldsDisabled\}/g) ?? []).length, 2);
  assert.equal((loginForm.match(/readOnly=\{controls\.fieldsReadOnly\}/g) ?? []).length, 2);
  assert.match(loginForm, /disabled=\{controls\.submitDisabled\}/);
  assert.match(loginForm, /Connexion à votre espace\.\.\./);
  assert.doesNotMatch(loginForm, /minLength=/);
  assert.doesNotMatch(loginForm, /disabled=\{disabled \|\| submitting\}/);
});

test("un mot de passe non vide de moins de huit caractères atteint l'authentification", () => {
  const form = new FormData();
  form.set("email", "user@example.com");
  form.set("password", "short");
  const parsed = parseLoginCredentials(form);
  assert.equal(parsed.success, true);
  assert.equal(parsed.success && parsed.data.password, "short");
  assert.match(loginRoute, /signInWithPassword\(parsed\.data\)/);
});

test("un mot de passe vide reste invalid-input", () => {
  const form = new FormData();
  form.set("email", "user@example.com");
  form.set("password", "");
  assert.equal(parseLoginCredentials(form).success, false);
  assert.match(loginRoute, /if \(!parsed\.success\).*invalid-input/);
});
