"use client";

import { useState } from "react";
import { MapPin, Megaphone, Plus } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, PageHeader } from "@/components/ui";
import type { Channel } from "@/lib/types";

export default function CampaignsPage() {
  const { state, addCampaign, updateCampaign } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  async function submit(formData: FormData) {
    const channels = (["instagram", "facebook", "email"] as Channel[]).filter((channel) => formData.get(channel));
    const id = await addCampaign({ name: String(formData.get("name")), country: String(formData.get("country")), state: String(formData.get("state")), city: String(formData.get("city")), timezone: String(formData.get("timezone")), sector: String(formData.get("sector")), price: Number(formData.get("price")), currency: String(formData.get("currency")), status: "ACTIVE", minReviews: Number(formData.get("minReviews")), maxProspects: Number(formData.get("maxProspects")), channels, notes: String(formData.get("notes") || "") });
    if (id) setShowForm(false);
  }
  return <>
    <PageHeader eyebrow="Ciblage" title="Campagnes" description="Cadrez une zone, une offre et les canaux utilisables." action={<button className="button primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} />Créer</button>} />
    {showForm ? <Card className="card-pad">
      <form action={submit}><div className="form-grid">
        <div className="field span-2"><label htmlFor="name">Nom *</label><input className="input" id="name" name="name" required placeholder="Memphis HVAC 499" /></div>
        <div className="field"><label htmlFor="country">Pays *</label><input className="input" id="country" name="country" required defaultValue="USA" /></div>
        <div className="field"><label htmlFor="state">État / région *</label><input className="input" id="state" name="state" required /></div>
        <div className="field"><label htmlFor="city">Ville *</label><input className="input" id="city" name="city" required /></div>
        <div className="field"><label htmlFor="timezone">Timezone *</label><input className="input" id="timezone" name="timezone" required defaultValue="America/Chicago" /></div>
        <div className="field"><label htmlFor="sector">Secteur *</label><input className="input" id="sector" name="sector" required /></div>
        <div className="field"><label htmlFor="price">Prix *</label><input className="input" id="price" name="price" type="number" min="0" required defaultValue="350" /></div>
        <div className="field"><label htmlFor="currency">Devise</label><select className="select" id="currency" name="currency"><option>USD</option><option>EUR</option></select></div>
        <div className="field"><label htmlFor="minReviews">Minimum d’avis</label><input className="input" id="minReviews" name="minReviews" type="number" min="0" defaultValue="30" /></div>
        <div className="field"><label htmlFor="maxProspects">Maximum de prospects</label><input className="input" id="maxProspects" name="maxProspects" type="number" min="1" defaultValue="100" /></div>
        <div className="field span-2"><span>Canaux autorisés</span><div className="button-row">{["instagram", "facebook", "email"].map((channel) => <label className="filter-chip" key={channel}><input type="checkbox" name={channel} defaultChecked /> {channel}</label>)}</div></div>
        <div className="field span-2"><label htmlFor="notes">Notes et critères</label><textarea className="textarea" id="notes" name="notes" placeholder="Indépendant, pas de franchise, activité récente…" /></div>
      </div><div className="form-actions"><button className="button" type="button" onClick={() => setShowForm(false)}>Annuler</button><button className="button primary" type="submit">Créer la campagne</button></div></form>
    </Card> : null}
    <div className="grid grid-2 section">{state.campaigns.map((campaign) => {
      const prospects = state.prospects.filter((prospect) => prospect.campaignId === campaign.id);
      return <Card className="card-pad" key={campaign.id}>
        <div className="section-heading"><div><p className="eyebrow">{campaign.country}</p><h2>{campaign.name}</h2></div><Badge tone={campaign.status === "ACTIVE" ? "green" : "amber"}>{campaign.status === "ACTIVE" ? "Active" : campaign.status === "PAUSED" ? "En pause" : "Archivée"}</Badge></div>
        <p className="muted"><MapPin size={15} /> {campaign.city}, {campaign.state} · {campaign.timezone}</p>
        <div className="detail-list"><div className="detail-row"><span>Secteur</span><strong>{campaign.sector}</strong></div><div className="detail-row"><span>Offre</span><strong>{campaign.price} {campaign.currency}</strong></div><div className="detail-row"><span>Prospects</span><strong>{prospects.length} / {campaign.maxProspects}</strong></div><div className="detail-row"><span>Minimum d’avis</span><strong>{campaign.minReviews}</strong></div></div>
        <div className="button-row">{campaign.channels.map((channel) => <Badge key={channel}>{channel}</Badge>)}</div>
        <details className="section"><summary className="button small-button">Modifier</summary><form action={async (formData) => { await updateCampaign(campaign.id, { name: String(formData.get("name")), price: Number(formData.get("price")), notes: String(formData.get("notes") ?? "") }); }}><div className="field"><label htmlFor={`name-${campaign.id}`}>Nom</label><input className="input" id={`name-${campaign.id}`} name="name" required defaultValue={campaign.name} /></div><div className="field"><label htmlFor={`price-${campaign.id}`}>Prix</label><input className="input" id={`price-${campaign.id}`} name="price" type="number" min="0" required defaultValue={campaign.price} /></div><div className="field"><label htmlFor={`notes-${campaign.id}`}>Notes</label><textarea className="textarea" id={`notes-${campaign.id}`} name="notes" defaultValue={campaign.notes} /></div><div className="form-actions"><button className="button primary" type="submit">Enregistrer</button></div></form></details>
        <div className="button-row section"><button className="button small-button" onClick={() => void updateCampaign(campaign.id, { status: campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE" })}>{campaign.status === "ACTIVE" ? "Mettre en pause" : "Réactiver"}</button>{campaign.status !== "ARCHIVED" ? <button className="button small-button danger" onClick={() => { if (window.confirm("Archiver cette campagne ?")) void updateCampaign(campaign.id, { status: "ARCHIVED" }); }}>Archiver</button> : null}</div>
      </Card>;
    })}</div>
    {!state.campaigns.length ? <Card><div className="empty-state"><Megaphone size={30} /><h3>Créez votre première campagne</h3></div></Card> : null}
  </>;
}
