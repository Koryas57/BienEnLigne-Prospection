export const prospectStatuses = [
  "NEW", "ANALYZED", "QUALIFIED", "REJECTED", "DRAFT_READY", "APPROVED",
  "CONTACTED", "FOLLOW_UP", "REPLIED", "INTERESTED", "WON", "LOST", "DO_NOT_CONTACT",
] as const;
export type ProspectStatus = (typeof prospectStatuses)[number];
export type Channel = "instagram" | "facebook" | "email";
export type MessageStatus = "DRAFT" | "APPROVED" | "REJECTED" | "SNOOZED" | "SENT";
export type ReplyCategory = "positive" | "interested" | "question" | "maybe_later" | "negative" | "do_not_contact" | "unknown";
export type DataMode = "supabase" | "demo";
export type WebsiteType = "dedicated" | "link_in_bio" | "social_profile" | "marketplace" | "booking_platform" | "unknown";
export type EnrichmentSourceKind = "manual" | "geoapify" | "openstreetmap" | "direct_inspection" | "web_search" | "llm_interpretation";
export type EnrichmentFactKey =
  | "businessName" | "address" | "city" | "state" | "postcode" | "country" | "latitude" | "longitude" | "types" | "placeId"
  | "rating" | "reviewCount" | "phone" | "email" | "websiteUrl" | "instagramUrl" | "facebookUrl" | "googleMapsUrl" | "businessStatus" | "openingHours"
  | "datasource" | "brand" | "brandWikidataId" | "brandDetected" | "operator" | "officialName" | "franchiseSignal" | "wiki"
  | "websiteType" | "hasWebsite" | "websiteHttps" | "googlePresence"
  | "instagramActive" | "facebookActive" | "independentBusiness" | "likelyFranchise";
export type EnrichmentValue = string | number | boolean | string[];

export interface EnrichmentEvidence {
  field: EnrichmentFactKey;
  value: EnrichmentValue;
  source: { kind: EnrichmentSourceKind; provider: string; label: string; url?: string };
  fetchedAt: string;
  confidence?: number;
}

export interface EnrichmentProviderRun {
  provider: string;
  status: "success" | "not_configured" | "no_match" | "error" | "skipped";
  fetchedAt: string;
  cached?: boolean;
  message?: string;
}

export interface EnrichmentConflict {
  field: EnrichmentFactKey;
  selected: EnrichmentEvidence;
  alternatives: EnrichmentEvidence[];
}

export interface ProspectEnrichment {
  version: 1;
  fetchedAt: string;
  providers: EnrichmentProviderRun[];
  evidence: EnrichmentEvidence[];
  conflicts: EnrichmentConflict[];
  prequalification?: PrequalificationTier;
}

export type PrequalificationTier = "reject" | "low" | "potential" | "strong";

export interface ScoreContribution {
  code: string;
  label: string;
  points: number;
}

export interface Profile {
  id: string;
  displayName: string;
  companyName: string;
}

export interface UserSettings {
  followUp1Days: number;
  followUp2Days: number;
  defaultCurrency: string;
  defaultPrice: number;
  scoringRules: Record<string, number>;
}

export interface Campaign {
  id: string;
  name: string;
  country: string;
  state: string;
  city: string;
  timezone: string;
  sector: string;
  price: number;
  currency: string;
  status: "ACTIVE" | "PAUSED" | "ARCHIVED";
  minReviews: number;
  maxProspects: number;
  channels: Channel[];
  notes?: string;
}

export interface ProspectAnalysis {
  isRealBusiness: boolean | "unknown";
  independentBusiness: boolean | "unknown";
  likelyFranchise: boolean | "unknown";
  digitalPresence: "weak" | "average" | "strong" | "unknown";
  mainProblem: string;
  relevance: string;
  reasonToContact: string;
  bestChannel: Channel | "unknown";
  salesAngle: string;
  webSources?: Array<{ title: string; url: string }>;
  demo?: boolean;
}

export interface Prospect {
  id: string;
  campaignId: string;
  businessName: string;
  contactName?: string;
  category: string;
  subcategory?: string;
  city: string;
  state: string;
  country: string;
  timezone: string;
  address?: string;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  websiteType?: WebsiteType;
  instagramUrl?: string;
  facebookUrl?: string;
  googleMapsUrl?: string;
  rating?: number;
  reviewCount?: number;
  notes?: string;
  source: string;
  status: ProspectStatus;
  leadScore: number;
  qualificationReason: string;
  hasWebsite: boolean | "unknown";
  websiteQualityScore?: number;
  websiteMobileFriendly: boolean | "unknown";
  websiteHttps: boolean | "unknown";
  websiteNotes?: string;
  instagramActive: boolean | "unknown";
  facebookActive: boolean | "unknown";
  googlePresence: boolean | "unknown";
  socialNotes?: string;
  independentBusiness: boolean | "unknown";
  likelyFranchise: boolean | "unknown";
  contactedAt?: string;
  nextFollowUpAt?: string;
  replyCategory?: ReplyCategory;
  replyText?: string;
  analysis?: ProspectAnalysis;
  enrichment?: ProspectEnrichment;
  scoreBreakdown?: ScoreContribution[];
  createdAt: string;
  updatedAt: string;
}

export interface OutreachMessage {
  id: string;
  prospectId: string;
  campaignId: string;
  channel: Channel;
  kind: "FIRST_CONTACT" | "FOLLOW_UP_1" | "FOLLOW_UP_2";
  subject?: string;
  body: string;
  status: MessageStatus;
  scheduledFor: string;
  recommendedLocalTime: string;
  approvedAt?: string;
  approvedBy?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  prospectId?: string;
  type: string;
  label: string;
  createdAt: string;
}

export interface Deal {
  id: string;
  prospectId: string;
  amount: number;
  currency: string;
  product: string;
  paidAmount: number;
  paymentStatus: "PENDING" | "DEPOSIT_PAID" | "PAID";
  wonAt: string;
}

export interface AppState {
  profile: Profile;
  settings: UserSettings;
  campaigns: Campaign[];
  prospects: Prospect[];
  messages: OutreachMessage[];
  activities: Activity[];
  deals: Deal[];
}
