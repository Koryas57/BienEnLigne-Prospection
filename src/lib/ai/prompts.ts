const guardrails = `Use only facts present in the supplied JSON. Never infer names, reviews, activity, ownership, locations or website quality without evidence. For every unknown fact, use the exact value "unknown". No invented urgency, promises or claims. Never use an em dash or en dash character in any commercial message; use a normal hyphen or punctuation instead.`;

export function analysisPrompt(prospect: Record<string, unknown>) {
  return `${guardrails}\nAnalyze this prospect for a small-business website offer. Return JSON only with: isRealBusiness (boolean|unknown), independentBusiness (boolean|unknown), likelyFranchise (boolean|unknown), digitalPresence (weak|average|strong|unknown), mainProblem, relevance, reasonToContact, bestChannel (instagram|facebook|email|unknown), salesAngle.\nPROSPECT:\n${JSON.stringify(prospect)}`;
}

export function messagePrompt(prospect: Record<string, unknown>, campaign: Record<string, unknown>, channel: string, kind: string) {
  const littleRock = String(prospect.city ?? "").toLowerCase() === "little rock" ? `You may naturally mention: "I have a friend who lives in Little Rock and while discussing local businesses and website prices, I started looking at businesses in the area."` : "Do not invent any personal connection to the city.";
  return `${guardrails}\nWrite a short, human, cordial American-English ${channel} ${kind}. Precisely name the business and reference one genuinely observed fact. Not corporate, aggressive, urgent, or jargon-heavy. Prefer "I'm currently offering an introductory price to a few small businesses in the US." Never say "I'm testing the US market". ${littleRock}\nReturn JSON only: {"subject":"email only, otherwise omit","body":"message"}.\nPROSPECT:${JSON.stringify(prospect)}\nCAMPAIGN:${JSON.stringify(campaign)}`;
}

export function replyPrompt(prospect: Record<string, unknown>, reply: string) {
  return `${guardrails}\nAnalyze the pasted reply. Return JSON only with summary, sentiment (positive|neutral|negative|unknown), nextAction, replyDraft. The draft must never be sent automatically.\nPROSPECT:${JSON.stringify(prospect)}\nREPLY:${JSON.stringify(reply)}`;
}
