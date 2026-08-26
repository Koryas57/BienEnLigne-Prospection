"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, MapPin, MessageSquareText, RefreshCcw, Send, TrendingUp } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, PageHeader, Stat } from "@/components/ui";

export default function DashboardPage() {
  const { state, mode } = useAppStore();
  const active = state.campaigns.find((campaign) => campaign.status === "ACTIVE") ?? state.campaigns[0];
  const prospects = state.prospects.filter((prospect) => prospect.campaignId === active?.id && prospect.status !== "DO_NOT_CONTACT");
  const pending = state.messages.filter((message) => message.status === "DRAFT");
  const approved = state.messages.filter((message) => message.status === "APPROVED");
  const dueFollowUps = prospects.filter((prospect) => prospect.nextFollowUpAt && new Date(prospect.nextFollowUpAt) <= new Date() && !prospect.replyCategory);
  const replies = prospects.filter((prospect) => prospect.status === "REPLIED" || prospect.status === "INTERESTED");
  const won = prospects.filter((prospect) => prospect.status === "WON");
  const revenue = state.deals.reduce((sum, deal) => sum + deal.amount, 0);
  const channels = state.messages.reduce<Record<string, number>>((counts, message) => ({ ...counts, [message.channel]: (counts[message.channel] ?? 0) + 1 }), {});

  return <>
    <PageHeader eyebrow={mode === "supabase" ? "Supabase connecté" : "Mode démo local"} title={`Bonjour, ${state.profile.displayName}.`} description="Voici ce qui mérite votre attention aujourd’hui." />
    <section className="grid grid-2">
      <div className="hero-cockpit">
        <p className="eyebrow">Prospection US</p>
        <h1>{active?.name ?? "Nouvelle campagne"}</h1>
        <div className="hero-location"><MapPin size={15} />{active ? `${active.city}, ${active.state}` : "Aucune zone"}</div>
        <div className="hero-metrics">
          <div className="hero-metric"><strong>{prospects.length}</strong><span>prospects</span></div>
          <div className="hero-metric"><strong>{prospects.filter((p) => p.leadScore >= 55).length}</strong><span>retenus</span></div>
          <div className="hero-metric"><strong>{pending.length}</strong><span>à examiner</span></div>
        </div>
        <Link className="button accent hero-cta" href="/approval">Examiner les messages <ArrowRight size={17} /></Link>
      </div>
      <Card className="card-pad">
        <div className="section-heading"><div><p className="eyebrow">Ce qui est prévu</p><h2>Aujourd’hui</h2></div><Badge tone="green">{active?.timezone ?? "Local"}</Badge></div>
        <div className="detail-list">
          <div className="detail-row"><span>Premiers contacts</span><strong>{state.messages.filter((m) => m.kind === "FIRST_CONTACT" && m.status !== "SENT").length}</strong></div>
          <div className="detail-row"><span>Relances</span><strong>{dueFollowUps.length}</strong></div>
          <div className="detail-row"><span>Canaux</span><strong>{channels.instagram ?? 0} Instagram · {channels.email ?? 0} email · {channels.facebook ?? 0} Facebook</strong></div>
          <div className="detail-row"><span>Prix</span><strong>${active?.price ?? 350}</strong></div>
          <div className="detail-row"><span>Horaire conseillé</span><strong>9:00 AM – 11:00 AM</strong></div>
        </div>
        {prospects.some((p) => !p.email && !p.instagramUrl && !p.facebookUrl) ? <p className="small muted"><AlertTriangle size={14} /> Certains prospects n’ont aucun canal utilisable.</p> : null}
      </Card>
    </section>

    <section className="section">
      <div className="section-heading"><h2>Vue d’ensemble</h2><span className="small muted">Données locales</span></div>
      <div className="stats-grid">
        <Stat label="Nouveaux prospects" value={prospects.filter((p) => p.status === "NEW").length} helper="à qualifier" />
        <Stat label="Messages en attente" value={pending.length} helper="validation requise" tone="amber" />
        <Stat label="Approuvés" value={approved.length} helper="prêts pour envoi manuel" tone="green" />
        <Stat label="Relances" value={dueFollowUps.length} helper="à préparer" />
        <Stat label="Réponses" value={replies.length} helper="reçues" />
        <Stat label="Intéressés" value={prospects.filter((p) => p.status === "INTERESTED").length} helper="opportunités" tone="green" />
        <Stat label="Ventes" value={won.length} helper="gagnées" />
        <Stat label="CA gagné" value={`$${revenue.toLocaleString("fr-FR")}`} helper="total" tone="green" />
      </div>
    </section>

    <section className="section grid grid-2">
      <Card className="card-pad">
        <div className="section-heading"><h2>Actions du jour</h2><Clock3 size={18} className="muted" /></div>
        <div className="list">
          <Link className="list-card" href="/approval"><div className="list-card-top"><div><h3>Examiner {pending.length} messages</h3><p>Chaque message nécessite une décision explicite.</p></div><MessageSquareText size={20} /></div></Link>
          <Link className="list-card" href="/pipeline"><div className="list-card-top"><div><h3>Suivre {replies.length} réponses</h3><p>Enregistrez la prochaine action commerciale.</p></div><TrendingUp size={20} /></div></Link>
          <Link className="list-card" href="/prospects"><div className="list-card-top"><div><h3>Préparer {dueFollowUps.length} relances</h3><p>J+3, J+8, puis arrêt automatique.</p></div><RefreshCcw size={20} /></div></Link>
        </div>
      </Card>
      <Card className="card-pad">
        <div className="section-heading"><h2>Sécurité d’envoi</h2><CheckCircle2 size={18} color="var(--brand)" /></div>
        <p className="muted">Cette V1 ne peut envoyer aucun email ou DM automatiquement. Le workflow reste volontairement manuel.</p>
        <div className="detail-list">
          <div className="detail-row"><span>Brouillons</span><strong>{pending.length}</strong></div>
          <div className="detail-row"><span>Approuvés explicitement</span><strong>{approved.length}</strong></div>
          <div className="detail-row"><span>Envois manuels tracés</span><strong>{state.messages.filter((m) => m.status === "SENT").length}</strong></div>
        </div>
        <Link href="/approval" className="button primary"><Send size={16} />Ouvrir la file</Link>
      </Card>
    </section>
  </>;
}
