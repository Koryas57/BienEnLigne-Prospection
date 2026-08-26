import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AppState, Campaign, Channel, Deal, OutreachMessage, Profile, Prospect,
  ProspectAnalysis, ReplyCategory, UserSettings,
} from "@/lib/types";

type DbRow = Record<string, unknown>;

function fail(error: { message: string } | null, context: string) {
  if (error) throw new Error(`${context}: ${error.message}`);
}

const text = (value: unknown, fallback = "") => typeof value === "string" ? value : fallback;
const optionalText = (value: unknown) => typeof value === "string" && value ? value : undefined;
const number = (value: unknown, fallback = 0) => typeof value === "number" ? value : value == null ? fallback : Number(value);
const knownBoolean = (value: unknown): boolean | "unknown" => typeof value === "boolean" ? value : "unknown";

function mapCampaign(row: DbRow): Campaign {
  return {
    id: text(row.id), name: text(row.name), country: text(row.country), state: text(row.state), city: text(row.city),
    timezone: text(row.timezone), sector: text(row.sector), price: number(row.price), currency: text(row.currency, "USD"),
    status: row.status as Campaign["status"], minReviews: number(row.min_reviews, 30), maxProspects: number(row.max_prospects, 100),
    channels: Array.isArray(row.allowed_channels) ? row.allowed_channels as Channel[] : [], notes: optionalText(row.notes),
  };
}

function mapAnalysis(row: DbRow): ProspectAnalysis {
  const triState = (value: unknown): boolean | "unknown" => value === "true" ? true : value === "false" ? false : "unknown";
  return {
    isRealBusiness: triState(row.is_real_business), independentBusiness: triState(row.independent_business),
    likelyFranchise: triState(row.likely_franchise), digitalPresence: row.digital_presence as ProspectAnalysis["digitalPresence"],
    mainProblem: text(row.main_problem), relevance: text(row.relevance), reasonToContact: text(row.reason_to_contact),
    bestChannel: row.best_channel as ProspectAnalysis["bestChannel"], salesAngle: text(row.sales_angle), demo: Boolean(row.is_demo),
  };
}

function mapProspect(row: DbRow, analysis?: ProspectAnalysis, reply?: DbRow): Prospect {
  return {
    id: text(row.id), campaignId: text(row.campaign_id), businessName: text(row.business_name), contactName: optionalText(row.contact_name),
    category: text(row.category), subcategory: optionalText(row.subcategory), city: text(row.city), state: text(row.state),
    country: text(row.country), timezone: text(row.timezone), address: optionalText(row.address), phone: optionalText(row.phone),
    email: optionalText(row.email), websiteUrl: optionalText(row.website_url), instagramUrl: optionalText(row.instagram_url),
    facebookUrl: optionalText(row.facebook_url), googleMapsUrl: optionalText(row.google_maps_url), rating: row.rating == null ? undefined : number(row.rating),
    reviewCount: row.review_count == null ? undefined : number(row.review_count), notes: optionalText(row.notes), source: text(row.source, "manual"),
    status: row.status as Prospect["status"], leadScore: number(row.lead_score), qualificationReason: text(row.qualification_reason, "À analyser"),
    hasWebsite: knownBoolean(row.has_website), websiteQualityScore: row.website_quality_score == null ? undefined : number(row.website_quality_score),
    websiteMobileFriendly: knownBoolean(row.website_mobile_friendly), websiteHttps: knownBoolean(row.website_https), websiteNotes: optionalText(row.website_notes),
    instagramActive: knownBoolean(row.instagram_active), facebookActive: knownBoolean(row.facebook_active), googlePresence: knownBoolean(row.google_presence),
    socialNotes: optionalText(row.social_notes), independentBusiness: knownBoolean(row.independent_business), likelyFranchise: knownBoolean(row.likely_franchise),
    contactedAt: optionalText(row.contacted_at), nextFollowUpAt: optionalText(row.next_follow_up_at),
    replyCategory: reply?.category as ReplyCategory | undefined, replyText: optionalText(reply?.original_text), analysis,
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

function mapMessage(row: DbRow): OutreachMessage {
  return {
    id: text(row.id), prospectId: text(row.prospect_id), campaignId: text(row.campaign_id), channel: row.channel as Channel,
    kind: row.kind as OutreachMessage["kind"], subject: optionalText(row.subject), body: text(row.body), status: row.status as OutreachMessage["status"],
    scheduledFor: text(row.scheduled_for, text(row.created_at)), recommendedLocalTime: text(row.recommended_local_time, "9:00 AM - 11:00 AM local time"),
    approvedAt: optionalText(row.approved_at), approvedBy: optionalText(row.approved_by), sentAt: optionalText(row.sent_at),
    createdAt: text(row.created_at), updatedAt: text(row.updated_at),
  };
}

function mapDeal(row: DbRow): Deal {
  return { id: text(row.id), prospectId: text(row.prospect_id), amount: number(row.amount), currency: text(row.currency, "USD"), product: text(row.product), paidAmount: number(row.paid_amount), paymentStatus: row.payment_status as Deal["paymentStatus"], wonAt: text(row.won_at) };
}

export async function loadWorkspace(supabase: SupabaseClient, userId: string): Promise<AppState> {
  const readWorkspace = () => Promise.all([
    supabase.from("profiles").select("id, display_name, company_name").eq("id", userId).single(),
    supabase.from("settings").select("follow_up_1_days, follow_up_2_days, default_currency, default_price, scoring_rules").single(),
    supabase.from("campaigns").select("*").order("created_at", { ascending: false }),
    supabase.from("prospects").select("*").order("created_at", { ascending: false }),
    supabase.from("prospect_analyses").select("*").order("created_at", { ascending: false }),
    supabase.from("messages").select("*").order("created_at", { ascending: false }),
    supabase.from("activities").select("*").order("created_at", { ascending: false }),
    supabase.from("replies").select("*").order("created_at", { ascending: false }),
    supabase.from("deals").select("*").order("won_at", { ascending: false }),
  ] as const);
  let results = await readWorkspace();
  if (results.some((result) => result.error?.message.includes("JWT issued at future"))) {
    await new Promise((resolve) => setTimeout(resolve, 2_500));
    results = await readWorkspace();
  }
  const [profileResult, settingsResult, campaignsResult, prospectsResult, analysesResult, messagesResult, activitiesResult, repliesResult, dealsResult] = results;
  fail(profileResult.error, "Chargement du profil"); fail(settingsResult.error, "Chargement des réglages");
  fail(campaignsResult.error, "Chargement des campagnes"); fail(prospectsResult.error, "Chargement des prospects");
  fail(analysesResult.error, "Chargement des analyses"); fail(messagesResult.error, "Chargement des messages");
  fail(activitiesResult.error, "Chargement de l’historique"); fail(repliesResult.error, "Chargement des réponses"); fail(dealsResult.error, "Chargement des ventes");

  const analysisByProspect = new Map<string, ProspectAnalysis>();
  for (const row of (analysesResult.data ?? []) as DbRow[]) if (!analysisByProspect.has(text(row.prospect_id))) analysisByProspect.set(text(row.prospect_id), mapAnalysis(row));
  const replyByProspect = new Map<string, DbRow>();
  for (const row of (repliesResult.data ?? []) as DbRow[]) if (!replyByProspect.has(text(row.prospect_id))) replyByProspect.set(text(row.prospect_id), row);
  const profileRow = profileResult.data as DbRow;
  const settingsRow = settingsResult.data as DbRow;
  const scoringRules = settingsRow.scoring_rules && typeof settingsRow.scoring_rules === "object" ? settingsRow.scoring_rules as Record<string, number> : {};
  return {
    profile: { id: text(profileRow.id), displayName: text(profileRow.display_name, "Utilisateur"), companyName: text(profileRow.company_name, "Bien En Ligne") },
    settings: { followUp1Days: number(settingsRow.follow_up_1_days, 3), followUp2Days: number(settingsRow.follow_up_2_days, 8), defaultCurrency: text(settingsRow.default_currency, "USD"), defaultPrice: number(settingsRow.default_price, 350), scoringRules },
    campaigns: ((campaignsResult.data ?? []) as DbRow[]).map(mapCampaign),
    prospects: ((prospectsResult.data ?? []) as DbRow[]).map((row) => mapProspect(row, analysisByProspect.get(text(row.id)), replyByProspect.get(text(row.id)))),
    messages: ((messagesResult.data ?? []) as DbRow[]).map(mapMessage),
    activities: ((activitiesResult.data ?? []) as DbRow[]).map((row) => ({ id: text(row.id), prospectId: optionalText(row.prospect_id), type: text(row.event_type), label: text(row.label), createdAt: text(row.created_at) })),
    deals: ((dealsResult.data ?? []) as DbRow[]).map(mapDeal),
  };
}

async function currentUserId(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  fail(error, "Vérification de la session");
  if (!data.user) throw new Error("Session expirée. Reconnectez-vous.");
  return data.user.id;
}

async function insertActivity(supabase: SupabaseClient, input: { prospectId?: string; campaignId?: string; messageId?: string; type: string; label: string; metadata?: Record<string, unknown> }) {
  const { error } = await supabase.from("activities").insert({ prospect_id: input.prospectId, campaign_id: input.campaignId, message_id: input.messageId, event_type: input.type, label: input.label, metadata: input.metadata ?? {} });
  fail(error, "Enregistrement de l’historique");
}

export async function createCampaign(supabase: SupabaseClient, campaign: Omit<Campaign, "id">) {
  const { data, error } = await supabase.from("campaigns").insert({ name: campaign.name, country: campaign.country, state: campaign.state, city: campaign.city, timezone: campaign.timezone, sector: campaign.sector, price: campaign.price, currency: campaign.currency, status: campaign.status, min_reviews: campaign.minReviews, max_prospects: campaign.maxProspects, allowed_channels: campaign.channels, notes: campaign.notes || null }).select("id").single();
  fail(error, "Création de la campagne");
  return text((data as DbRow).id);
}

export async function updateCampaign(supabase: SupabaseClient, id: string, updates: Partial<Campaign>) {
  const payload: DbRow = {};
  if (updates.name !== undefined) payload.name = updates.name; if (updates.status !== undefined) payload.status = updates.status;
  if (updates.notes !== undefined) payload.notes = updates.notes; if (updates.price !== undefined) payload.price = updates.price;
  if (updates.channels !== undefined) payload.allowed_channels = updates.channels;
  const { error } = await supabase.from("campaigns").update(payload).eq("id", id); fail(error, "Modification de la campagne");
}

function prospectPayload(prospect: Partial<Prospect>) {
  const payload: DbRow = {};
  const fields: Array<[keyof Prospect, string]> = [
    ["campaignId","campaign_id"],["businessName","business_name"],["contactName","contact_name"],["category","category"],["subcategory","subcategory"],
    ["city","city"],["state","state"],["country","country"],["timezone","timezone"],["address","address"],["phone","phone"],["email","email"],
    ["websiteUrl","website_url"],["instagramUrl","instagram_url"],["facebookUrl","facebook_url"],["googleMapsUrl","google_maps_url"],["rating","rating"],
    ["reviewCount","review_count"],["notes","notes"],["source","source"],["status","status"],["leadScore","lead_score"],["qualificationReason","qualification_reason"],
    ["websiteQualityScore","website_quality_score"],["websiteNotes","website_notes"],["socialNotes","social_notes"],["contactedAt","contacted_at"],["nextFollowUpAt","next_follow_up_at"],
  ];
  for (const [source, target] of fields) if (prospect[source] !== undefined) payload[target] = prospect[source];
  const booleans: Array<[keyof Prospect, string]> = [["hasWebsite","has_website"],["websiteMobileFriendly","website_mobile_friendly"],["websiteHttps","website_https"],["instagramActive","instagram_active"],["facebookActive","facebook_active"],["googlePresence","google_presence"],["independentBusiness","independent_business"],["likelyFranchise","likely_franchise"]];
  for (const [source, target] of booleans) if (prospect[source] !== undefined) payload[target] = prospect[source] === "unknown" ? null : prospect[source];
  return payload;
}

export async function createProspect(supabase: SupabaseClient, prospect: Omit<Prospect, "id" | "createdAt" | "updatedAt">) {
  const { data, error } = await supabase.from("prospects").insert(prospectPayload(prospect)).select("id, campaign_id").single();
  fail(error, "Création du prospect");
  const row = data as DbRow; const id = text(row.id);
  await insertActivity(supabase, { prospectId: id, campaignId: text(row.campaign_id), type: "CREATED", label: "Prospect créé" });
  return id;
}

export async function updateProspect(supabase: SupabaseClient, id: string, updates: Partial<Prospect>) {
  const payload = prospectPayload(updates);
  if (updates.status && ["REPLIED","INTERESTED","WON","LOST","DO_NOT_CONTACT"].includes(updates.status)) payload.next_follow_up_at = null;
  const { error } = await supabase.from("prospects").update(payload).eq("id", id); fail(error, "Modification du prospect");
  const important = updates.status && ["INTERESTED","LOST","DO_NOT_CONTACT"].includes(updates.status);
  await insertActivity(supabase, { prospectId: id, type: important ? updates.status as string : "UPDATED", label: important ? `Statut modifié: ${updates.status}` : "Fiche prospect modifiée" });
}

export async function saveAnalysis(supabase: SupabaseClient, prospect: Prospect, analysis: ProspectAnalysis, score: number, reason: string) {
  const { error: analysisError } = await supabase.from("prospect_analyses").insert({ prospect_id: prospect.id, is_real_business: String(analysis.isRealBusiness), independent_business: String(analysis.independentBusiness), likely_franchise: String(analysis.likelyFranchise), digital_presence: analysis.digitalPresence, main_problem: analysis.mainProblem, relevance: analysis.relevance, reason_to_contact: analysis.reasonToContact, best_channel: analysis.bestChannel, sales_angle: analysis.salesAngle, raw_result: analysis, model: analysis.demo ? null : "openai", is_demo: Boolean(analysis.demo) });
  fail(analysisError, "Enregistrement de l’analyse");
  const status = score >= 55 ? "QUALIFIED" : "ANALYZED";
  const { error } = await supabase.from("prospects").update({ lead_score: score, qualification_reason: reason, status }).eq("id", prospect.id); fail(error, "Mise à jour du score");
  await insertActivity(supabase, { prospectId: prospect.id, campaignId: prospect.campaignId, type: "ANALYZED", label: `Analyse terminée, score ${score}/100`, metadata: { demo: Boolean(analysis.demo) } });
}

export async function createMessage(supabase: SupabaseClient, message: Omit<OutreachMessage, "id" | "createdAt" | "updatedAt">, isDemo: boolean) {
  const { data, error } = await supabase.from("messages").insert({ prospect_id: message.prospectId, campaign_id: message.campaignId, channel: message.channel, kind: message.kind, subject: message.subject || null, body: sanitizeCommercialMessage(message.body), status: "DRAFT", scheduled_for: message.scheduledFor, recommended_local_time: message.recommendedLocalTime }).select("id").single();
  fail(error, "Enregistrement du brouillon");
  const id = text((data as DbRow).id);
  const { error: prospectError } = await supabase.from("prospects").update({ status: "DRAFT_READY" }).eq("id", message.prospectId); fail(prospectError, "Mise à jour du prospect");
  await insertActivity(supabase, { prospectId: message.prospectId, campaignId: message.campaignId, messageId: id, type: "MESSAGE_GENERATED", label: `Brouillon ${message.channel} créé${isDemo ? " (Demo AI result)" : ""}`, metadata: { demo: isDemo } });
  return id;
}

export async function updateMessage(supabase: SupabaseClient, id: string, body: string, subject?: string) {
  const { data: message, error: readError } = await supabase.from("messages").select("prospect_id").eq("id", id).single(); fail(readError, "Lecture du message");
  const { error } = await supabase.from("messages").update({ body: sanitizeCommercialMessage(body), subject: subject || null }).eq("id", id); fail(error, "Modification du message");
  await insertActivity(supabase, { prospectId: text((message as DbRow).prospect_id), messageId: id, type: "MESSAGE_EDITED", label: "Message modifié" });
}

export async function setMessagesStatus(supabase: SupabaseClient, ids: string[], status: "APPROVED" | "REJECTED" | "SNOOZED") {
  if (!ids.length) return;
  const userId = status === "APPROVED" ? await currentUserId(supabase) : undefined;
  const { data: messages, error: readError } = await supabase.from("messages").select("id, prospect_id, campaign_id").in("id", ids); fail(readError, "Lecture de la sélection");
  const payload = status === "APPROVED" ? { status, approved_at: new Date().toISOString(), approved_by: userId } : { status, approved_at: null, approved_by: null };
  const { error } = await supabase.from("messages").update(payload).in("id", ids); fail(error, "Modification des messages");
  const rows = (messages ?? []) as DbRow[];
  if (status === "APPROVED") {
    const prospectIds = [...new Set(rows.map((row) => text(row.prospect_id)))];
    const { error: prospectError } = await supabase.from("prospects").update({ status: "APPROVED" }).in("id", prospectIds); fail(prospectError, "Mise à jour des prospects");
  }
  for (const row of rows) await insertActivity(supabase, { prospectId: text(row.prospect_id), campaignId: text(row.campaign_id), messageId: text(row.id), type: status, label: status === "APPROVED" ? "Message approuvé" : status === "REJECTED" ? "Message refusé" : "Message reporté" });
}

export async function markMessageSent(supabase: SupabaseClient, id: string) {
  const { data, error: readError } = await supabase.from("messages").select("id, prospect_id, campaign_id, channel, status, approved_at, approved_by").eq("id", id).single(); fail(readError, "Lecture du message");
  const message = data as DbRow;
  if (message.status !== "APPROVED" || !message.approved_at || !message.approved_by) throw new Error("Envoi bloqué: le message doit d’abord être explicitement approuvé.");
  const now = new Date();
  const { data: settings, error: settingsError } = await supabase.from("settings").select("follow_up_1_days").single(); fail(settingsError, "Lecture de la cadence");
  const followUp = new Date(now); followUp.setDate(followUp.getDate() + number((settings as DbRow).follow_up_1_days, 3));
  const { error } = await supabase.from("messages").update({ status: "SENT", sent_at: now.toISOString() }).eq("id", id); fail(error, "Marquage du message comme envoyé");
  const { error: prospectError } = await supabase.from("prospects").update({ status: "CONTACTED", contacted_at: now.toISOString(), next_follow_up_at: followUp.toISOString() }).eq("id", text(message.prospect_id)); fail(prospectError, "Mise à jour du prospect contacté");
  await insertActivity(supabase, { prospectId: text(message.prospect_id), campaignId: text(message.campaign_id), messageId: id, type: "CONTACTED", label: `Message ${text(message.channel)} marqué comme envoyé, relance planifiée` });
}

export async function recordReply(supabase: SupabaseClient, prospectId: string, category: ReplyCategory, originalText: string) {
  const { data: prospect, error: readError } = await supabase.from("prospects").select("campaign_id").eq("id", prospectId).single(); fail(readError, "Lecture du prospect");
  const { error } = await supabase.from("replies").insert({ prospect_id: prospectId, category, original_text: originalText }); fail(error, "Enregistrement de la réponse");
  const status = category === "do_not_contact" ? "DO_NOT_CONTACT" : category === "interested" || category === "positive" ? "INTERESTED" : "REPLIED";
  const { error: prospectError } = await supabase.from("prospects").update({ status, next_follow_up_at: null }).eq("id", prospectId); fail(prospectError, "Mise à jour du statut après réponse");
  const { error: followUpError } = await supabase.from("messages").update({ status: "REJECTED" }).eq("prospect_id", prospectId).in("kind", ["FOLLOW_UP_1","FOLLOW_UP_2"]).eq("status", "DRAFT"); fail(followUpError, "Arrêt des relances");
  await insertActivity(supabase, { prospectId, campaignId: text((prospect as DbRow).campaign_id), type: status, label: `Réponse enregistrée: ${category}` });
}

export async function createDeal(supabase: SupabaseClient, prospectId: string, amount: number, paidAmount: number) {
  const { data: prospect, error: readError } = await supabase.from("prospects").select("campaign_id").eq("id", prospectId).single(); fail(readError, "Lecture du prospect");
  const paymentStatus = paidAmount >= amount ? "PAID" : paidAmount > 0 ? "DEPOSIT_PAID" : "PENDING";
  const { error } = await supabase.from("deals").insert({ prospect_id: prospectId, amount, paid_amount: paidAmount, payment_status: paymentStatus, currency: "USD", product: "Site vitrine" }); fail(error, "Enregistrement de la vente");
  const { error: prospectError } = await supabase.from("prospects").update({ status: "WON", next_follow_up_at: null }).eq("id", prospectId); fail(prospectError, "Passage du prospect en gagné");
  await insertActivity(supabase, { prospectId, campaignId: text((prospect as DbRow).campaign_id), type: "WON", label: `Vente enregistrée: $${amount}` });
}

export async function updateProfile(supabase: SupabaseClient, profile: Pick<Profile, "displayName" | "companyName">) {
  const userId = await currentUserId(supabase);
  const { error } = await supabase.from("profiles").update({ display_name: profile.displayName, company_name: profile.companyName }).eq("id", userId); fail(error, "Modification du profil");
}

export async function updateSettings(supabase: SupabaseClient, settings: Partial<UserSettings>) {
  const userId = await currentUserId(supabase);
  const payload: DbRow = {};
  if (settings.followUp1Days !== undefined) payload.follow_up_1_days = settings.followUp1Days;
  if (settings.followUp2Days !== undefined) payload.follow_up_2_days = settings.followUp2Days;
  if (settings.defaultCurrency !== undefined) payload.default_currency = settings.defaultCurrency;
  if (settings.defaultPrice !== undefined) payload.default_price = settings.defaultPrice;
  if (settings.scoringRules !== undefined) payload.scoring_rules = settings.scoringRules;
  const { error } = await supabase.from("settings").update(payload).eq("owner_id", userId); fail(error, "Modification des réglages");
}

export function sanitizeCommercialMessage(value: string) {
  return value.replace(/[—–]/g, "-");
}
