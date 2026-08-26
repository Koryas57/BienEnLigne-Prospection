const required = ["E2E_EMAIL", "E2E_PASSWORD"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) throw new Error(`Variables manquantes: ${missing.join(", ")}`);

const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:3200";
const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;
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

async function login(jar) {
  return request("/auth/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ email, password }),
  }, jar);
}

try {
  const jar = new Map();
  const preparation = await login(jar);
  assert(preparation.status === 303 && jar.size > 0, "Préparation session", "login préparatoire et cookie reçus");
  const initialLogout = await request("/auth/logout", { method: "POST" }, jar);
  assert(initialLogout.status === 303, "Logout initial", "session préparatoire supprimée");

  const freshLogin = await login(jar);
  assert(freshLogin.status === 303 && new URL(freshLogin.headers.get("location"), baseUrl).pathname === "/dashboard" && jar.size > 0, "Login frais", "redirection /dashboard avec cookie");

  const immediate = await request("/dashboard", {}, jar);
  const immediateBody = await immediate.text();
  assert(immediate.status === 200 && immediateBody.includes("Données synchronisées") && !immediateBody.includes("Quelque chose s’est mal passé"), "Dashboard immédiat", "HTTP 200, workspace Supabase rendu sans error boundary");

  const hardRefresh = await request("/dashboard", { headers: { "cache-control": "no-cache" } }, jar);
  const refreshBody = await hardRefresh.text();
  assert(hardRefresh.status === 200 && refreshBody.includes("Données synchronisées"), "Hard refresh", "workspace toujours disponible");

  const newTabJar = new Map(jar);
  const newTab = await request("/dashboard", {}, newTabJar);
  const newTabBody = await newTab.text();
  assert(newTab.status === 200 && newTabBody.includes("Données synchronisées"), "Nouvel onglet", "accès direct avec session partagée valide");

  const finalLogout = await request("/auth/logout", { method: "POST" }, jar);
  assert(finalLogout.status === 303, "Logout final", "session supprimée");
  const privateAfterLogout = await request("/dashboard", {}, jar);
  const afterLogoutBody = await privateAfterLogout.text();
  const redirectLocation = privateAfterLogout.headers.get("location");
  const isHttpRedirect = [303, 307, 308].includes(privateAfterLogout.status)
    && redirectLocation
    && new URL(redirectLocation, baseUrl).pathname === "/login";
  const isStreamedRedirect = privateAfterLogout.status === 200
    && afterLogoutBody.includes('id="__next-page-redirect"')
    && afterLogoutBody.includes("url=/login")
    && !afterLogoutBody.includes("Données synchronisées");
  assert(isHttpRedirect || isStreamedRedirect, "Route privée après logout", isHttpRedirect ? "redirection HTTP vers /login" : "redirection Next.js streamée vers /login");
} catch (error) {
  results.push({ test: "Scénario fresh-login", result: "FAIL", evidence: error.message });
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
