import Link from "next/link";

export default function NotFound() {
  return <main className="center-page"><div className="auth-card"><p className="eyebrow">404</p><h1>Page introuvable</h1><p>Cette page n’existe pas ou a été déplacée.</p><Link className="button primary" href="/dashboard">Retour au cockpit</Link></div></main>;
}
