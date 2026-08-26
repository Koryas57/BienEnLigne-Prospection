"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FileUp, Plus, Search, UserRoundPlus } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import type { Channel, ProspectStatus } from "@/lib/types";

const filters: Array<"ALL" | ProspectStatus> = ["ALL", "NEW", "QUALIFIED", "APPROVED", "CONTACTED", "INTERESTED", "WON", "DO_NOT_CONTACT"];
const label: Record<string, string> = { ALL: "Tous", NEW: "Nouveaux", QUALIFIED: "Qualifiés", APPROVED: "Approuvés", CONTACTED: "Contactés", INTERESTED: "Intéressés", WON: "Gagnés", DO_NOT_CONTACT: "Bloqués" };

export default function ProspectsPage() {
  const { state, addProspect } = useAppStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof filters)[number]>("ALL");
  const [showForm, setShowForm] = useState(false);
  const [created, setCreated] = useState(false);

  const visible = useMemo(() => state.prospects.filter((prospect) => {
    const matches = `${prospect.businessName} ${prospect.city} ${prospect.category}`.toLowerCase().includes(query.toLowerCase());
    return matches && (filter === "ALL" || prospect.status === filter);
  }), [filter, query, state.prospects]);

  function submit(formData: FormData) {
    const campaignId = String(formData.get("campaignId"));
    const campaign = state.campaigns.find((item) => item.id === campaignId) ?? state.campaigns[0];
    const businessName = String(formData.get("businessName") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    if (!campaign || !businessName || !city) return;
    addProspect({
      campaignId: campaign.id, businessName, city, state: campaign.state, country: campaign.country, timezone: campaign.timezone,
      category: String(formData.get("category") || campaign.sector), phone: String(formData.get("phone") || "") || undefined,
      email: String(formData.get("email") || "") || undefined, websiteUrl: String(formData.get("websiteUrl") || "") || undefined,
      instagramUrl: String(formData.get("instagramUrl") || "") || undefined, facebookUrl: String(formData.get("facebookUrl") || "") || undefined,
      googleMapsUrl: String(formData.get("googleMapsUrl") || "") || undefined, source: "Ajout manuel", status: "NEW", leadScore: 0,
      qualificationReason: "À analyser", hasWebsite: formData.get("websiteUrl") ? true : "unknown", websiteMobileFriendly: "unknown",
      websiteHttps: "unknown", instagramActive: formData.get("instagramUrl") ? "unknown" : false, facebookActive: formData.get("facebookUrl") ? "unknown" : false,
      googlePresence: formData.get("googleMapsUrl") ? true : "unknown", independentBusiness: "unknown", likelyFranchise: "unknown",
    });
    setCreated(true); setShowForm(false);
  }

  return <>
    <PageHeader eyebrow="Base commerciale" title="Prospects" description={`${state.prospects.length} entreprises dans votre espace.`} action={<button className="button primary" onClick={() => setShowForm((value) => !value)}><Plus size={17} />Ajouter</button>} />
    {showForm ? <Card className="card-pad section">
      <div className="section-heading"><div><p className="eyebrow">Ajout rapide</p><h2>Nouveau prospect</h2></div></div>
      <form action={submit}>
        <div className="form-grid">
          <div className="field"><label htmlFor="businessName">Entreprise *</label><input className="input" id="businessName" name="businessName" required /></div>
          <div className="field"><label htmlFor="city">Ville *</label><input className="input" id="city" name="city" required defaultValue={state.campaigns[0]?.city} /></div>
          <div className="field"><label htmlFor="category">Secteur</label><input className="input" id="category" name="category" defaultValue="Restaurant" /></div>
          <div className="field"><label htmlFor="campaignId">Campagne</label><select className="select" id="campaignId" name="campaignId">{state.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></div>
          <div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" inputMode="email" /></div>
          <div className="field"><label htmlFor="phone">Téléphone</label><input className="input" id="phone" name="phone" type="tel" inputMode="tel" /></div>
          <div className="field"><label htmlFor="websiteUrl">Site</label><input className="input" id="websiteUrl" name="websiteUrl" type="url" inputMode="url" placeholder="https://" /></div>
          <div className="field"><label htmlFor="googleMapsUrl">Google Maps</label><input className="input" id="googleMapsUrl" name="googleMapsUrl" type="url" inputMode="url" placeholder="https://" /></div>
          <div className="field"><label htmlFor="instagramUrl">Instagram</label><input className="input" id="instagramUrl" name="instagramUrl" type="url" inputMode="url" placeholder="https://" /></div>
          <div className="field"><label htmlFor="facebookUrl">Facebook</label><input className="input" id="facebookUrl" name="facebookUrl" type="url" inputMode="url" placeholder="https://" /></div>
        </div>
        <div className="form-actions"><button className="button" type="button" onClick={() => setShowForm(false)}>Annuler</button><button className="button primary" type="submit">Créer le prospect</button></div>
      </form>
    </Card> : null}
    <div className="search-row section"><div className="search-box"><Search size={18} /><input className="input" aria-label="Rechercher un prospect" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, ville ou secteur…" /></div><Link className="icon-button" href="/prospects/import" aria-label="Importer un CSV"><FileUp size={19} /></Link></div>
    <div className="filter-chip-row">{filters.map((item) => <button key={item} className={`filter-chip ${filter === item ? "active" : ""}`} onClick={() => setFilter(item)}>{label[item]}</button>)}</div>
    <div className="list section">
      {visible.map((prospect) => <Link href={`/prospects/${prospect.id}`} className="list-card" key={prospect.id}>
        <div className="list-card-top"><div><h3>{prospect.businessName}</h3><p>{prospect.category} · {prospect.city}, {prospect.state}</p></div><span className="score">{prospect.leadScore}</span></div>
        <div className="list-card-meta"><Badge tone={prospect.status === "DO_NOT_CONTACT" ? "red" : prospect.status === "INTERESTED" || prospect.status === "WON" ? "green" : "neutral"}>{prospect.status}</Badge>{(["instagram", "facebook", "email"] as Channel[]).filter((channel) => channel === "instagram" ? prospect.instagramUrl : channel === "facebook" ? prospect.facebookUrl : prospect.email).map((channel) => <Badge key={channel}>{channel}</Badge>)}</div>
      </Link>)}
      {!visible.length ? <Card><EmptyState icon={<UserRoundPlus size={27} />} title="Aucun prospect ici" description="Ajoutez une entreprise manuellement ou importez un fichier CSV." /></Card> : null}
    </div>
    {created ? <div className="toast" role="status">Prospect créé. Vous pouvez maintenant lancer son analyse.</div> : null}
  </>;
}
