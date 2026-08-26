import Link from "next/link";

export default function LoginPage() {
  const supabaseReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
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
        <form action="/auth/login" method="post">
          <div className="field"><label htmlFor="email">Adresse email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required placeholder="vous@bienenligne.fr" /></div>
          <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required /></div>
          <button className="button primary" type="submit" disabled={!supabaseReady}>Se connecter</button>
        </form>
        <div className="divider">ou</div>
        <div className="demo-callout">Mode démo local : explorez tout le workflow sans compte ni configuration.</div>
        <Link className="button" href="/dashboard">Ouvrir la démo locale</Link>
      </div>
    </section>
  </main>;
}
