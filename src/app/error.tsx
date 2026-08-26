"use client";

export default function ErrorPage() {
  return <main className="center-page"><div className="auth-card"><p className="eyebrow">Erreur</p><h1>Quelque chose s’est mal passé.</h1><p>Une erreur est survenue lors du chargement. Vos données enregistrées n’ont pas été modifiées.</p><button className="button primary" onClick={() => window.location.reload()}>Réessayer</button></div></main>;
}
