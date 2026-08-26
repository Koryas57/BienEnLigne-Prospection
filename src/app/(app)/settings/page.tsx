"use client";

import Link from "next/link";
import { Database, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { OpenAIStatusCard } from "@/components/openai-status-card";
import { Badge, Card, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { state, mode, resetDemo, updateProfile, updateSettings } = useAppStore();
  async function saveProfile(formData: FormData) {
    await updateProfile({ displayName: String(formData.get("displayName") ?? "").trim(), companyName: String(formData.get("companyName") ?? "").trim() });
  }
  async function saveCadence(formData: FormData) {
    await updateSettings({ followUp1Days: Number(formData.get("followUp1Days")), followUp2Days: Number(formData.get("followUp2Days")), defaultPrice: Number(formData.get("defaultPrice")), defaultCurrency: String(formData.get("defaultCurrency")) });
  }
  return <>
    <PageHeader eyebrow="Configuration" title="Réglages" description="Profil, stockage et cadence commerciale de votre espace." />
    <div className="grid grid-2">
      <Card className="card-pad"><div className="section-heading"><div><p className="eyebrow">Stockage</p><h2>{mode === "supabase" ? "Base distante" : "Mode local"}</h2></div><Badge tone="green">{mode === "supabase" ? "Supabase connecté" : "Mode démo local"}</Badge></div><p className="muted">{mode === "supabase" ? "Toutes les données métier utilisent votre session et les politiques RLS." : "Les modifications sont enregistrées uniquement dans ce navigateur."}</p>{mode === "demo" ? <button className="button danger" onClick={() => { if (window.confirm("Réinitialiser toutes les données locales avec les données de démonstration ?")) resetDemo(); }}><RotateCcw size={16} />Réinitialiser la démo</button> : null}</Card>
      <OpenAIStatusCard mode={mode} />
      <Card className="card-pad"><div className="section-heading"><h2>Supabase</h2><Database size={19} className="muted" /></div><p className="muted">Authentification, PostgreSQL, RLS et audit utilisent la session connectée. La service role n’est jamais chargée côté client.</p><div className="detail-list"><div className="detail-row"><span>État</span><strong>{mode === "supabase" ? "Connecté" : "Non configuré"}</strong></div><div className="detail-row"><span>Isolation</span><strong>RLS utilisateur</strong></div></div></Card>
      <Card className="card-pad"><div className="section-heading"><h2>Sécurité d’envoi</h2><ShieldCheck size={19} color="var(--brand)" /></div><p className="muted">Aucun provider d’envoi n’est actif. La contrainte d’approbation est vérifiée dans le modèle métier et la base.</p><Link className="button" href="/approval"><KeyRound size={16} />Voir la file de validation</Link></Card>
    </div>
    <div className="grid grid-2 section">
      <Card className="card-pad"><p className="eyebrow">Compte</p><h2>Profil utilisateur</h2><form action={saveProfile}><div className="field"><label htmlFor="displayName">Nom affiché</label><input className="input" id="displayName" name="displayName" required minLength={2} defaultValue={state.profile.displayName} /></div><div className="field"><label htmlFor="companyName">Entreprise</label><input className="input" id="companyName" name="companyName" required minLength={2} defaultValue={state.profile.companyName} /></div><div className="form-actions"><button className="button primary" type="submit">Enregistrer le profil</button></div></form></Card>
      <Card className="card-pad"><p className="eyebrow">Automatisation contrôlée</p><h2>Cadence de relance</h2><form action={saveCadence}><div className="form-grid"><div className="field"><label htmlFor="followUp1Days">Follow-up 1 (jours)</label><input className="input" id="followUp1Days" name="followUp1Days" type="number" min="1" required defaultValue={state.settings.followUp1Days} /></div><div className="field"><label htmlFor="followUp2Days">Follow-up 2 (jours)</label><input className="input" id="followUp2Days" name="followUp2Days" type="number" min={state.settings.followUp1Days + 1} required defaultValue={state.settings.followUp2Days} /></div><div className="field"><label htmlFor="defaultPrice">Prix par défaut</label><input className="input" id="defaultPrice" name="defaultPrice" type="number" min="0" required defaultValue={state.settings.defaultPrice} /></div><div className="field"><label htmlFor="defaultCurrency">Devise</label><select className="select" id="defaultCurrency" name="defaultCurrency" defaultValue={state.settings.defaultCurrency}><option>USD</option><option>EUR</option></select></div></div><div className="form-actions"><button className="button primary" type="submit">Enregistrer la cadence</button></div></form><p className="small muted">Après la seconde relance: STOP. Toute réponse ou statut « Ne pas contacter » annule les relances restantes.</p></Card>
    </div>
  </>;
}
