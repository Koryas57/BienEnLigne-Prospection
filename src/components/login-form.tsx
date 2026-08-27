"use client";

import { useState } from "react";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [submitting, setSubmitting] = useState(false);

  return <form action="/auth/login" method="post" aria-busy={submitting} onSubmit={() => setSubmitting(true)}>
    <div className="field"><label htmlFor="email">Adresse email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required disabled={disabled || submitting} placeholder="vous@bienenligne.fr" /></div>
    <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" minLength={8} required disabled={disabled || submitting} /></div>
    <button className="button primary" type="submit" disabled={disabled || submitting}>{submitting ? "Connexion à votre espace..." : "Se connecter"}</button>
  </form>;
}
