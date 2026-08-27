"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronLeft, ChevronRight, MapPin, ScanLine } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { GameAsset } from "@/components/game-asset";
import { CategoryVisual } from "@/components/game-ui";
import type { DiscoveredProspect } from "@/lib/enrichment/contracts";

type DiscoveryPayload = { data?: { results: DiscoveredProspect[] }; error?: { message?: string } };
type Phase = "choose" | "scanning" | "complete" | "preview";

export default function ScanPage() {
  const { state, mode } = useAppStore();
  const defaultMission = state.campaigns.find((campaign) => campaign.status === "ACTIVE") ?? state.campaigns[0];
  const [campaignId, setCampaignId] = useState(defaultMission?.id ?? "");
  const [phase, setPhase] = useState<Phase>("choose");
  const [results, setResults] = useState<DiscoveredProspect[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [error, setError] = useState<string>();
  const mission = state.campaigns.find((campaign) => campaign.id === campaignId);
  const preview = results[previewIndex];

  async function scan() {
    if (!mission || mode !== "supabase") return;
    setError(undefined);
    setPhase("scanning");
    try {
      const response = await fetch("/api/discovery", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: mission.city, state: mission.state, country: mission.country, sector: mission.sector, limit: Math.min(20, mission.maxProspects) }) });
      const payload = await response.json().catch(() => null) as DiscoveryPayload | null;
      if (!response.ok) throw new Error(payload?.error?.message || "Le scan n’a pas pu se terminer.");
      setResults(payload?.data?.results ?? []);
      setPreviewIndex(0);
      setPhase("complete");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Le scan n’a pas pu se terminer.");
      setPhase("choose");
    }
  }

  if (phase === "scanning") return <div className="scan-page scan-running" role="status" aria-live="polite">
    <div className="scan-animation" aria-hidden="true"><span className="scan-wave" /><span className="scan-wave scan-wave-inner" /><span className="scan-dot dot-one" /><span className="scan-dot dot-two" /><span className="scan-dot dot-three" /><GameAsset name="scanner" size={250} className="scanner-active-asset" decorative priority /></div>
    <span>Scan en cours</span><h1>{mission?.city}</h1><p>Nous cherchons les entreprises qui correspondent à votre mission.</p>
  </div>;

  if (phase === "complete") return <div className="scan-page scan-result">
    <div className="result-sparkles" aria-hidden="true"><GameAsset name="scanner" size={94} decorative /><span /><span /></div>
    <span>Scan terminé</span><h1>{results.length} nouvelle{results.length > 1 ? "s" : ""} cible{results.length > 1 ? "s" : ""}</h1><p>{mission?.city} · {mission?.sector}</p>
    <div className="found-deck" aria-hidden="true"><GameAsset name="deck" size={225} className="found-deck-asset" decorative />{results.slice(0, 3).map((result, index) => <div key={result.providerPlaceId} style={{ "--card-index": index } as React.CSSProperties}><CategoryVisual category={result.category} /></div>)}</div>
    {results.length ? <button className="game-primary-button" type="button" onClick={() => setPhase("preview")}>Voir les cartes <ArrowRight size={20} /></button> : <button className="game-primary-button" type="button" onClick={() => setPhase("choose")}>Nouvelle recherche</button>}
  </div>;

  if (phase === "preview" && preview) return <div className="scan-page scan-preview">
    <div className="scan-preview-top"><button className="round-action" type="button" aria-label="Quitter l’aperçu" onClick={() => setPhase("complete")}><ChevronLeft size={21} /></button><span>{previewIndex + 1} / {results.length}</span></div>
    <article className="discovered-card"><span className="discovery-new">Nouvelle découverte</span><CategoryVisual category={preview.category} /><div><h1>{preview.businessName}</h1><p>{preview.category}</p><strong><MapPin size={16} />{preview.city || mission?.city}{preview.state ? `, ${preview.state}` : ""}</strong><div className="discovered-facts">{preview.websiteUrl ? <span>Site trouvé</span> : null}{preview.phone ? <span>Téléphone</span> : null}{preview.email ? <span>Email</span> : null}{preview.brandSignalLabel ? <span>{preview.brandSignalLabel}</span> : null}</div></div></article>
    <div className="preview-navigation"><button className="button" type="button" disabled={previewIndex === 0} onClick={() => setPreviewIndex((index) => Math.max(0, index - 1))}><ChevronLeft size={18} />Précédente</button>{previewIndex < results.length - 1 ? <button className="game-primary-button" type="button" onClick={() => setPreviewIndex((index) => index + 1)}>Suivante<ChevronRight size={18} /></button> : <Link className="game-primary-button" href="/prospects"><Check size={18} />Retour au deck</Link>}</div>
    <p className="scan-disclaimer">Aperçu uniquement : aucune carte n’est ajoutée automatiquement.</p>
  </div>;

  return <div className="scan-page scan-choose">
    <div className="scan-intro"><GameAsset name="scanner" size={270} className="scan-hero-asset" priority alt="Scanner 3D prêt à découvrir des entreprises" /><span>Scanner</span><h1>Choisissez une mission</h1><p>Découvrez de nouvelles entreprises locales en une seule action.</p></div>
    <div className="mission-picker">{state.campaigns.map((campaign) => <button className={`mission-pick ${campaign.id === campaignId ? "selected" : ""}`} type="button" key={campaign.id} onClick={() => setCampaignId(campaign.id)}><span className="mission-pick-check">{campaign.id === campaignId ? <Check size={17} /> : null}</span><div><strong>{campaign.city}</strong><span>{campaign.sector}</span><small><MapPin size={13} />{campaign.state}, {campaign.country}</small></div></button>)}</div>
    {mode === "demo" ? <p className="scan-availability">Le scan réel sera disponible dans votre espace connecté.</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <button className="game-primary-button scan-launch" type="button" disabled={!mission || mode !== "supabase"} onClick={() => void scan()}><ScanLine size={21} />Lancer le scan</button>
    {!state.campaigns.length ? <Link className="button" href="/campaigns">Créer une mission</Link> : null}
  </div>;
}
