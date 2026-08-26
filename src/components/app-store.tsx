"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { initialState } from "@/lib/demo-data";
import { scoreProspect } from "@/lib/scoring";
import type { AppState, Campaign, Channel, Deal, Prospect, ProspectAnalysis, ReplyCategory } from "@/lib/types";

const STORAGE_KEY = "bienenligne-prospection-v1";
const uid = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  addCampaign: (campaign: Omit<Campaign, "id">) => string;
  addProspect: (prospect: Omit<Prospect, "id" | "createdAt" | "updatedAt">) => string;
  updateProspect: (id: string, updates: Partial<Prospect>) => void;
  analyzeProspect: (id: string) => void;
  generateMessage: (prospectId: string, channel: Channel, kind?: "FIRST_CONTACT" | "FOLLOW_UP_1" | "FOLLOW_UP_2") => string;
  updateMessage: (id: string, body: string, subject?: string) => void;
  setMessageStatus: (ids: string[], status: "APPROVED" | "REJECTED" | "SNOOZED") => void;
  markSent: (id: string) => void;
  recordReply: (prospectId: string, category: ReplyCategory, text: string) => void;
  markWon: (prospectId: string, amount: number, paidAmount: number) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function activity(prospectId: string | undefined, type: string, label: string) {
  return { id: uid("activity"), prospectId, type, label, createdAt: new Date().toISOString() };
}

export function AppStoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) setState(JSON.parse(saved) as AppState);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      } finally {
        setHydrated(true);
      }
    });
  }, []);

  useEffect(() => {
    if (hydrated) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const addCampaign = useCallback((campaign: Omit<Campaign, "id">) => {
    const id = uid("campaign");
    setState((current) => ({ ...current, campaigns: [{ ...campaign, id }, ...current.campaigns] }));
    return id;
  }, []);

  const addProspect = useCallback((prospect: Omit<Prospect, "id" | "createdAt" | "updatedAt">) => {
    const id = uid("prospect");
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      prospects: [{ ...prospect, id, createdAt: now, updatedAt: now }, ...current.prospects],
      activities: [activity(id, "CREATED", "Prospect créé"), ...current.activities],
    }));
    return id;
  }, []);

  const updateProspect = useCallback((id: string, updates: Partial<Prospect>) => {
    setState((current) => ({
      ...current,
      prospects: current.prospects.map((prospect) => prospect.id === id ? { ...prospect, ...updates, updatedAt: new Date().toISOString() } : prospect),
      activities: [activity(id, "UPDATED", "Fiche prospect modifiée"), ...current.activities],
    }));
  }, []);

  const analyzeProspect = useCallback((id: string) => {
    const snapshot = state.prospects.find((item) => item.id === id);
    if (!snapshot || snapshot.status === "DO_NOT_CONTACT") return;
    setState((current) => {
      const target = current.prospects.find((item) => item.id === id);
      if (!target || target.status === "DO_NOT_CONTACT") return current;
      const computed = scoreProspect(target);
      const bestChannel = target.instagramUrl ? "instagram" : target.facebookUrl ? "facebook" : target.email ? "email" : "unknown";
      const updated: Prospect = {
        ...target,
        leadScore: computed.score,
        qualificationReason: target.qualificationReason || computed.reason,
        status: computed.score >= 55 ? "QUALIFIED" : "ANALYZED",
        analysis: {
          isRealBusiness: target.googlePresence === true ? true : "unknown",
          independentBusiness: target.independentBusiness,
          likelyFranchise: target.likelyFranchise,
          digitalPresence: target.googlePresence === true || target.instagramActive === true ? "average" : "weak",
          mainProblem: target.hasWebsite === false ? "No dedicated website identified." : "The current digital journey may be unclear on mobile.",
          relevance: computed.score >= 70 ? "High" : computed.score >= 50 ? "Medium" : "Low",
          reasonToContact: target.hasWebsite === false ? "A focused site could centralize the essentials customers need." : "A clearer mobile experience could turn local interest into enquiries.",
          bestChannel,
          salesAngle: "Keep the offer concrete, local and focused on one visible digital gap.",
          demo: true,
        },
        updatedAt: new Date().toISOString(),
      };
      return {
        ...current,
        prospects: current.prospects.map((item) => item.id === id ? updated : item),
        activities: [activity(id, "ANALYZED", `Analyse terminée — score ${computed.score}/100 (Demo AI result)`), ...current.activities],
      };
    });
    void fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "analyzeProspect", prospect: snapshot }) })
      .then(async (response) => response.ok ? response.json() as Promise<{ data: ProspectAnalysis; demo: false }> : Promise.reject(new Error("AI fallback")))
      .then(({ data }) => setState((current) => ({
        ...current,
        prospects: current.prospects.map((prospect) => prospect.id === id ? { ...prospect, analysis: { ...data, demo: false }, qualificationReason: data.reasonToContact, updatedAt: new Date().toISOString() } : prospect),
        activities: [activity(id, "ANALYZED_AI", "Analyse OpenAI validée"), ...current.activities],
      })))
      .catch(() => undefined);
  }, [state.prospects]);

  const generateMessage = useCallback((prospectId: string, channel: Channel, kind: "FIRST_CONTACT" | "FOLLOW_UP_1" | "FOLLOW_UP_2" = "FIRST_CONTACT") => {
    const id = uid("message");
    const snapshot = state.prospects.find((item) => item.id === prospectId);
    const campaignSnapshot = state.campaigns.find((item) => item.id === snapshot?.campaignId);
    setState((current) => {
      const prospect = current.prospects.find((item) => item.id === prospectId);
      if (!prospect || prospect.status === "DO_NOT_CONTACT") return current;
      const campaign = current.campaigns.find((item) => item.id === prospect.campaignId);
      const cityContext = prospect.city.toLowerCase() === "little rock"
        ? "I have a friend who lives in Little Rock, and while we were discussing local businesses and website prices, I came across your business. "
        : `I came across ${prospect.businessName} while looking at local ${prospect.category.toLowerCase()} businesses in ${prospect.city}. `;
      const observed = prospect.hasWebsite === false
        ? "I noticed your strong local presence, but I couldn’t find a dedicated website bringing the essentials together. "
        : "I noticed the current online experience could make the essentials easier to find on a phone. ";
      const first = `Hi ${prospect.businessName} team — ${cityContext}${observed}I’m currently offering an introductory $${campaign?.price ?? 350} price to a few small businesses in the US, and I’d be happy to show you a simple idea tailored to your business. Would that be useful?`;
      const followup = `Hi again — just following up on the website idea I sent for ${prospect.businessName}. I’d be glad to sketch a simple direction around ${prospect.analysis?.mainProblem.toLowerCase() ?? "making the mobile experience clearer"}. No rush at all; should I send it over?`;
      const now = new Date().toISOString();
      return {
        ...current,
        prospects: current.prospects.map((item) => item.id === prospectId ? { ...item, status: "DRAFT_READY", updatedAt: now } : item),
        messages: [{
          id, prospectId, campaignId: prospect.campaignId, channel, kind,
          subject: channel === "email" ? `A website idea for ${prospect.businessName}` : undefined,
          body: kind === "FIRST_CONTACT" ? first : followup, status: "DRAFT", scheduledFor: now,
          recommendedLocalTime: "9:00 AM – 11:00 AM local time", createdAt: now, updatedAt: now,
        }, ...current.messages],
        activities: [activity(prospectId, "MESSAGE_GENERATED", `${channel} ${kind === "FIRST_CONTACT" ? "créé" : "relance créée"} (Demo AI result)`), ...current.activities],
      };
    });
    if (snapshot && campaignSnapshot && snapshot.status !== "DO_NOT_CONTACT") {
      void fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ task: "generateOutreachMessage", prospect: snapshot, campaign: campaignSnapshot, channel, kind }) })
        .then(async (response) => response.ok ? response.json() as Promise<{ data: { subject?: string; body: string }; demo: false }> : Promise.reject(new Error("AI fallback")))
        .then(({ data }) => setState((current) => ({
          ...current,
          messages: current.messages.map((message) => message.id === id ? { ...message, ...data, updatedAt: new Date().toISOString() } : message),
          activities: [activity(prospectId, "MESSAGE_GENERATED_AI", "Brouillon OpenAI validé"), ...current.activities],
        })))
        .catch(() => undefined);
    }
    return id;
  }, [state.campaigns, state.prospects]);

  const updateMessage = useCallback((id: string, body: string, subject?: string) => {
    setState((current) => ({
      ...current,
      messages: current.messages.map((message) => message.id === id ? { ...message, body, subject, updatedAt: new Date().toISOString() } : message),
      activities: [activity(current.messages.find((message) => message.id === id)?.prospectId, "MESSAGE_EDITED", "Message modifié"), ...current.activities],
    }));
  }, []);

  const setMessageStatus = useCallback((ids: string[], status: "APPROVED" | "REJECTED" | "SNOOZED") => {
    const selected = new Set(ids);
    const now = new Date().toISOString();
    setState((current) => ({
      ...current,
      messages: current.messages.map((message) => selected.has(message.id) ? {
        ...message, status, approvedAt: status === "APPROVED" ? now : undefined,
        approvedBy: status === "APPROVED" ? "local-demo-user" : undefined, updatedAt: now,
      } : message),
      prospects: current.prospects.map((prospect) => current.messages.some((message) => selected.has(message.id) && message.prospectId === prospect.id)
        ? { ...prospect, status: status === "APPROVED" ? "APPROVED" : prospect.status, updatedAt: now }
        : prospect),
      activities: [...ids.map((id) => activity(current.messages.find((message) => message.id === id)?.prospectId, status, `Message ${status === "APPROVED" ? "approuvé" : status === "REJECTED" ? "refusé" : "reporté"}`)), ...current.activities],
    }));
  }, []);

  const markSent = useCallback((id: string) => {
    const now = new Date();
    const followUp = new Date(now);
    followUp.setDate(followUp.getDate() + 3);
    setState((current) => {
      const message = current.messages.find((item) => item.id === id);
      if (!message?.approvedAt) return current;
      return {
        ...current,
        messages: current.messages.map((item) => item.id === id ? { ...item, status: "SENT", sentAt: now.toISOString(), updatedAt: now.toISOString() } : item),
        prospects: current.prospects.map((prospect) => prospect.id === message.prospectId ? { ...prospect, status: "CONTACTED", contactedAt: now.toISOString(), nextFollowUpAt: followUp.toISOString(), updatedAt: now.toISOString() } : prospect),
        activities: [activity(message.prospectId, "CONTACTED", `Message ${message.channel} marqué comme envoyé — relance J+3 planifiée`), ...current.activities],
      };
    });
  }, []);

  const recordReply = useCallback((prospectId: string, category: ReplyCategory, text: string) => {
    const now = new Date().toISOString();
    const status = category === "do_not_contact" ? "DO_NOT_CONTACT" : category === "interested" || category === "positive" ? "INTERESTED" : "REPLIED";
    setState((current) => ({
      ...current,
      prospects: current.prospects.map((prospect) => prospect.id === prospectId ? { ...prospect, status, replyCategory: category, replyText: text, nextFollowUpAt: undefined, updatedAt: now } : prospect),
      messages: current.messages.map((message) => message.prospectId === prospectId && message.status === "DRAFT" && message.kind !== "FIRST_CONTACT" ? { ...message, status: "REJECTED", updatedAt: now } : message),
      activities: [activity(prospectId, category === "do_not_contact" ? "DO_NOT_CONTACT" : "REPLIED", `Réponse enregistrée : ${category}`), ...current.activities],
    }));
  }, []);

  const markWon = useCallback((prospectId: string, amount: number, paidAmount: number) => {
    const deal: Deal = { id: uid("deal"), prospectId, amount, paidAmount, currency: "USD", product: "Site vitrine", paymentStatus: paidAmount >= amount ? "PAID" : paidAmount > 0 ? "DEPOSIT_PAID" : "PENDING", wonAt: new Date().toISOString() };
    setState((current) => ({
      ...current, deals: [deal, ...current.deals],
      prospects: current.prospects.map((prospect) => prospect.id === prospectId ? { ...prospect, status: "WON", nextFollowUpAt: undefined, updatedAt: deal.wonAt } : prospect),
      activities: [activity(prospectId, "WON", `Vente enregistrée : $${amount}`), ...current.activities],
    }));
  }, []);

  const resetDemo = useCallback(() => {
    setState(initialState);
    window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const value = useMemo(() => ({ state, hydrated, addCampaign, addProspect, updateProspect, analyzeProspect, generateMessage, updateMessage, setMessageStatus, markSent, recordReply, markWon, resetDemo }), [state, hydrated, addCampaign, addProspect, updateProspect, analyzeProspect, generateMessage, updateMessage, setMessageStatus, markSent, recordReply, markWon, resetDemo]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useAppStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error("useAppStore must be used within AppStoreProvider");
  return value;
}
