"use client";

import { useState } from "react";
import { loginControlState } from "@/lib/auth/login-controls";

export function LoginForm({ disabled }: { disabled: boolean }) {
  const [submitting, setSubmitting] = useState(false);
  const controls = loginControlState(disabled, submitting);

  return <form action="/auth/login" method="post" aria-busy={submitting} onSubmit={(event) => {
    if (controls.submitDisabled) { event.preventDefault(); return; }
    setSubmitting(true);
  }}>
    <div className="field"><label htmlFor="email">Adresse email</label><input className="input" id="email" name="email" type="email" autoComplete="email" required disabled={controls.fieldsDisabled} readOnly={controls.fieldsReadOnly} placeholder="vous@bienenligne.fr" /></div>
    <div className="field"><label htmlFor="password">Mot de passe</label><input className="input" id="password" name="password" type="password" autoComplete="current-password" required disabled={controls.fieldsDisabled} readOnly={controls.fieldsReadOnly} /></div>
    <button className="button primary" type="submit" disabled={controls.submitDisabled}>{submitting ? "Connexion à votre espace..." : "Se connecter"}</button>
  </form>;
}
