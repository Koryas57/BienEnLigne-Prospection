import type { MessageStatus, ProspectStatus } from "@/lib/types";

const prospectLabels: Record<ProspectStatus, string> = {
  NEW: "Nouveau",
  ANALYZED: "Analysé",
  QUALIFIED: "Qualifié",
  REJECTED: "Refusé",
  DRAFT_READY: "Brouillon prêt",
  APPROVED: "Approuvé",
  CONTACTED: "Contacté",
  FOLLOW_UP: "À relancer",
  REPLIED: "Répondu",
  INTERESTED: "Intéressé",
  WON: "Gagné",
  LOST: "Perdu",
  DO_NOT_CONTACT: "Ne pas contacter",
};

const messageLabels: Record<MessageStatus, string> = {
  DRAFT: "Brouillon",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
  SNOOZED: "Reporté",
  SENT: "Envoyé",
};

export const prospectStatusLabel = (status: ProspectStatus) => prospectLabels[status];
export const messageStatusLabel = (status: MessageStatus) => messageLabels[status];
