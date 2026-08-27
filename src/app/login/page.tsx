import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { resolveRuntimeDataMode } from "@/lib/runtime-mode";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

const errors: Record<string, string> = {
  "not-configured": "Supabase n’est pas configuré.",
  "configuration-error": "Configuration serveur incomplète : Supabase est indisponible. Contactez l’administrateur.",
  "invalid-input": "Vérifiez l’adresse email et le mot de passe.",
  "invalid-credentials": "Email ou mot de passe incorrect.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const runtimeMode = resolveRuntimeDataMode(process.env.NODE_ENV, hasSupabaseConfig());
  const supabaseReady = runtimeMode === "supabase";
  if (supabaseReady) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims) redirect("/dashboard");
  }
  const { error } = await searchParams;
  const displayedError = runtimeMode === "configuration_error" ? errors["configuration-error"] : error ? errors[error] ?? "La connexion a échoué." : undefined;
  return <main className="auth-shell">
    <section className="auth-brand-panel">
      <div className="auth-logo"><span className="brand-mark">B</span><strong>Bien En Ligne</strong></div>
      <blockquote>Votre prospection, claire et prête avant le premier message.</blockquote>
      <p className="muted">Un outil interne. Aucun envoi automatique.</p>
    </section>
    <section className="auth-main">
      <div className="auth-card">
        <div className="auth-logo"><span className="brand-mark">B</span><strong>Bien En Ligne</strong></div>
        <p className="eyebrow">Espace sécurisé</p>
        <h1>Bon retour.</h1>
        <p className="muted">Connectez-vous pour retrouver votre cockpit commercial.</p>
        <LoginForm disabled={!supabaseReady} />
        {displayedError ? <p className="form-error" role="alert">{displayedError}</p> : null}
        {runtimeMode === "demo" ? <><div className="divider">ou</div><div className="demo-callout">Mode démo local : explorez le workflow sans compte.</div><Link className="button" href="/dashboard">Ouvrir la démo locale</Link></> : null}
      </div>
    </section>
  </main>;
}
