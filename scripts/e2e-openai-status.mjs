const required = ["E2E_EMAIL", "E2E_PASSWORD", "OPENAI_API_KEY"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Variables manquantes: ${missing.join(", ")}`);

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3200";
const results = [];

function pass(test, evidence) {
  results.push({ test, result: "PASS", evidence });
}

function assert(condition, test, evidence) {
  if (!condition) throw new Error(`${test}: ${evidence}`);
  pass(test, evidence);
}

function absorbCookies(headers, jar) {
  const values = typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];
  for (const value of values) {
    const pair = value.split(";", 1)[0];
    const separator = pair.indexOf("=");
    if (separator < 1) continue;
    const name = pair.slice(0, separator);
    const cookieValue = pair.slice(separator + 1);
    if (cookieValue) jar.set(name, cookieValue);
    else jar.delete(name);
  }
}

async function request(path, options, jar) {
  const headers = new Headers(options?.headers ?? {});
  if (jar.size) headers.set("cookie", [...jar].map(([name, value]) => `${name}=${value}`).join("; "));
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers, redirect: "manual" });
  absorbCookies(response.headers, jar);
  return response;
}

try {
  const anonymous = new Map();
  const anonymousStatus = await request("/api/ai/status", {}, anonymous);
  assert(anonymousStatus.status === 401, "Route protégée", "statut OpenAI inaccessible sans session");

  const jar = new Map();
  const login = await request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD }),
  }, jar);
  assert(login.status === 303 && jar.size > 0, "Connexion", "session Supabase obtenue");

  const statusResponse = await request("/api/ai/status", {}, jar);
  const statusText = await statusResponse.text();
  const statusPayload = JSON.parse(statusText);
  const status = statusPayload.data;
  assert(statusResponse.status === 200 && status?.configured === true, "Clé présente", "configuration serveur détectée sans exposer la clé");
  assert(status?.model === "gpt-5.6-terra", "Modèle", "gpt-5.6-terra retourné par le statut serveur");
  assert(!statusText.includes(process.env.OPENAI_API_KEY) && !/(apiKey|keyLength|keyPrefix|OPENAI_API_KEY)/i.test(statusText), "Réponse sécurisée", "aucune clé ni métadonnée de clé dans la réponse HTTP");

  const invalidResponse = await request("/api/ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ task: "unknown" }),
  }, jar);
  const invalidPayload = await invalidResponse.json();
  assert(invalidResponse.status === 400 && invalidPayload?.error?.code === "invalid_request" && typeof invalidPayload?.error?.message === "string", "Erreur structurée", "code public stable sans objet d’erreur brut");

  const testResponse = await request("/api/ai/status", { method: "POST" }, jar);
  const testPayload = await testResponse.json();
  assert(
    testResponse.status === 200 && testPayload?.data?.operational === true && testPayload?.data?.message === "Connexion OpenAI opérationnelle - gpt-5.6-terra",
    "Test OpenAI réel",
    testResponse.ok ? "appel minimal réussi avec gpt-5.6-terra" : `échec classifié: ${testPayload?.error?.code || "unknown"}`,
  );

  const logout = await request("/auth/logout", { method: "POST" }, jar);
  assert(logout.status === 303, "Nettoyage session", "session E2E supprimée");
} catch (error) {
  results.push({ test: "Scénario OpenAI", result: "FAIL", evidence: error instanceof Error ? error.message : "Erreur inconnue" });
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
