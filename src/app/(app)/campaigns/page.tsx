"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ClipboardCheck, Layers3, MapPin, MessageCircle, Plus, ScanLine } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { GameAsset } from "@/components/game-asset";
import { ProgressBar } from "@/components/game-ui";
import { Card } from "@/components/ui";
import { deriveGameProgress } from "@/lib/gameplay";
import type { Channel } from "@/lib/types";

const objectiveMeta = {
  analyze: { icon: Layers3, asset: "deck", href: "/prospects", color: "mint" },
  approve: { icon: ClipboardCheck, href: "/approval", color: "violet" },
  contact: { icon: MessageCircle, href: "/pipeline", color: "sun" },
} as const;

export default function CampaignsPage() {
  const { state, addCampaign, updateCampaign } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [managerOpen, setManagerOpen] = useState(false);
  const game = deriveGameProgress(state);
  const active = state.campaigns.find((campaign) => campaign.status === "ACTIVE") ?? state.campaigns[0];
  const activeProspects = state.prospects.filter((prospect) => prospect.campaignId === active?.id && prospect.status !== "DO_NOT_CONTACT");
  const completed = game.objectives.filter((objective) => objective.current >= objective.target).length;

  async function submit(formData: FormData) {
    const channels = (["instagram", "facebook", "email"] as Channel[]).filter((channel) => formData.get(channel));
    const id = await addCampaign({ name: String(formData.get("name")), country: String(formData.get("country")), state: String(formData.get("state")), city: String(formData.get("city")), timezone: String(formData.get("timezone")), sector: String(formData.get("sector")), price: Number(formData.get("price")), currency: String(formData.get("currency")), status: "ACTIVE", minReviews: Number(formData.get("minReviews")), maxProspects: Number(formData.get("maxProspects")), channels, notes: String(formData.get("notes") || "") });
    if (id) setShowForm(false);
  }

  return <div className="missions-page">
    <header className="game-page-heading"><div><span>Progression du jour</span><h1>Missions</h1></div><div className="daily-completion"><strong>{completed}</strong><span>/ {game.objectives.length}</span></div></header>
    <div className="daily-master-progress"><ProgressBar value={completed} max={game.objectives.length} label="Missions terminées" /></div>

    <section className="large-mission-list">{game.objectives.map((objective) => {
      const meta = objectiveMeta[objective.id];
      const Icon = meta.icon;
      const done = objective.current >= objective.target;
      return <Link className={`large-mission-card ${meta.color} ${done ? "complete" : ""}`} href={meta.href} key={objective.id}><span className="large-mission-icon">{done ? <GameAsset name="achievement-unlocked" size={82} decorative /> : "asset" in meta ? <GameAsset name={meta.asset} size={82} decorative /> : <Icon size={27} />}</span><div><h2>{objective.label}</h2><ProgressBar value={objective.current} max={objective.target} label={objective.label} compact /><p>{objective.current} / {objective.target}</p></div><span className="mission-xp"><GameAsset name="xp-crystal" size={30} decorative />+{objective.xp} XP</span><ArrowRight size={20} /></Link>;
    })}</section>

    {active ? <section className="current-journey">
      <div className="journey-art"><GameAsset name="mission-map" size={230} className="journey-map-asset" decorative /></div>
      <div><span>Mission en cours</span><h2>{active.city}</h2><p><MapPin size={15} />{active.sector} · {active.state}</p><ProgressBar value={activeProspects.length} max={active.maxProspects} label="Cartes découvertes" compact /><Link className="game-primary-button" href="/scan"><ScanLine size={19} />Scanner cette mission</Link></div>
    </section> : null}

    <section className="mission-management"><button className="mission-management-trigger" type="button" aria-expanded={managerOpen} onClick={() => setManagerOpen((open) => !open)}><span><strong>Mes missions</strong><small>{state.campaigns.length} mission{state.campaigns.length > 1 ? "s" : ""} configurée{state.campaigns.length > 1 ? "s" : ""}</small></span><Plus size={20} /></button>
      {managerOpen ? <div className="mission-management-content"><div className="saved-missions">{state.campaigns.map((campaign) => <article key={campaign.id}><span className={campaign.status === "ACTIVE" ? "active" : ""} /><div><strong>{campaign.city}</strong><small>{campaign.sector} · {state.prospects.filter((prospect) => prospect.campaignId === campaign.id).length}/{campaign.maxProspects}</small></div><details className="mission-options"><summary>Options</summary><form action={async (formData) => { await updateCampaign(campaign.id, { name: String(formData.get("name")), price: Number(formData.get("price")), notes: String(formData.get("notes") ?? "") }); }}><div className="field"><label htmlFor={`name-${campaign.id}`}>Nom</label><input className="input" id={`name-${campaign.id}`} name="name" required defaultValue={campaign.name} /></div><div className="field"><label htmlFor={`price-${campaign.id}`}>Prix</label><input className="input" id={`price-${campaign.id}`} name="price" type="number" min="0" required defaultValue={campaign.price} /></div><div className="field"><label htmlFor={`notes-${campaign.id}`}>Notes</label><textarea className="textarea" id={`notes-${campaign.id}`} name="notes" defaultValue={campaign.notes} /></div><div className="form-actions"><button className="button small-button" type="button" onClick={() => void updateCampaign(campaign.id, { status: campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{campaign.status === "ACTIVE" ? "Pause" : "Activer"}</button>{campaign.status !== "ARCHIVED" ? <button className="button small-button danger" type="button" onClick={() => { if (window.confirm("Archiver cette mission ?")) void updateCampaign(campaign.id, { status: "ARCHIVED" }); }}>Archiver</button> : null}<button className="button small-button primary" type="submit">Enregistrer</button></div></form></details></article>)}</div><button className="button" type="button" onClick={() => setShowForm((open) => !open)}><Plus size={17} />Nouvelle mission</button>{showForm ? <Card className="mission-create-form"><h2>Nouvelle mission</h2><form action={submit}><div className="form-grid"><div className="field span-2"><label htmlFor="name">Nom *</label><input className="input" id="name" name="name" required placeholder="Memphis HVAC" /></div><div className="field"><label htmlFor="country">Pays *</label><input className="input" id="country" name="country" required defaultValue="USA" /></div><div className="field"><label htmlFor="state">État / région *</label><input className="input" id="state" name="state" required /></div><div className="field"><label htmlFor="city">Ville *</label><input className="input" id="city" name="city" required /></div><div className="field"><label htmlFor="timezone">Fuseau horaire *</label><input className="input" id="timezone" name="timezone" required defaultValue="America/Chicago" /></div><div className="field"><label htmlFor="sector">Secteur *</label><input className="input" id="sector" name="sector" required /></div><div className="field"><label htmlFor="price">Prix *</label><input className="input" id="price" name="price" type="number" min="0" required defaultValue="350" /></div><div className="field"><label htmlFor="currency">Devise</label><select className="select" id="currency" name="currency"><option>USD</option><option>EUR</option></select></div><div className="field"><label htmlFor="minReviews">Minimum d’avis</label><input className="input" id="minReviews" name="minReviews" type="number" min="0" defaultValue="30" /></div><div className="field"><label htmlFor="maxProspects">Nombre de cartes</label><input className="input" id="maxProspects" name="maxProspects" type="number" min="1" defaultValue="100" /></div><div className="field span-2"><span>Canaux</span><div className="button-row">{["instagram", "facebook", "email"].map((channel) => <label className="filter-chip" key={channel}><input type="checkbox" name={channel} defaultChecked /> {channel}</label>)}</div></div><div className="field span-2"><label htmlFor="notes">Notes</label><textarea className="textarea" id="notes" name="notes" /></div></div><div className="form-actions"><button className="button" type="button" onClick={() => setShowForm(false)}>Annuler</button><button className="button primary" type="submit">Créer la mission</button></div></form></Card> : null}</div> : null}
    </section>
  </div>;
}
