"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Camera, Check, ChevronRight, Globe2, Mail, MapPinned, MessageCircle, MessageSquareText, Phone, Save, Sparkles, Trophy } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { ProspectGameCard } from "@/components/game-ui";
import { Badge, Card, EmptyState } from "@/components/ui";
import type { Channel, ProspectStatus, ReplyCategory } from "@/lib/types";
import { messageStatusLabel, prospectStatusLabel } from "@/lib/status-labels";

const websiteTypeLabel = { dedicated: "Site dédié", link_in_bio: "Page de liens", social_profile: "Profil social", marketplace: "Marketplace", booking_platform: "Plateforme de réservation", unknown: "Inconnu" } as const;

function evidenceValue(value: string | number | boolean | string[]) {
  return Array.isArray(value) ? value.join(", ") : String(value);
}

export function ProspectDetail({ id }: { id: string }) {
  const { state, analyzeProspect, generateMessage, updateProspect, recordReply, markWon, busy } = useAppStore();
  const prospect = state.prospects.find((item) => item.id === id);
  const [tab, setTab] = useState<"card" | "info" | "intel" | "messages" | "history">("card");
  const [replyOpen, setReplyOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [saved, setSaved] = useState<string>();

  if (!prospect) return <Card><EmptyState title="Carte introuvable" description="Cette entreprise n’est plus disponible dans votre deck." action={<Link className="button" href="/prospects">Retour au deck</Link>} /></Card>;

  const messages = state.messages.filter((message) => message.prospectId === id);
  const history = state.activities.filter((item) => item.prospectId === id);
  const deal = state.deals.find((item) => item.prospectId === id);
  const availableChannels = (["instagram", "facebook", "email"] as Channel[]).filter((channel) => channel === "instagram" ? prospect.instagramUrl : channel === "facebook" ? prospect.facebookUrl : prospect.email);
  const manualLowAnalysis = prospect.enrichment?.prequalification === "low" && !prospect.analysis;
  const preferredChannel = prospect.analysis?.bestChannel !== "unknown" && prospect.analysis?.bestChannel && availableChannels.includes(prospect.analysis.bestChannel) ? prospect.analysis.bestChannel : availableChannels[0];

  async function runTerra() {
    const analyzed = await analyzeProspect(id, { forceOpenAI: manualLowAnalysis });
    if (analyzed) setSaved("Terra a terminé l’analyse · +20 XP");
  }
  async function generate(channel: Channel) {
    const messageId = await generateMessage(id, channel);
    if (messageId) { setSaved(`Approche ${channel} préparée`); setTab("messages"); }
  }
  async function saveNotes(formData: FormData) {
    await updateProspect(id, { notes: String(formData.get("notes")), qualificationReason: String(formData.get("qualificationReason")), status: String(formData.get("status")) as ProspectStatus });
    setSaved("Carte enregistrée");
  }
  async function reply(formData: FormData) {
    await recordReply(id, String(formData.get("category")) as ReplyCategory, String(formData.get("replyText")));
    setReplyOpen(false); setSaved("Réponse enregistrée");
  }
  async function win(formData: FormData) {
    await markWon(id, Number(formData.get("amount")), Number(formData.get("paidAmount")));
    setDealOpen(false); setSaved("Victoire enregistrée");
  }

  return <div className="prospect-inspection-page">
    <Link href="/prospects" className="back-to-deck"><ArrowLeft size={18} />Retour au deck</Link>
    <div className="inspection-tabs" role="tablist" aria-label="Sections de la carte">{([['card','Carte'],['info','Infos'],['intel','Intel'],['messages','Approches'],['history','Parcours']] as const).map(([value, label]) => <button role="tab" aria-selected={tab === value} className={tab === value ? "active" : ""} type="button" key={value} onClick={() => setTab(value)}>{label}</button>)}</div>

    {tab === "card" ? <section className="card-inspection-layout">
      <ProspectGameCard prospect={prospect} className="inspection-main-card" />
      <article className="approach-panel">
        <div className="approach-status"><Badge tone={prospect.status === "DO_NOT_CONTACT" ? "red" : prospect.status === "INTERESTED" || prospect.status === "WON" ? "green" : "neutral"}>{prospectStatusLabel(prospect.status)}</Badge>{prospect.analysis?.demo ? <Badge tone="blue">Résultat démo</Badge> : null}</div>
        <span className="soft-label">Pourquoi cette cible ?</span><h1>{prospect.analysis?.mainProblem || prospect.qualificationReason}</h1>
        {prospect.analysis ? <div className="terra-result"><div><span>Angle</span><strong>{prospect.analysis.salesAngle}</strong></div><div><span>Canal</span><strong>{prospect.analysis.bestChannel}</strong></div><div><span>Potentiel</span><strong>{prospect.analysis.relevance}</strong></div></div> : <p className="approach-empty">Terra peut résumer la faiblesse principale, le meilleur canal et l’angle d’approche.</p>}
        <button className="terra-button" type="button" disabled={busy || prospect.status === "DO_NOT_CONTACT" || prospect.enrichment?.prequalification === "reject"} onClick={() => void runTerra()}><span><Bot size={21} /></span>{prospect.analysis ? "Analyser à nouveau avec Terra" : "Analyser avec Terra"}<Sparkles size={17} /></button>
        {preferredChannel ? <button className="game-primary-button prepare-approach" type="button" disabled={busy || prospect.status === "DO_NOT_CONTACT"} onClick={() => void generate(preferredChannel)}>Préparer l’approche<ChevronRight size={20} /></button> : <p className="form-error">Ajoutez un canal de contact dans Infos.</p>}
      </article>
    </section> : null}

    {tab === "info" ? <section className="info-layout"><Card className="info-card"><h2>Coordonnées</h2><div className="contact-buttons">{prospect.phone ? <a href={`tel:${prospect.phone}`}><Phone size={19} /><span>Téléphone</span><strong>{prospect.phone}</strong></a> : null}{prospect.email ? <a href={`mailto:${prospect.email}`}><Mail size={19} /><span>Email</span><strong>{prospect.email}</strong></a> : null}{prospect.instagramUrl ? <a href={prospect.instagramUrl} target="_blank" rel="noreferrer"><Camera size={19} /><span>Instagram</span><strong>Ouvrir</strong></a> : null}{prospect.facebookUrl ? <a href={prospect.facebookUrl} target="_blank" rel="noreferrer"><MessageCircle size={19} /><span>Facebook</span><strong>Ouvrir</strong></a> : null}{prospect.googleMapsUrl ? <a href={prospect.googleMapsUrl} target="_blank" rel="noreferrer"><MapPinned size={19} /><span>Localisation</span><strong>Ouvrir</strong></a> : null}{prospect.websiteUrl ? <a href={prospect.websiteUrl} target="_blank" rel="noreferrer"><Globe2 size={19} /><span>URL trouvée</span><strong>Ouvrir</strong></a> : null}</div><p className="address-line">{prospect.address ?? `${prospect.city}, ${prospect.state}`}</p></Card><Card className="info-card"><h2>Notes</h2><form action={saveNotes}><div className="field"><label htmlFor="status">Statut</label><select className="select" id="status" name="status" defaultValue={prospect.status}>{(["NEW","ANALYZED","QUALIFIED","REJECTED","DRAFT_READY","APPROVED","CONTACTED","FOLLOW_UP","REPLIED","INTERESTED","WON","LOST","DO_NOT_CONTACT"] as const).map((status) => <option value={status} key={status}>{prospectStatusLabel(status)}</option>)}</select></div><div className="field"><label htmlFor="qualificationReason">Pourquoi cette cible ?</label><textarea className="textarea" id="qualificationReason" name="qualificationReason" defaultValue={prospect.qualificationReason} /></div><div className="field"><label htmlFor="notes">Notes personnelles</label><textarea className="textarea" id="notes" name="notes" defaultValue={prospect.notes} /></div><div className="form-actions"><button className="button primary" type="submit"><Save size={16} />Enregistrer</button></div></form></Card></section> : null}

    {tab === "intel" ? <section className="intel-layout"><Card className="intel-summary-card"><h2>Présence en ligne</h2><div className="intel-facts"><div><span>Site</span><strong>{prospect.websiteType ? websiteTypeLabel[prospect.websiteType] : "Inconnu"}</strong></div><div><span>Site dédié</span><strong>{prospect.hasWebsite === true ? "Oui" : prospect.hasWebsite === false ? "Non" : "Inconnu"}</strong></div><div><span>Avis</span><strong>{prospect.reviewCount !== undefined ? `${prospect.reviewCount}${prospect.rating !== undefined ? ` · ${prospect.rating}/5` : ""}` : "Inconnus"}</strong></div><div><span>Entreprise indépendante</span><strong>{prospect.independentBusiness === true ? "Probable" : prospect.independentBusiness === false ? "Non" : "Inconnu"}</strong></div></div></Card><Card className="intel-summary-card"><h2>Détail du score</h2>{prospect.scoreBreakdown?.length ? <div className="score-lines">{prospect.scoreBreakdown.map((rule) => <div key={rule.code}><span>{rule.label}</span><strong>{rule.points > 0 ? "+" : ""}{rule.points}</strong></div>)}</div> : <p className="muted">Aucun signal suffisamment établi pour détailler le score.</p>}</Card><Card className="technical-drawer"><details><summary>Détails techniques</summary>{prospect.enrichment ? <><div className="detail-list">{prospect.enrichment.providers.map((provider) => <div className="detail-row" key={provider.provider}><span>{provider.provider}</span><strong>{provider.status}{provider.cached ? " · cache" : ""}</strong></div>)}</div><div className="technical-evidence">{prospect.enrichment.evidence.filter((item) => item.source.kind !== "manual").slice(0, 20).map((item, index) => <div key={`${item.source.provider}-${item.field}-${index}`}><span>{item.field} · {item.source.label}</span><strong>{evidenceValue(item.value)}</strong></div>)}</div></> : <p className="muted">Aucun enrichissement enregistré.</p>}</details></Card></section> : null}

    {tab === "messages" ? <section className="approaches-list">{messages.map((message) => <Card className="approach-message" key={message.id}><div><Badge>{message.channel}</Badge><Badge tone={message.status === "APPROVED" ? "green" : "neutral"}>{messageStatusLabel(message.status)}</Badge></div>{message.subject ? <h3>{message.subject}</h3> : null}<p>{message.body}</p></Card>)}{!messages.length ? <Card><EmptyState title="Aucune approche préparée" description="Revenez sur la Carte pour préparer un premier message." /></Card> : null}</section> : null}

    {tab === "history" ? <section className="history-layout"><Card className="history-card"><div className="section-heading"><h2>Parcours</h2><button className="button" type="button" onClick={() => setReplyOpen((open) => !open)}><MessageSquareText size={16} />Enregistrer une réponse</button></div><div className="timeline">{history.map((item) => <div className="timeline-item" key={item.id}><strong>{item.label}</strong><time>{new Date(item.createdAt).toLocaleString("fr-FR")}</time></div>)}</div></Card><Card className="history-card"><div className="section-heading"><h2>Victoire</h2>{deal ? <Badge tone="green">Gagnée</Badge> : null}</div>{deal ? <div className="detail-list"><div className="detail-row"><span>Montant</span><strong>{deal.amount} {deal.currency}</strong></div><div className="detail-row"><span>Encaissé</span><strong>{deal.paidAmount} {deal.currency}</strong></div></div> : <button className="game-primary-button" type="button" onClick={() => setDealOpen(true)}><Trophy size={18} />Marquer gagnée</button>}</Card></section> : null}

    {replyOpen ? <Card className="inline-dialog"><h2>Enregistrer une réponse</h2><form action={reply}><div className="field"><label htmlFor="category">Catégorie</label><select className="select" id="category" name="category">{["positive","interested","question","maybe_later","negative","do_not_contact","unknown"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="field"><label htmlFor="replyText">Réponse originale</label><textarea className="textarea" id="replyText" name="replyText" required /></div><div className="form-actions"><button type="button" className="button" onClick={() => setReplyOpen(false)}>Annuler</button><button className="button primary" type="submit"><Check size={16} />Enregistrer</button></div></form></Card> : null}
    {dealOpen ? <Card className="inline-dialog"><h2>Enregistrer la victoire</h2><form action={win}><div className="form-grid"><div className="field"><label htmlFor="amount">Montant vendu</label><input className="input" id="amount" name="amount" type="number" min="0" defaultValue="350" required /></div><div className="field"><label htmlFor="paidAmount">Montant encaissé</label><input className="input" id="paidAmount" name="paidAmount" type="number" min="0" defaultValue="175" required /></div></div><div className="form-actions"><button type="button" className="button" onClick={() => setDealOpen(false)}>Annuler</button><button className="button primary" type="submit">Confirmer</button></div></form></Card> : null}
    {saved ? <div className="game-toast" role="status">{saved}</div> : null}
  </div>;
}
