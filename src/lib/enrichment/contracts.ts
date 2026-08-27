import type {
  EnrichmentEvidence,
  EnrichmentProviderRun,
  Prospect,
  ProspectEnrichment,
  PrequalificationTier,
} from "@/lib/types";

export type EnrichmentProspect = Pick<Prospect,
  | "businessName" | "category" | "city" | "state" | "country" | "address" | "phone" | "email"
  | "websiteUrl" | "instagramUrl" | "facebookUrl" | "googleMapsUrl" | "rating" | "reviewCount"
  | "hasWebsite" | "websiteType" | "websiteHttps" | "instagramActive" | "facebookActive"
  | "googlePresence" | "independentBusiness" | "likelyFranchise"
>;

export interface EnrichmentProviderResult {
  status: EnrichmentProviderRun["status"];
  evidence?: EnrichmentEvidence[];
  message?: string;
}

export interface ProspectEnrichmentProvider {
  readonly id: string;
  readonly cacheTtlMs: number;
  enrich(prospect: EnrichmentProspect, fetchedAt: string): Promise<EnrichmentProviderResult>;
}

export interface RunEnrichmentInput {
  prospect: EnrichmentProspect;
  providers: ProspectEnrichmentProvider[];
  fallbackProviders?: ProspectEnrichmentProvider[];
  existing?: ProspectEnrichment;
  now?: Date;
}

export interface DiscoveryInput {
  city: string;
  state?: string;
  country?: string;
  sector: string;
  limit: number;
}

export type FranchiseSignal = "unknown" | "brand_detected" | "likely_franchise" | "confirmed_franchise";

export interface DiscoveredProspect {
  provider: "geoapify" | "openstreetmap";
  providerPlaceId: string;
  businessName: string;
  category: string;
  address?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  websiteUrl?: string;
  openingHours?: string;
  brand?: string;
  brandWikidataId?: string;
  operator?: string;
  officialName?: string;
  datasource?: string;
  franchiseSignal: FranchiseSignal;
  brandSignalLabel?: string;
  categories: string[];
}

export interface ProspectDiscoveryProvider {
  readonly id: "geoapify" | "openstreetmap";
  discover(input: DiscoveryInput): Promise<DiscoveredProspect[]>;
}

export interface RunEnrichmentResult {
  enrichment: ProspectEnrichment;
  prospectPatch: Partial<Prospect>;
  enrichedProspect: EnrichmentProspect;
  prequalification?: { tier: PrequalificationTier; score: number; reason: string };
}
