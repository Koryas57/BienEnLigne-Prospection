import { z } from "zod";

export const analysisSchema = z.object({
  isRealBusiness: z.union([z.boolean(), z.literal("unknown")]),
  independentBusiness: z.union([z.boolean(), z.literal("unknown")]),
  likelyFranchise: z.union([z.boolean(), z.literal("unknown")]),
  digitalPresence: z.enum(["weak", "average", "strong", "unknown"]),
  mainProblem: z.string(), relevance: z.string(), reasonToContact: z.string(),
  bestChannel: z.enum(["instagram", "facebook", "email", "unknown"]), salesAngle: z.string(),
});
export const messageSchema = z.object({ subject: z.string().optional(), body: z.string().min(20).max(1800) });
export const replyAnalysisSchema = z.object({ summary: z.string(), sentiment: z.enum(["positive", "neutral", "negative", "unknown"]), nextAction: z.string(), replyDraft: z.string() });
export const aiRequestSchema = z.discriminatedUnion("task", [
  z.object({ task: z.literal("analyzeProspect"), prospect: z.record(z.string(), z.unknown()) }),
  z.object({ task: z.literal("generateOutreachMessage"), prospect: z.record(z.string(), z.unknown()), campaign: z.record(z.string(), z.unknown()), channel: z.enum(["instagram", "facebook", "email"]), kind: z.enum(["FIRST_CONTACT", "FOLLOW_UP_1", "FOLLOW_UP_2"]).default("FIRST_CONTACT") }),
  z.object({ task: z.literal("analyzeReply"), prospect: z.record(z.string(), z.unknown()), reply: z.string().min(1).max(5000) }),
]);
