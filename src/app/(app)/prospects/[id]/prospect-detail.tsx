"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bot, Camera, Check, Globe2, Mail, MapPinned, MessageCircle, MessageSquareText, Phone, Save, Trophy } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, EmptyState } from "@/components/ui";
import type { Channel, ProspectStatus, ReplyCategory } from "@/lib/types";
import { messageStatusLabel, prospectStatusLabel } from "@/lib/status-labels";

export function ProspectDetail({ id }: { id: string }) {
  const { state, analyzeProspect, generateMessage, updateProspect, recordReply, markWon } = useAppStore();
  const prospect = state.prospects.find((item) => item.id === id);
  const [tab, setTab] = useState<"summary" | "presence" | "messages" | "history" | "deal">("summary");
  const [replyOpen, setReplyOpen] = useState(false);
  const [dealOpen, setDealOpen] = useState(false);
  const [saved, setSaved] = useState<string>();

  if (!prospect) return <Card><EmptyState title="Prospect introuvable" description="Il a peut-être été supprimé de votre stockage local." action={<Link className="button" href="/prospects">Retour aux prospects</Link>} /></Card>;
  const messages = state.messages.filter((message) => message.prospectId === id);
  const history = state.activities.filter((item) => item.prospectId === id);
  const deal = state.deals.find((item) => item.prospectId === id);
  const availableChannels = (["instagram", "facebook", "email"] as Channel[]).filter((channel) => channel === "instagram" ? prospect.instagramUrl : channel === "facebook" ? prospect.facebookUrl : prospect.email);

  async function generate(channel: Channel) { await generateMessage(id, channel); setSaved(`Brouillon ${channel} créé`); }
  async function saveNotes(formData: FormData) { await updateProspect(id, { notes: String(formData.get("notes")), qualificationReason: String(formData.get("qualificationReason")), status: String(formData.get("status")) as ProspectStatus }); setSaved("Fiche enregistrée"); }
  async function reply(formData: FormData) { await recordReply(id, String(formData.get("category")) as ReplyCategory, String(formData.get("replyText"))); setReplyOpen(false); setSaved("Réponse enregistrée · relances stoppées"); }
  async function win(formData: FormData) { await markWon(id, Number(formData.get("amount")), Number(formData.get("paidAmount"))); setDealOpen(false); setSaved("Vente enregistrée"); }
  const socialLink = (url: string | undefined, icon: React.ReactNode, text: string) => url ? <a className="button" href={url} target="_blank" rel="noreferrer">{icon}{text}</a> : null;

  return <>
    <Link href="/prospects" className="button ghost small-button"><ArrowLeft size={16} />Prospects</Link>
    <Card className="profile-hero section">
      <div><p className="eyebrow">{prospect.city}, {prospect.state}</p><h1>{prospect.businessName}</h1><div className="button-row"><Badge tone={prospect.status === "DO_NOT_CONTACT" ? "red" : prospect.status === "WON" || prospect.status === "INTERESTED" ? "green" : "neutral"}>{prospectStatusLabel(prospect.status)}</Badge><Badge>{prospect.category}</Badge>{prospect.analysis?.demo ? <Badge tone="blue">Demo AI result</Badge> : null}</div></div>
      <div className="score score-large">{prospect.leadScore}<small>/100</small></div>
    </Card>
    <div className="filter-chip-row section">{([['summary','Résumé'],['presence','Présence numérique'],['messages','Messages'],['history','Historique'],['deal','Deal']] as const).map(([value, text]) => <button className={`filter-chip ${tab === value ? "active" : ""}`} key={value} onClick={() => setTab(value)}>{text}</button>)}</div>

    {tab === "summary" ? <div className="grid grid-2 section">
      <Card className="profile-section"><div className="section-heading"><h2>Pourquoi le contacter</h2><button className="button small-button" disabled={prospect.status === "DO_NOT_CONTACT"} onClick={async () => { await analyzeProspect(id); setSaved("Analyse mise à jour"); }}><Bot size={15} />Analyser</button></div><p>{prospect.qualificationReason}</p>{prospect.analysis ? <div className="detail-list"><div className="detail-row"><span>Problème principal</span><strong>{prospect.analysis.mainProblem}</strong></div><div className="detail-row"><span>Meilleur canal</span><strong>{prospect.analysis.bestChannel}</strong></div><div className="detail-row"><span>Angle conseillé</span><strong>{prospect.analysis.salesAngle}</strong></div></div> : <p className="muted">Lancez l’analyse pour obtenir un rapport structuré.</p>}</Card>
      <Card className="profile-section"><h2>Coordonnées</h2><div className="detail-list"><div className="detail-row"><span>Téléphone</span><strong>{prospect.phone ?? "Inconnu"}</strong></div><div className="detail-row"><span>Email</span><strong>{prospect.email ?? "Inconnu"}</strong></div><div className="detail-row"><span>Adresse</span><strong>{prospect.address ?? `${prospect.city}, ${prospect.state}`}</strong></div><div className="detail-row"><span>Source</span><strong>{prospect.source}</strong></div></div></Card>
      <Card className="profile-section"><h2>Notes commerciales</h2><form action={saveNotes}><div className="field"><label htmlFor="status">Statut</label><select className="select" id="status" name="status" defaultValue={prospect.status}>{(["NEW","ANALYZED","QUALIFIED","REJECTED","DRAFT_READY","APPROVED","CONTACTED","FOLLOW_UP","REPLIED","INTERESTED","WON","LOST","DO_NOT_CONTACT"] as const).map((status) => <option value={status} key={status}>{prospectStatusLabel(status)}</option>)}</select></div><div className="field"><label htmlFor="qualificationReason">Justification</label><textarea className="textarea" id="qualificationReason" name="qualificationReason" defaultValue={prospect.qualificationReason} /></div><div className="field"><label htmlFor="notes">Notes</label><textarea className="textarea" id="notes" name="notes" defaultValue={prospect.notes} /></div><div className="form-actions"><button className="button primary" type="submit"><Save size={15} />Enregistrer</button></div></form></Card>
      <Card className="profile-section"><h2>Prochaine action</h2><p className="muted">{prospect.nextFollowUpAt ? `Follow-up prévu le ${new Date(prospect.nextFollowUpAt).toLocaleDateString("fr-FR")}` : prospect.status === "CONTACTED" ? "Aucune relance planifiée" : "Préparer un premier message personnalisé."}</p><div className="button-row">{availableChannels.map((channel) => <button className="button primary" key={channel} disabled={prospect.status === "DO_NOT_CONTACT"} onClick={() => generate(channel)}><MessageSquareText size={15} />Créer {channel}</button>)}</div>{!availableChannels.length ? <p className="form-error">Aucun canal utilisable. Ajoutez un email ou un profil social.</p> : null}</Card>
    </div> : null}

    {tab === "presence" ? <div className="grid grid-2 section">
      <Card className="profile-section"><h2>Site web</h2><div className="detail-list"><div className="detail-row"><span>Site dédié</span><strong>{String(prospect.hasWebsite)}</strong></div><div className="detail-row"><span>Qualité</span><strong>{prospect.websiteQualityScore ?? "unknown"}{prospect.websiteQualityScore ? "/100" : ""}</strong></div><div className="detail-row"><span>Mobile friendly</span><strong>{String(prospect.websiteMobileFriendly)}</strong></div><div className="detail-row"><span>HTTPS</span><strong>{String(prospect.websiteHttps)}</strong></div></div><p className="muted small">{prospect.websiteNotes ?? "Aucune note."}</p></Card>
      <Card className="profile-section"><h2>Présence locale & sociale</h2><div className="detail-list"><div className="detail-row"><span>Google</span><strong>{String(prospect.googlePresence)}</strong></div><div className="detail-row"><span>Instagram actif</span><strong>{String(prospect.instagramActive)}</strong></div><div className="detail-row"><span>Facebook actif</span><strong>{String(prospect.facebookActive)}</strong></div><div className="detail-row"><span>Avis Google</span><strong>{prospect.reviewCount ?? "unknown"} · {prospect.rating ?? "–"}/5</strong></div><div className="detail-row"><span>Entreprise indépendante</span><strong>{String(prospect.independentBusiness)}</strong></div><div className="detail-row"><span>Franchise probable</span><strong>{String(prospect.likelyFranchise)}</strong></div></div></Card>
    </div> : null}

    {tab === "messages" ? <div className="list section">{messages.map((message) => <Card className="profile-section" key={message.id}><div className="section-heading"><div><Badge>{message.channel}</Badge> <Badge tone={message.status === "APPROVED" ? "green" : "neutral"}>{messageStatusLabel(message.status)}</Badge></div><small className="muted">{message.kind.replaceAll("_", " ")}</small></div>{message.subject ? <h3>{message.subject}</h3> : null}<p>{message.body}</p></Card>)}{!messages.length ? <Card><EmptyState title="Aucun message" description="Générez votre premier message depuis l’onglet Résumé." /></Card> : null}</div> : null}

    {tab === "history" ? <Card className="profile-section section"><div className="timeline">{history.map((item) => <div className="timeline-item" key={item.id}><strong>{item.label}</strong><time>{new Date(item.createdAt).toLocaleString("fr-FR")}</time></div>)}</div></Card> : null}

    {tab === "deal" ? <div className="grid grid-2 section"><Card className="profile-section"><div className="section-heading"><h2>Opportunité</h2>{deal ? <Badge tone="green">WON</Badge> : null}</div>{deal ? <div className="detail-list"><div className="detail-row"><span>Montant vendu</span><strong>{deal.amount} {deal.currency}</strong></div><div className="detail-row"><span>Encaissé</span><strong>{deal.paidAmount} {deal.currency}</strong></div><div className="detail-row"><span>Paiement</span><strong>{deal.paymentStatus}</strong></div><div className="detail-row"><span>Produit</span><strong>{deal.product}</strong></div></div> : <><p className="muted">Enregistrez la vente lorsque l’accord est confirmé.</p><button className="button primary" onClick={() => setDealOpen(true)}><Trophy size={16} />Marquer gagné</button></>}</Card></div> : null}

    {replyOpen ? <Card className="profile-section section"><h2>Enregistrer une réponse</h2><form action={reply}><div className="form-grid"><div className="field"><label htmlFor="category">Catégorie</label><select className="select" id="category" name="category">{["positive","interested","question","maybe_later","negative","do_not_contact","unknown"].map((value) => <option key={value}>{value}</option>)}</select></div><div className="field span-2"><label htmlFor="replyText">Réponse originale</label><textarea className="textarea" id="replyText" name="replyText" required /></div></div><div className="form-actions"><button type="button" className="button" onClick={() => setReplyOpen(false)}>Annuler</button><button className="button primary" type="submit"><Check size={15} />Enregistrer</button></div></form></Card> : null}
    {dealOpen ? <Card className="profile-section section"><h2>Enregistrer la vente</h2><form action={win}><div className="form-grid"><div className="field"><label htmlFor="amount">Montant vendu</label><input className="input" id="amount" name="amount" type="number" min="0" defaultValue="350" required /></div><div className="field"><label htmlFor="paidAmount">Montant encaissé</label><input className="input" id="paidAmount" name="paidAmount" type="number" min="0" defaultValue="175" required /></div></div><div className="form-actions"><button type="button" className="button" onClick={() => setDealOpen(false)}>Annuler</button><button className="button primary" type="submit">Confirmer la vente</button></div></form></Card> : null}

    <div className="sticky-actions"><button className="button primary" onClick={() => setReplyOpen((value) => !value)}><MessageSquareText size={16} />Réponse</button>{prospect.phone ? <a className="button" href={`tel:${prospect.phone}`}><Phone size={16} />Appeler</a> : null}{socialLink(prospect.instagramUrl, <Camera size={16} />, "Instagram")}{socialLink(prospect.facebookUrl, <MessageCircle size={16} />, "Facebook")}{socialLink(prospect.websiteUrl, <Globe2 size={16} />, "Site")}{socialLink(prospect.googleMapsUrl, <MapPinned size={16} />, "Maps")}{prospect.email ? <a className="button" href={`mailto:${prospect.email}`}><Mail size={16} />Email</a> : null}</div>
    {saved ? <div className="toast" role="status">{saved}</div> : null}
  </>;
}
