"use client";

import Link from "next/link";
import { useAppStore } from "@/components/app-store";
import { Badge, PageHeader, Stat } from "@/components/ui";
import type { Prospect, ProspectStatus } from "@/lib/types";

const columns: Array<{ title: string; statuses: ProspectStatus[] }> = [
  { title: "À contacter", statuses: ["NEW", "ANALYZED", "QUALIFIED", "DRAFT_READY", "APPROVED"] },
  { title: "Contacté", statuses: ["CONTACTED", "FOLLOW_UP"] },
  { title: "Répondu", statuses: ["REPLIED"] },
  { title: "Intéressé", statuses: ["INTERESTED"] },
  { title: "Gagné / perdu", statuses: ["WON", "LOST"] },
];

export default function PipelinePage() {
  const { state } = useAppStore();
  const potential = state.prospects.filter((p) => !["WON", "LOST", "DO_NOT_CONTACT"].includes(p.status)).reduce((sum, prospect) => sum + (state.campaigns.find((c) => c.id === prospect.campaignId)?.price ?? 0), 0);
  const won = state.deals.reduce((sum, deal) => sum + deal.amount, 0);
  return <>
    <PageHeader eyebrow="Vue commerciale" title="Pipeline" description="Faites glisser mentalement les opportunités d’une étape à la suivante — les changements se font depuis chaque fiche." />
    <div className="stats-grid"><Stat label="Opportunités actives" value={state.prospects.filter((p) => !["WON","LOST","DO_NOT_CONTACT"].includes(p.status)).length} /><Stat label="CA potentiel" value={`$${potential}`} tone="amber" /><Stat label="Ventes" value={state.deals.length} /><Stat label="CA gagné" value={`$${won}`} tone="green" /></div>
    <div className="pipeline-grid section">{columns.map((column) => {
      const prospects = state.prospects.filter((prospect) => column.statuses.includes(prospect.status));
      return <section className="pipeline-column" key={column.title}><div className="pipeline-header"><h2>{column.title}</h2><Badge>{prospects.length}</Badge></div>{prospects.map((prospect: Prospect) => <Link className="pipeline-card" href={`/prospects/${prospect.id}`} key={prospect.id}><div className="list-card-top"><div><h3>{prospect.businessName}</h3><p className="small muted">{prospect.category} · {prospect.city}</p></div><strong>{prospect.leadScore}</strong></div><div className="list-card-meta"><Badge tone={prospect.status === "WON" ? "green" : prospect.status === "LOST" ? "red" : "neutral"}>{prospect.status}</Badge><span className="small muted">${state.campaigns.find((c) => c.id === prospect.campaignId)?.price ?? 0}</span></div></Link>)}</section>;
    })}</div>
  </>;
}
