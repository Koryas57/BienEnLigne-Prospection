"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Card, PageHeader, Stat } from "@/components/ui";

type Dimension = "city" | "category" | "channel" | "price";

export default function StatsPage() {
  const { state } = useAppStore();
  const [dimension, setDimension] = useState<Dimension>("category");
  const prospects = state.prospects.filter((p) => p.status !== "DO_NOT_CONTACT");
  const contacted = prospects.filter((p) => ["CONTACTED","FOLLOW_UP","REPLIED","INTERESTED","WON","LOST"].includes(p.status)).length;
  const replies = prospects.filter((p) => ["REPLIED","INTERESTED","WON","LOST"].includes(p.status)).length;
  const revenue = state.deals.reduce((sum, deal) => sum + deal.amount, 0);
  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    if (dimension === "channel") state.messages.filter((m) => m.status === "SENT").forEach((m) => counts.set(m.channel, (counts.get(m.channel) ?? 0) + 1));
    else prospects.forEach((prospect) => {
      const campaign = state.campaigns.find((item) => item.id === prospect.campaignId);
      const key = dimension === "city" ? prospect.city : dimension === "price" ? `$${campaign?.price ?? 0}` : prospect.category;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [dimension, prospects, state.campaigns, state.messages]);
  const max = Math.max(1, ...groups.map(([, value]) => value));
  return <>
    <PageHeader eyebrow="Performance" title="Statistiques" description="Comparez la traction par zone, secteur, canal et niveau de prix." />
    <div className="stats-grid">
      <Stat label="Prospects" value={prospects.length} /><Stat label="Qualifiés" value={prospects.filter((p) => p.leadScore >= 55).length} /><Stat label="Contactés" value={contacted} /><Stat label="Réponses" value={replies} tone="green" />
      <Stat label="Taux de réponse" value={contacted ? `${Math.round(replies / contacted * 100)}%` : "0%"} /><Stat label="Conversion" value={contacted ? `${Math.round(state.deals.length / contacted * 100)}%` : "0%"} /><Stat label="Panier moyen" value={state.deals.length ? `$${Math.round(revenue / state.deals.length)}` : "$0"} /><Stat label="CA gagné" value={`$${revenue}`} tone="green" />
    </div>
    <Card className="card-pad section">
      <div className="section-heading"><div><p className="eyebrow">Comparaison</p><h2>Volume par dimension</h2></div><BarChart3 size={20} className="muted" /></div>
      <div className="filter-chip-row">{([['category','Secteur'],['city','Ville'],['channel','Canal'],['price','Prix']] as const).map(([value, text]) => <button key={value} className={`filter-chip ${dimension === value ? "active" : ""}`} onClick={() => setDimension(value)}>{text}</button>)}</div>
      <div className="bar-chart section">{groups.map(([key, value]) => <div className="bar-row" key={key}><span>{key}</span><div className="bar-track"><div className="bar-fill" style={{ width: `${value / max * 100}%` }} /></div><strong>{value}</strong></div>)}{!groups.length ? <p className="muted">Pas encore assez de données pour cette comparaison.</p> : null}</div>
    </Card>
    <div className="grid grid-2 section"><Card className="card-pad"><h2>Pour 100 prospects</h2><div className="detail-list"><div className="detail-row"><span>Ventes estimées</span><strong>{prospects.length ? (state.deals.length / prospects.length * 100).toFixed(1) : "0"}</strong></div><div className="detail-row"><span>CA gagné</span><strong>${prospects.length ? Math.round(revenue / prospects.length * 100) : 0}</strong></div></div></Card><Card className="card-pad"><h2>CA potentiel</h2><p className="muted">Somme des offres associées aux prospects actifs.</p><strong style={{fontSize:"2rem"}}>${prospects.filter((p) => !["WON","LOST"].includes(p.status)).reduce((sum, p) => sum + (state.campaigns.find((c) => c.id === p.campaignId)?.price ?? 0), 0)}</strong></Card></div>
  </>;
}
