"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, Clipboard, ExternalLink, Mail, Pencil, Send, X } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import type { OutreachMessage } from "@/lib/types";
import { messageStatusLabel } from "@/lib/status-labels";

type Tab = "pending" | "approved" | "sent";

export default function ApprovalPage() {
  const { state, updateMessage, setMessageStatus, markSent } = useAppStore();
  const [tab, setTab] = useState<Tab>("pending");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string>();
  const [drafts, setDrafts] = useState<Record<string, { subject?: string; body: string }>>({});
  const [copied, setCopied] = useState<string>();

  const messages = useMemo(() => state.messages.filter((message) => tab === "pending" ? message.status === "DRAFT" : tab === "approved" ? message.status === "APPROVED" : message.status === "SENT"), [state.messages, tab]);
  const toggle = (id: string) => setSelected((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const act = async (status: "APPROVED" | "REJECTED" | "SNOOZED", ids = [...selected]) => { await setMessageStatus(ids, status); setSelected(new Set()); };
  const toggleEditing = async (message: OutreachMessage) => {
    if (editing === message.id) {
      const draft = drafts[message.id];
      if (draft) await updateMessage(message.id, draft.body, draft.subject);
      setEditing(undefined);
      return;
    }
    setDrafts((current) => ({ ...current, [message.id]: { body: message.body, subject: message.subject } }));
    setEditing(message.id);
  };
  const copy = async (message: OutreachMessage, subject = false) => { await navigator.clipboard.writeText(subject ? message.subject ?? "" : message.body); setCopied(subject ? `${message.id}-subject` : message.id); window.setTimeout(() => setCopied(undefined), 1800); };
  const selectAll = () => setSelected(selected.size === messages.length ? new Set() : new Set(messages.map((message) => message.id)));

  return <>
    <PageHeader eyebrow="Contrôle humain obligatoire" title="File de validation" description="Aucun message ne peut être envoyé ou marqué comme envoyé avant une approbation explicite." />
    <div className="filter-chip-row">
      <button className={`filter-chip ${tab === "pending" ? "active" : ""}`} onClick={() => { setTab("pending"); setSelected(new Set()); }}>À examiner ({state.messages.filter((m) => m.status === "DRAFT").length})</button>
      <button className={`filter-chip ${tab === "approved" ? "active" : ""}`} onClick={() => { setTab("approved"); setSelected(new Set()); }}>Approuvés ({state.messages.filter((m) => m.status === "APPROVED").length})</button>
      <button className={`filter-chip ${tab === "sent" ? "active" : ""}`} onClick={() => { setTab("sent"); setSelected(new Set()); }}>Envoyés ({state.messages.filter((m) => m.status === "SENT").length})</button>
    </div>
    {tab === "pending" && messages.length ? <div className="bulk-bar">
      <label className="small"><input className="check" type="checkbox" checked={selected.size === messages.length} onChange={selectAll} /> {selected.size ? `${selected.size} sélectionné(s)` : "Tout sélectionner"}</label>
      <div className="button-row"><button className="button small-button" disabled={!selected.size} onClick={() => void act("SNOOZED")}><CalendarClock size={15} />Reporter</button><button className="button small-button danger" disabled={!selected.size} onClick={() => void act("REJECTED")}><X size={15} />Refuser</button><button className="button small-button primary" disabled={!selected.size} onClick={() => void act("APPROVED")}><Check size={15} />Approuver la sélection</button></div>
    </div> : null}
    <div className="list section">
      {messages.map((message) => {
        const prospect = state.prospects.find((item) => item.id === message.prospectId);
        const campaign = state.campaigns.find((item) => item.id === message.campaignId);
        if (!prospect) return null;
        const channelUrl = message.channel === "instagram" ? prospect.instagramUrl : message.channel === "facebook" ? prospect.facebookUrl : prospect.email ? `mailto:${prospect.email}` : undefined;
        return <Card className={`approval-card ${selected.has(message.id) ? "selected" : ""}`} key={message.id}>
          <div className="approval-head">
            {tab === "pending" ? <input className="check" type="checkbox" checked={selected.has(message.id)} onChange={() => toggle(message.id)} aria-label={`Sélectionner ${prospect.businessName}`} /> : null}
            <div className="approval-head-main"><div className="list-card-top"><div><h3>{prospect.businessName}</h3><p className="muted small">{prospect.category} · {prospect.city}, {prospect.state}</p></div><span className="score">{prospect.leadScore}</span></div><div className="list-card-meta"><Badge tone={message.status === "APPROVED" ? "green" : message.status === "SENT" ? "blue" : "amber"}>{messageStatusLabel(message.status)}</Badge><Badge>{message.channel}</Badge><Badge>{message.kind.replaceAll("_", " ")}</Badge></div></div>
          </div>
          <div className="approval-message">
            <p className="eyebrow">Pourquoi cette cible</p><p className="small">{prospect.qualificationReason}</p>
            {message.subject ? <div className="field"><label>Objet</label><input className="input" value={drafts[message.id]?.subject ?? message.subject} readOnly={editing !== message.id} onChange={(event) => setDrafts((current) => ({ ...current, [message.id]: { body: current[message.id]?.body ?? message.body, subject: event.target.value } }))} /></div> : null}
            <div className="field"><label>Message complet</label><textarea className="textarea" value={drafts[message.id]?.body ?? message.body} readOnly={editing !== message.id} onChange={(event) => setDrafts((current) => ({ ...current, [message.id]: { subject: current[message.id]?.subject ?? message.subject, body: event.target.value } }))} /></div>
            <div className="detail-list"><div className="detail-row"><span>Campagne / prix</span><strong>{campaign?.name} · ${campaign?.price}</strong></div><div className="detail-row"><span>Horaire local conseillé</span><strong>{message.recommendedLocalTime}</strong></div></div>
            <div className="button-row">
              <Link className="button small-button" href={`/prospects/${prospect.id}`}>Voir le prospect</Link>
              {tab !== "sent" ? <button className="button small-button" onClick={() => void toggleEditing(message)}><Pencil size={14} />{editing === message.id ? "Enregistrer" : "Modifier"}</button> : null}
            </div>
          </div>
          {tab === "pending" ? <div className="approval-actions"><button className="button danger" onClick={() => void act("REJECTED", [message.id])}><X size={15} />Refuser</button><button className="button" onClick={() => void act("SNOOZED", [message.id])}><CalendarClock size={15} />Reporter</button><button className="button primary" onClick={() => void act("APPROVED", [message.id])}><Check size={15} />Approuver</button></div> : null}
          {tab === "approved" ? <div className="approval-actions">
            {message.subject ? <button className="button" onClick={() => copy(message, true)}><Mail size={15} />{copied === `${message.id}-subject` ? "Copié" : "Objet"}</button> : <button className="button" onClick={() => copy(message)}><Clipboard size={15} />{copied === message.id ? "Copié" : "Copier"}</button>}
            {message.subject ? <button className="button" onClick={() => copy(message)}><Clipboard size={15} />{copied === message.id ? "Copié" : "Email"}</button> : channelUrl ? <a className="button" href={channelUrl} target="_blank" rel="noreferrer"><ExternalLink size={15} />Ouvrir</a> : <button className="button" disabled>Pas de profil</button>}
            <button className="button primary" onClick={() => void markSent(message.id)}><Send size={15} />Marquer envoyé</button>
          </div> : null}
        </Card>;
      })}
      {!messages.length ? <Card><EmptyState icon={<Check size={28} />} title={tab === "pending" ? "Tout est examiné" : "Aucun message ici"} description={tab === "pending" ? "La file est vide. Générez un message depuis une fiche prospect." : "Les messages apparaîtront ici au fil du workflow."} /></Card> : null}
    </div>
    {copied ? <div className="toast" role="status">Copié dans le presse-papiers.</div> : null}
  </>;
}
