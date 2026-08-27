"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, Database, Gamepad2, LogOut, RotateCcw, Settings2, ShieldCheck, SlidersHorizontal, UserRound } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { OpenAIStatusCard } from "@/components/openai-status-card";
import { Card } from "@/components/ui";
import { deriveGameProgress } from "@/lib/gameplay";

type SettingsTab = "account" | "preferences" | "gameplay" | "diagnostics";

const tabs = [
  { id: "account", label: "Compte", icon: UserRound },
  { id: "preferences", label: "Préférences", icon: SlidersHorizontal },
  { id: "gameplay", label: "Gameplay", icon: Gamepad2 },
  { id: "diagnostics", label: "Diagnostics", icon: Settings2 },
] as const;

export default function SettingsPage() {
  const { state, mode, resetDemo, updateProfile, updateSettings } = useAppStore();
  const [tab, setTab] = useState<SettingsTab>("account");
  const game = deriveGameProgress(state);
  const providerRuns = state.prospects.flatMap((prospect) => prospect.enrichment?.providers ?? []);

  async function saveProfile(formData: FormData) {
    await updateProfile({ displayName: String(formData.get("displayName") ?? "").trim(), companyName: String(formData.get("companyName") ?? "").trim() });
  }
  async function saveCadence(formData: FormData) {
    await updateSettings({ followUp1Days: Number(formData.get("followUp1Days")), followUp2Days: Number(formData.get("followUp2Days")), defaultPrice: Number(formData.get("defaultPrice")), defaultCurrency: String(formData.get("defaultCurrency")) });
  }

  return <div className="settings-page">
    <header className="game-page-heading"><div><span>Votre espace</span><h1>Paramètres</h1></div></header>
    <nav className="settings-tabs" aria-label="Sections des paramètres">{tabs.map(({ id, label, icon: Icon }) => <button type="button" key={id} className={tab === id ? "active" : ""} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={18} />{label}</button>)}</nav>

    {tab === "account" ? <section className="settings-content"><Card className="settings-main-card"><span className="settings-card-icon"><UserRound size={24} /></span><h2>Votre profil</h2><p>Le nom affiché dans votre progression.</p><form action={saveProfile}><div className="field"><label htmlFor="displayName">Nom affiché</label><input className="input" id="displayName" name="displayName" required minLength={2} defaultValue={state.profile.displayName} /></div><div className="field"><label htmlFor="companyName">Entreprise</label><input className="input" id="companyName" name="companyName" required minLength={2} defaultValue={state.profile.companyName} /></div><div className="form-actions"><button className="button primary" type="submit">Enregistrer</button></div></form></Card><Card className="settings-side-card"><h2>Session</h2><p>Déconnectez cet appareil en toute sécurité.</p><form action="/auth/logout" method="post"><button className="button danger" type="submit"><LogOut size={18} />Déconnexion</button></form></Card></section> : null}

    {tab === "preferences" ? <section className="settings-content"><Card className="settings-main-card"><span className="settings-card-icon"><SlidersHorizontal size={24} /></span><h2>Préférences commerciales</h2><p>Adaptez votre rythme de travail et votre offre.</p><form action={saveCadence}><div className="form-grid"><div className="field"><label htmlFor="followUp1Days">Première relance</label><input className="input" id="followUp1Days" name="followUp1Days" type="number" min="1" required defaultValue={state.settings.followUp1Days} /></div><div className="field"><label htmlFor="followUp2Days">Seconde relance</label><input className="input" id="followUp2Days" name="followUp2Days" type="number" min={state.settings.followUp1Days + 1} required defaultValue={state.settings.followUp2Days} /></div><div className="field"><label htmlFor="defaultPrice">Prix par défaut</label><input className="input" id="defaultPrice" name="defaultPrice" type="number" min="0" required defaultValue={state.settings.defaultPrice} /></div><div className="field"><label htmlFor="defaultCurrency">Devise</label><select className="select" id="defaultCurrency" name="defaultCurrency" defaultValue={state.settings.defaultCurrency}><option>USD</option><option>EUR</option></select></div></div><div className="form-actions"><button className="button primary" type="submit">Enregistrer</button></div></form></Card></section> : null}

    {tab === "gameplay" ? <section className="settings-content"><Card className="settings-main-card gameplay-settings"><span className="settings-card-icon"><Gamepad2 size={24} /></span><h2>Progression</h2><div className="gameplay-level-preview"><strong>Niveau {game.level}</strong><span>{game.title}</span><b>{game.totalXp} XP</b></div><div className="detail-list"><div className="detail-row"><span>Analyse terminée</span><strong>+20 XP</strong></div><div className="detail-row"><span>Cible qualifiée</span><strong>+15 XP</strong></div><div className="detail-row"><span>Message approuvé</span><strong>+15 XP</strong></div><div className="detail-row"><span>Réponse reçue</span><strong>+30 XP</strong></div><div className="detail-row"><span>Vente remportée</span><strong>+100 XP</strong></div></div></Card><Card className="settings-side-card"><h2>Collection</h2><p>{game.achievements.filter((achievement) => achievement.unlocked).length} succès débloqués.</p><Link className="button" href="/collection">Voir les insignes</Link></Card></section> : null}

    {tab === "diagnostics" ? <section className="diagnostics-grid"><OpenAIStatusCard mode={mode} /><Card className="card-pad"><div className="section-heading"><div><p className="eyebrow">Stockage</p><h2>Supabase</h2></div><Database size={20} /></div><div className="detail-list"><div className="detail-row"><span>État</span><strong>{mode === "supabase" ? "Connecté" : "Mode démo local"}</strong></div><div className="detail-row"><span>Isolation</span><strong>{mode === "supabase" ? "RLS utilisateur" : "Navigateur local"}</strong></div></div>{mode === "demo" ? <button className="button danger" onClick={() => { if (window.confirm("Réinitialiser les données de démonstration ?")) resetDemo(); }}><RotateCcw size={16} />Réinitialiser la démo</button> : null}</Card><Card className="card-pad"><div className="section-heading"><div><p className="eyebrow">Données & sources</p><h2>Enrichissement</h2></div><Bot size={20} /></div><p className="muted">{providerRuns.length ? `${providerRuns.length} exécution(s) enregistrée(s) dans les fiches prospects.` : "Aucune exécution enregistrée."}</p><details className="diagnostic-details"><summary>Voir les fournisseurs</summary><div className="detail-list">{providerRuns.slice(0, 20).map((run, index) => <div className="detail-row" key={`${run.provider}-${run.fetchedAt}-${index}`}><span>{run.provider}</span><strong>{run.status}{run.cached ? " · cache" : ""}</strong></div>)}</div></details></Card><Card className="card-pad"><div className="section-heading"><div><p className="eyebrow">Sécurité</p><h2>Envois</h2></div><ShieldCheck size={20} /></div><p className="muted">Aucun message n’est envoyé sans validation explicite.</p><Link className="button" href="/approval">Ouvrir la file de validation</Link></Card></section> : null}
  </div>;
}
