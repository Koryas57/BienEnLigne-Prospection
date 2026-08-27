"use client";

import { useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUp, Ban, FileUp, Plus, ScanLine } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { GameAsset } from "@/components/game-asset";
import { CategoryVisual, ProspectGameCard } from "@/components/game-ui";
import { Card, EmptyState } from "@/components/ui";
import type { Prospect } from "@/lib/types";

type DragStyle = CSSProperties & { "--drag-x": string; "--drag-y": string; "--drag-rotate": string; "--tilt-x": string; "--tilt-y": string; "--shine-x": string; "--shine-y": string };

export default function ProspectsPage() {
  const { state, addProspect, analyzeProspect, updateProspect, busy } = useAppStore();
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  const [drag, setDrag] = useState({ x: 0, y: 0, dragging: false });
  const [pointerStart, setPointerStart] = useState<{ x: number; y: number }>();
  const [showForm, setShowForm] = useState(false);
  const [feedback, setFeedback] = useState<string>();
  const playable = useMemo(() => state.prospects.filter((prospect) => prospect.status !== "DO_NOT_CONTACT" && !dismissed.has(prospect.id)).toSorted((a, b) => b.leadScore - a.leadScore), [dismissed, state.prospects]);
  const current = playable[0];

  function advance(id: string, message: string) {
    setDismissed((existing) => new Set(existing).add(id));
    setDrag({ x: 0, y: 0, dragging: false });
    setFeedback(message);
    window.setTimeout(() => setFeedback(undefined), 1600);
  }

  async function pass(prospect: Prospect) {
    await updateProspect(prospect.id, { status: "DO_NOT_CONTACT" });
    advance(prospect.id, "Carte passée");
  }

  function keep(prospect: Prospect) {
    advance(prospect.id, "Carte gardée dans le deck");
  }

  async function analyze(prospect: Prospect) {
    const analyzed = await analyzeProspect(prospect.id, { forceOpenAI: prospect.enrichment?.prequalification === "low" && !prospect.analysis });
    setDrag({ x: 0, y: 0, dragging: false });
    if (analyzed) { setFeedback("Analyse terminée · +20 XP"); window.setTimeout(() => setFeedback(undefined), 1800); }
  }

  function pointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (!current || busy) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setPointerStart({ x: event.clientX, y: event.clientY });
    setDrag({ x: 0, y: 0, dragging: true });
  }

  function pointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!pointerStart || !drag.dragging) return;
    setDrag({ x: event.clientX - pointerStart.x, y: event.clientY - pointerStart.y, dragging: true });
  }

  function pointerUp() {
    if (!current) return;
    setPointerStart(undefined);
    if (drag.y < -90 && Math.abs(drag.y) > Math.abs(drag.x)) { void analyze(current); return; }
    if (drag.x < -110) { void pass(current); return; }
    if (drag.x > 110) { keep(current); return; }
    setDrag({ x: 0, y: 0, dragging: false });
  }

  function handleKey(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!current || busy) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); void pass(current); }
    if (event.key === "ArrowUp") { event.preventDefault(); void analyze(current); }
    if (event.key === "ArrowRight") { event.preventDefault(); keep(current); }
  }

  async function submit(formData: FormData) {
    const campaign = state.campaigns.find((item) => item.id === String(formData.get("campaignId"))) ?? state.campaigns[0];
    const businessName = String(formData.get("businessName") ?? "").trim();
    const city = String(formData.get("city") ?? "").trim();
    if (!campaign || !businessName || !city) return;
    const id = await addProspect({ campaignId: campaign.id, businessName, city, state: campaign.state, country: campaign.country, timezone: campaign.timezone, category: String(formData.get("category") || campaign.sector), phone: String(formData.get("phone") || "") || undefined, email: String(formData.get("email") || "") || undefined, websiteUrl: String(formData.get("websiteUrl") || "") || undefined, instagramUrl: String(formData.get("instagramUrl") || "") || undefined, facebookUrl: String(formData.get("facebookUrl") || "") || undefined, source: "Ajout manuel", status: "NEW", leadScore: 0, qualificationReason: "À analyser", hasWebsite: "unknown", websiteMobileFriendly: "unknown", websiteHttps: "unknown", instagramActive: "unknown", facebookActive: "unknown", googlePresence: "unknown", independentBusiness: "unknown", likelyFranchise: "unknown" });
    if (id) { setShowForm(false); setFeedback("Nouvelle carte ajoutée"); }
  }

  const cardStyle = { "--drag-x": `${drag.x}px`, "--drag-y": `${drag.y}px`, "--drag-rotate": `${drag.x / 24}deg`, "--tilt-x": `${Math.max(-7, Math.min(7, drag.y / -18))}deg`, "--tilt-y": `${Math.max(-8, Math.min(8, drag.x / 18))}deg`, "--shine-x": `${50 + Math.max(-26, Math.min(26, drag.x / 5))}%`, "--shine-y": `${34 + Math.max(-20, Math.min(20, drag.y / 6))}%` } as DragStyle;

  return <div className="deck-page">
    <header className="game-page-heading deck-page-heading"><div><span>Votre deck</span><h1>{playable.length ? `${playable.length} carte${playable.length > 1 ? "s" : ""} à trier` : "Deck terminé"}</h1></div><GameAsset name="deck" size={112} className="deck-heading-asset" decorative priority /><div className="heading-actions"><Link className="round-action" href="/prospects/import" aria-label="Importer des prospects"><FileUp size={19} /></Link><button className="round-action" type="button" aria-label="Ajouter une entreprise" onClick={() => setShowForm((open) => !open)}><Plus size={20} /></button></div></header>

    {current ? <>
      <div className="deck-stage" tabIndex={0} onKeyDown={handleKey} aria-label="Carte à trier. Flèche gauche pour passer, flèche haute pour analyser, flèche droite pour garder.">
        {playable.slice(1, 3).reverse().map((prospect, index) => <div className={`deck-shadow-card shadow-${index + 1}`} key={prospect.id}><CategoryVisual category={prospect.category} /></div>)}
        <div className={`draggable-card ${drag.dragging ? "dragging" : ""} ${drag.x < -45 ? "toward-pass" : drag.x > 45 ? "toward-keep" : drag.y < -45 ? "toward-analyze" : ""}`} style={cardStyle} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp}>
          <span className="drag-stamp pass-stamp">Passer</span><span className="drag-stamp keep-stamp">Garder</span><span className="drag-stamp analyze-stamp">Terra</span>
          <Link href={`/prospects/${current.id}`} aria-label={`Ouvrir ${current.businessName}`} onClick={(event) => { if (Math.abs(drag.x) > 5 || Math.abs(drag.y) > 5) event.preventDefault(); }}><ProspectGameCard prospect={current} /></Link>
        </div>
      </div>
      <div className="deck-decisions">
        <button className="deck-choice pass" type="button" disabled={busy} onClick={() => void pass(current)}><span><Ban size={25} /></span><strong>Passer</strong><small><ArrowLeft size={12} /> gauche</small></button>
        <button className="deck-choice analyze" type="button" disabled={busy || current.enrichment?.prequalification === "reject"} onClick={() => void analyze(current)}><span><GameAsset name="scanner" size={66} decorative /></span><strong>Analyser</strong><small><ArrowUp size={12} /> haut</small></button>
        <button className="deck-choice keep" type="button" disabled={busy} onClick={() => keep(current)}><span><GameAsset name="deck" size={62} decorative /></span><strong>Garder</strong><small><ArrowRight size={12} /> droite</small></button>
      </div>
      <p className="deck-hint">Glissez la carte ou utilisez les trois boutons</p>
    </> : <Card className="deck-complete"><EmptyState icon={<GameAsset name="deck" size={120} decorative />} title="Toutes les cartes sont triées" description="Lancez un nouveau scan pour découvrir d’autres entreprises." action={<Link className="game-primary-button" href="/scan"><ScanLine size={19} />Scanner une ville</Link>} /></Card>}

    {showForm ? <Card className="quick-add-panel"><h2>Ajouter une carte</h2><form action={submit}><div className="form-grid"><div className="field"><label htmlFor="businessName">Entreprise *</label><input className="input" id="businessName" name="businessName" required /></div><div className="field"><label htmlFor="city">Ville *</label><input className="input" id="city" name="city" required defaultValue={state.campaigns[0]?.city} /></div><div className="field"><label htmlFor="category">Secteur</label><input className="input" id="category" name="category" defaultValue="Restaurant" /></div><div className="field"><label htmlFor="campaignId">Mission</label><select className="select" id="campaignId" name="campaignId">{state.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></div><div className="field"><label htmlFor="phone">Téléphone</label><input className="input" id="phone" name="phone" type="tel" /></div><div className="field"><label htmlFor="email">Email</label><input className="input" id="email" name="email" type="email" /></div><div className="field"><label htmlFor="websiteUrl">Site</label><input className="input" id="websiteUrl" name="websiteUrl" type="url" /></div><div className="field"><label htmlFor="instagramUrl">Instagram</label><input className="input" id="instagramUrl" name="instagramUrl" type="url" /></div><div className="field"><label htmlFor="facebookUrl">Facebook</label><input className="input" id="facebookUrl" name="facebookUrl" type="url" /></div></div><div className="form-actions"><button className="button" type="button" onClick={() => setShowForm(false)}>Annuler</button><button className="button primary" type="submit">Ajouter au deck</button></div></form></Card> : null}

    <details className="deck-library"><summary>Parcourir toutes les cartes <span>{state.prospects.length}</span></summary><div className="deck-library-grid">{state.prospects.map((prospect) => <Link href={`/prospects/${prospect.id}`} className="library-card" key={prospect.id}><CategoryVisual category={prospect.category} /><strong>{prospect.businessName}</strong><span>{prospect.leadScore}/100</span></Link>)}</div></details>
    {feedback ? <div className="game-toast" role="status">{feedback}</div> : null}
  </div>;
}
