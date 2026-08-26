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
  const loginResponse = await login(jar);
  assert(loginResponse.status === 303 && loginResponse.headers.get("location")?.endsWith("/dashboard") && jar.size > 0, "Connexion", "session Supabase créée et redirection /dashboard");

  const routes = [
    ["Aujourd’hui", "/dashboard", "Voici ce qui mérite votre attention aujourd’hui."],
    ["Validation", "/approval", "File de validation"],
    ["Prospects", "/prospects", "Base commerciale"],
    ["Campagnes", "/campaigns", "Cadrez une zone"],
    ["Pipeline", "/pipeline", "Vue commerciale"],
    ["Stats", "/stats", "Statistiques"],
    ["Réglages", "/settings", "Configuration"],
  ];

  let dashboardBody = "";
  let dashboardCacheControl = "";
  for (const [label, path, marker] of routes) {
    const response = await request(path, {}, jar);
    const body = await response.text();
    assert(response.status === 200 && body.includes(marker) && !body.includes("Quelque chose s’est mal passé"), `Navigation ${label}`, `HTTP 200 sur ${path}`);
    if (path === "/dashboard") {
      dashboardBody = body;
      dashboardCacheControl = response.headers.get("cache-control") || "";
    }
  }

  const mobileNav = dashboardBody.match(/<nav class="mobile-nav"[\s\S]*?<\/nav>/)?.[0] || "";
  assert(
    ["Aujourd’hui", "Validation", "Prospects", "Campagnes", "Plus"].every((label) => mobileNav.includes(label))
      && !mobileNav.includes("Stats")
      && !mobileNav.includes("Réglages")
      && mobileNav.includes('aria-haspopup="dialog"'),
    "Structure mobile",
    "cinq entrées principales et déclencheur Plus rendu",
  );

  const sidebar = dashboardBody.match(/<aside class="sidebar">[\s\S]*?<\/aside>/)?.[0] || "";
  assert(
    ["Validation", "Aujourd’hui", "Prospects", "Campagnes", "Pipeline", "Stats", "Réglages", "Déconnexion"].every((label) => sidebar.includes(label)),
    "Navigation desktop",
    "sidebar complète et logout conservés",
  );

  const logoutResponse = await request("/auth/logout", { method: "POST" }, jar);
  assert(logoutResponse.status === 303 && logoutResponse.headers.get("location")?.endsWith("/login"), "Logout mobile", "POST /auth/logout puis redirection /login");

  const privateAfterLogout = await request("/dashboard", {}, jar);
  const afterLogoutBody = await privateAfterLogout.text();
  const location = privateAfterLogout.headers.get("location");
  const deniedByHttpRedirect = [303, 307, 308].includes(privateAfterLogout.status) && location && new URL(location, baseUrl).pathname === "/login";
  const deniedByStreamedRedirect = privateAfterLogout.status === 200 && afterLogoutBody.includes('id="__next-page-redirect"') && afterLogoutBody.includes("url=/login");
  assert(deniedByHttpRedirect || deniedByStreamedRedirect, "Protection après logout", "accès direct /dashboard redirigé vers /login");
  assert(dashboardCacheControl.includes("no-store"), "Retour navigateur", "document privé non stockable après invalidation de session");
} catch (error) {
  results.push({ test: "Scénario navigation mobile", result: "FAIL", evidence: error instanceof Error ? error.message : "Erreur inconnue" });
  process.exitCode = 1;
}

process.stdout.write(`${JSON.stringify({ results }, null, 2)}\n`);
