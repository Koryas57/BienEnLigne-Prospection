"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { initialState } from "@/lib/demo-data";
import { requestAI } from "@/lib/ai/client";
import { resolveAIRequest } from "@/lib/ai/contracts";
import { scoreProspect } from "@/lib/scoring";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  createCampaign as createCampaignRow, createDeal, createMessage as createMessageRow, createProspect as createProspectRow,
  loadWorkspace, markMessageSent, recordReply as createReply, saveAnalysis, setMessagesStatus,
  updateCampaign as updateCampaignRow, updateMessage as updateMessageRow, updateProfile as updateProfileRow,
  updateProspect as updateProspectRow, updateSettings as updateSettingsRow, sanitizeCommercialMessage,
} from "@/lib/data/supabase-repository";
import type { AppState, Campaign, Channel, DataMode, Deal, OutreachMessage, Profile, Prospect, ProspectAnalysis, ReplyCategory, UserSettings } from "@/lib/types";

const STORAGE_KEY = "bienenligne-prospection-v1";
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface StoreValue {
  state: AppState; mode: DataMode; hydrated: boolean; busy: boolean; error?: string; clearError: () => void;
  addCampaign: (campaign: Omit<Campaign, "id">) => Promise<string | undefined>;
  updateCampaign: (id: string, updates: Partial<Campaign>) => Promise<void>;
  addProspect: (prospect: Omit<Prospect, "id" | "createdAt" | "updatedAt">) => Promise<string | undefined>;
  updateProspect: (id: string, updates: Partial<Prospect>) => Promise<void>;
  analyzeProspect: (id: string) => Promise<boolean | undefined>;
  generateMessage: (prospectId: string, channel: Channel, kind?: OutreachMessage["kind"]) => Promise<string | undefined>;
  updateMessage: (id: string, body: string, subject?: string) => Promise<void>;
  setMessageStatus: (ids: string[], status: "APPROVED" | "REJECTED" | "SNOOZED") => Promise<void>;
  markSent: (id: string) => Promise<void>;
  recordReply: (prospectId: string, category: ReplyCategory, text: string) => Promise<void>;
  markWon: (prospectId: string, amount: number, paidAmount: number) => Promise<void>;
  updateProfile: (profile: Pick<Profile, "displayName" | "companyName">) => Promise<void>;
  updateSettings: (settings: Partial<UserSettings>) => Promise<void>;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function localActivity(prospectId: string | undefined, type: string, label: string) {
  return { id: uid("activity"), prospectId, type, label, createdAt: new Date().toISOString() };
}

function fallbackAnalysis(prospect: Prospect): { analysis: ProspectAnalysis; score: number; reason: string } {
  const computed = scoreProspect(prospect);
  const bestChannel = prospect.instagramUrl ? "instagram" : prospect.facebookUrl ? "facebook" : prospect.email ? "email" : "unknown";
  return {
    score: computed.score,
    reason: prospect.qualificationReason && prospect.qualificationReason !== "À analyser" ? prospect.qualificationReason : computed.reason,
    analysis: {
      isRealBusiness: prospect.googlePresence === true ? true : "unknown", independentBusiness: prospect.independentBusiness,
      likelyFranchise: prospect.likelyFranchise, digitalPresence: prospect.googlePresence === true || prospect.instagramActive === true ? "average" : "weak",
      mainProblem: prospect.hasWebsite === false ? "No dedicated website identified." : "The current digital journey may be unclear on mobile.",
      relevance: computed.score >= 70 ? "High" : computed.score >= 50 ? "Medium" : "Low",
      reasonToContact: prospect.hasWebsite === false ? "A focused site could centralize the essentials customers need." : "A clearer mobile experience could turn local interest into enquiries.",
      bestChannel, salesAngle: "Keep the offer concrete, local and focused on one visible digital gap.", demo: true,
    },
  };
}

function fallbackMessage(prospect: Prospect, campaign: Campaign | undefined, channel: Channel, kind: OutreachMessage["kind"]) {
  const cityContext = prospect.city.toLowerCase() === "little rock"
    ? "I have a friend who lives in Little Rock, and while we were discussing local businesses and website prices, I came across your business. "
    : `I came across ${prospect.businessName} while looking at local ${prospect.category.toLowerCase()} businesses in ${prospect.city}. `;
  const observed = prospect.hasWebsite === false
    ? "I noticed your strong local presence, but I couldn't find a dedicated website bringing the essentials together. "
    : "I noticed the current online experience could make the essentials easier to find on a phone. ";
  const first = `Hi ${prospect.businessName} team - ${cityContext}${observed}I'm currently offering an introductory $${campaign?.price ?? 350} price to a few small businesses in the US, and I'd be happy to show you a simple idea tailored to your business. Would that be useful?`;
  const followUp = `Hi again - just following up on the website idea I sent for ${prospect.businessName}. I'd be glad to sketch a simple direction around ${prospect.analysis?.mainProblem.toLowerCase() ?? "making the mobile experience clearer"}. No rush at all; should I send it over?`;
  return { subject: channel === "email" ? `A website idea for ${prospect.businessName}` : undefined, body: sanitizeCommercialMessage(kind === "FIRST_CONTACT" ? first : followUp) };
}

export function AppStoreProvider({ children, initialData, mode, userId }: { children: React.ReactNode; initialData: AppState; mode: DataMode; userId?: string }) {
  const [state, setState] = useState<AppState>(initialData);
  const [hydrated, setHydrated] = useState(mode === "supabase");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const supabase = useMemo(() => mode === "supabase" ? createSupabaseBrowserClient() : null, [mode]);

  useEffect(() => {
    if (mode !== "demo") return;
    queueMicrotask(() => {
      try { const saved = window.localStorage.getItem(STORAGE_KEY); if (saved) setState(JSON.parse(saved) as AppState); }
      catch { window.localStorage.removeItem(STORAGE_KEY); }
      finally { setHydrated(true); }
    });
  }, [mode]);

  useEffect(() => {
    if (mode === "demo" && hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, mode, state]);

  const refresh = useCallback(async () => {
    if (supabase && userId) setState(await loadWorkspace(supabase, userId));
  }, [supabase, userId]);

  const run = useCallback(async <T,>(operation: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true); setError(undefined);
    try { return await operation(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Une erreur inattendue est survenue."); return undefined; }
    finally { setBusy(false); }
  }, []);

  const addCampaign = useCallback(async (campaign: Omit<Campaign, "id">) => run(async () => {
    if (supabase) { const id = await createCampaignRow(supabase, campaign); await refresh(); return id; }
    const id = uid("campaign"); setState((current) => ({ ...current, campaigns: [{ ...campaign, id }, ...current.campaigns] })); return id;
  }), [refresh, run, supabase]);

  const updateCampaign = useCallback(async (id: string, updates: Partial<Campaign>) => { await run(async () => {
    if (supabase) { await updateCampaignRow(supabase, id, updates); await refresh(); return; }
    setState((current) => ({ ...current, campaigns: current.campaigns.map((campaign) => campaign.id === id ? { ...campaign, ...updates } : campaign) }));
  }); }, [refresh, run, supabase]);

  const addProspect = useCallback(async (prospect: Omit<Prospect, "id" | "createdAt" | "updatedAt">) => run(async () => {
    if (supabase) { const id = await createProspectRow(supabase, prospect); await refresh(); return id; }
    const id = uid("prospect"); const now = new Date().toISOString();
    setState((current) => ({ ...current, prospects: [{ ...prospect, id, createdAt: now, updatedAt: now }, ...current.prospects], activities: [localActivity(id, "CREATED", "Prospect créé"), ...current.activities] })); return id;
  }), [refresh, run, supabase]);

  const updateProspect = useCallback(async (id: string, updates: Partial<Prospect>) => { await run(async () => {
    if (supabase) { await updateProspectRow(supabase, id, updates); await refresh(); return; }
    setState((current) => ({ ...current, prospects: current.prospects.map((prospect) => prospect.id === id ? { ...prospect, ...updates, updatedAt: new Date().toISOString() } : prospect), activities: [localActivity(id, "UPDATED", "Fiche prospect modifiée"), ...current.activities] }));
  }); }, [refresh, run, supabase]);

  const analyzeProspect = useCallback((id: string) => run(async () => {
    const prospect = state.prospects.find((item) => item.id === id);
    if (!prospect || prospect.status === "DO_NOT_CONTACT") throw new Error("Ce prospect ne peut pas être analysé.");
    const fallback = fallbackAnalysis(prospect);
    const resolved = await resolveAIRequest(mode, async () => {
      const analysis = await requestAI<ProspectAnalysis>({ task: "analyzeProspect", prospect });
      return { ...fallback, analysis: { ...analysis, demo: false }, reason: analysis.reasonToContact };
    }, () => fallback);
    const result = resolved.data;
    if (supabase) { await saveAnalysis(supabase, prospect, result.analysis, result.score, result.reason); await refresh(); return true; }
    const demoSuffix = resolved.demo ? " (Demo AI result)" : "";
    const now = new Date().toISOString(); setState((current) => ({ ...current, prospects: current.prospects.map((item) => item.id === id ? { ...item, leadScore: result.score, qualificationReason: result.reason, status: result.score >= 55 ? "QUALIFIED" : "ANALYZED", analysis: result.analysis, updatedAt: now } : item), activities: [localActivity(id, "ANALYZED", `Analyse terminée, score ${result.score}/100${demoSuffix}`), ...current.activities] }));
    return true;
  }), [mode, refresh, run, state.prospects, supabase]);

  const generateMessage = useCallback(async (prospectId: string, channel: Channel, kind: OutreachMessage["kind"] = "FIRST_CONTACT") => run(async () => {
    const prospect = state.prospects.find((item) => item.id === prospectId); const campaign = state.campaigns.find((item) => item.id === prospect?.campaignId);
    if (!prospect || prospect.status === "DO_NOT_CONTACT") throw new Error("Génération bloquée pour ce prospect.");
    const resolved = await resolveAIRequest(mode, async () => {
      const generated = await requestAI<{ subject?: string; body: string }>({ task: "generateOutreachMessage", prospect, campaign: campaign ?? {}, channel, kind });
      return { subject: generated.subject, body: sanitizeCommercialMessage(generated.body) };
    }, () => fallbackMessage(prospect, campaign, channel, kind));
    const generated = resolved.data; const isDemo = resolved.demo;
    const now = new Date().toISOString();
    const draft = { prospectId, campaignId: prospect.campaignId, channel, kind, ...generated, status: "DRAFT" as const, scheduledFor: now, recommendedLocalTime: "9:00 AM - 11:00 AM local time" };
    if (supabase) { const id = await createMessageRow(supabase, draft, isDemo); await refresh(); return id; }
    const id = uid("message"); setState((current) => ({ ...current, prospects: current.prospects.map((item) => item.id === prospectId ? { ...item, status: "DRAFT_READY", updatedAt: now } : item), messages: [{ ...draft, id, createdAt: now, updatedAt: now }, ...current.messages], activities: [localActivity(prospectId, "MESSAGE_GENERATED", `Brouillon ${channel} créé (Demo AI result)`), ...current.activities] })); return id;
  }), [mode, refresh, run, state.campaigns, state.prospects, supabase]);

  const updateMessage = useCallback(async (id: string, body: string, subject?: string) => { await run(async () => {
    if (supabase) { await updateMessageRow(supabase, id, body, subject); await refresh(); return; }
    setState((current) => ({ ...current, messages: current.messages.map((message) => message.id === id ? { ...message, body: sanitizeCommercialMessage(body), subject, updatedAt: new Date().toISOString() } : message), activities: [localActivity(current.messages.find((message) => message.id === id)?.prospectId, "MESSAGE_EDITED", "Message modifié"), ...current.activities] }));
  }); }, [refresh, run, supabase]);

  const setMessageStatus = useCallback(async (ids: string[], status: "APPROVED" | "REJECTED" | "SNOOZED") => { await run(async () => {
    if (supabase) { await setMessagesStatus(supabase, ids, status); await refresh(); return; }
    const selected = new Set(ids); const now = new Date().toISOString();
    setState((current) => ({ ...current, messages: current.messages.map((message) => selected.has(message.id) ? { ...message, status, approvedAt: status === "APPROVED" ? now : undefined, approvedBy: status === "APPROVED" ? current.profile.id : undefined, updatedAt: now } : message), prospects: current.prospects.map((prospect) => current.messages.some((message) => selected.has(message.id) && message.prospectId === prospect.id) ? { ...prospect, status: status === "APPROVED" ? "APPROVED" : prospect.status, updatedAt: now } : prospect), activities: [...ids.map((messageId) => localActivity(current.messages.find((message) => message.id === messageId)?.prospectId, status, `Message ${status.toLowerCase()}`)), ...current.activities] }));
  }); }, [refresh, run, supabase]);

  const markSent = useCallback(async (id: string) => { await run(async () => {
    if (supabase) { await markMessageSent(supabase, id); await refresh(); return; }
    const message = state.messages.find((item) => item.id === id); if (!message?.approvedAt || message.status !== "APPROVED") throw new Error("Envoi bloqué: le message doit d’abord être approuvé.");
    const now = new Date(); const followUp = new Date(now); followUp.setDate(followUp.getDate() + state.settings.followUp1Days);
    setState((current) => ({ ...current, messages: current.messages.map((item) => item.id === id ? { ...item, status: "SENT", sentAt: now.toISOString(), updatedAt: now.toISOString() } : item), prospects: current.prospects.map((prospect) => prospect.id === message.prospectId ? { ...prospect, status: "CONTACTED", contactedAt: now.toISOString(), nextFollowUpAt: followUp.toISOString(), updatedAt: now.toISOString() } : prospect), activities: [localActivity(message.prospectId, "CONTACTED", `Message ${message.channel} marqué comme envoyé, relance planifiée`), ...current.activities] }));
  }); }, [refresh, run, state.messages, state.settings.followUp1Days, supabase]);

  const recordReply = useCallback(async (prospectId: string, category: ReplyCategory, replyText: string) => { await run(async () => {
    if (supabase) { await createReply(supabase, prospectId, category, replyText); await refresh(); return; }
    const now = new Date().toISOString(); const status = category === "do_not_contact" ? "DO_NOT_CONTACT" : category === "interested" || category === "positive" ? "INTERESTED" : "REPLIED";
    setState((current) => ({ ...current, prospects: current.prospects.map((prospect) => prospect.id === prospectId ? { ...prospect, status, replyCategory: category, replyText, nextFollowUpAt: undefined, updatedAt: now } : prospect), activities: [localActivity(prospectId, status, `Réponse enregistrée: ${category}`), ...current.activities] }));
  }); }, [refresh, run, supabase]);

  const markWon = useCallback(async (prospectId: string, amount: number, paidAmount: number) => { await run(async () => {
    if (supabase) { await createDeal(supabase, prospectId, amount, paidAmount); await refresh(); return; }
    const wonAt = new Date().toISOString(); const deal: Deal = { id: uid("deal"), prospectId, amount, paidAmount, currency: state.settings.defaultCurrency, product: "Site vitrine", paymentStatus: paidAmount >= amount ? "PAID" : paidAmount > 0 ? "DEPOSIT_PAID" : "PENDING", wonAt };
    setState((current) => ({ ...current, deals: [deal, ...current.deals], prospects: current.prospects.map((prospect) => prospect.id === prospectId ? { ...prospect, status: "WON", nextFollowUpAt: undefined, updatedAt: wonAt } : prospect), activities: [localActivity(prospectId, "WON", `Vente enregistrée: $${amount}`), ...current.activities] }));
  }); }, [refresh, run, state.settings.defaultCurrency, supabase]);

  const updateProfile = useCallback(async (profile: Pick<Profile, "displayName" | "companyName">) => { await run(async () => {
    if (supabase) { await updateProfileRow(supabase, profile); await refresh(); return; }
    setState((current) => ({ ...current, profile: { ...current.profile, ...profile } }));
  }); }, [refresh, run, supabase]);

  const updateSettings = useCallback(async (settings: Partial<UserSettings>) => { await run(async () => {
    if (supabase) { await updateSettingsRow(supabase, settings); await refresh(); return; }
    setState((current) => ({ ...current, settings: { ...current.settings, ...settings } }));
  }); }, [refresh, run, supabase]);

  const resetDemo = useCallback(() => { if (mode !== "demo") return; setState(initialState); window.localStorage.removeItem(STORAGE_KEY); }, [mode]);
  const clearError = useCallback(() => setError(undefined), []);
  const value = useMemo(() => ({ state, mode, hydrated, busy, error, clearError, addCampaign, updateCampaign, addProspect, updateProspect, analyzeProspect, generateMessage, updateMessage, setMessageStatus, markSent, recordReply, markWon, updateProfile, updateSettings, resetDemo }), [state, mode, hydrated, busy, error, clearError, addCampaign, updateCampaign, addProspect, updateProspect, analyzeProspect, generateMessage, updateMessage, setMessageStatus, markSent, recordReply, markWon, updateProfile, updateSettings, resetDemo]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useAppStore must be used within AppStoreProvider");
  return value;
}
