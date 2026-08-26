"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <main className="center-page"><div className="auth-card"><p className="eyebrow">Erreur</p><h1>Quelque chose s’est mal passé.</h1><p>Vos données locales n’ont pas été supprimées.</p><button className="button primary" onClick={reset}>Réessayer</button></div></main>;
}
