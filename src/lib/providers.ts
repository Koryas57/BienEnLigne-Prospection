import type { Prospect } from "@/lib/types";

export interface ProspectDiscoveryProvider {
  name: string;
  discover(input: { city: string; sector: string; limit: number }): Promise<Partial<Prospect>[]>;
}

export interface EmailProvider {
  name: string;
  send(input: { to: string; subject: string; body: string; approvedAt: string }): Promise<{ externalId: string }>;
}

export interface NotificationProvider {
  notify(input: { title: string; body: string }): Promise<void>;
}

export interface CRMExportProvider {
  exportProspects(prospects: Prospect[]): Promise<{ exported: number }>;
}

export function assertMessageApproved(approvedAt?: string): asserts approvedAt is string {
  if (!approvedAt) throw new Error("Envoi bloqué : le message n’a pas été explicitement approuvé.");
}
