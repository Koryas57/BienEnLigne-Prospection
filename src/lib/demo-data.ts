import type { AppState, Campaign, OutreachMessage, Prospect } from "@/lib/types";

const today = new Date();
const iso = today.toISOString();
const day = (offset: number) => {
  const value = new Date(today);
  value.setDate(value.getDate() + offset);
  return value.toISOString();
};

export const demoCampaign: Campaign = {
  id: "campaign-little-rock",
  name: "Little Rock Restaurants 350",
  country: "USA",
  state: "Arkansas",
  city: "Little Rock",
  timezone: "America/Chicago",
  sector: "Restaurants indépendants",
  price: 350,
  currency: "USD",
  status: "ACTIVE",
  minReviews: 30,
  maxProspects: 100,
  channels: ["instagram", "facebook", "email"],
  notes: "Données de démonstration — prix d’introduction US.",
};

export const demoProspects: Prospect[] = [
  {
    id: "prospect-el-alamo", campaignId: demoCampaign.id, businessName: "El Alamo Mexican Grill",
    category: "Restaurant", subcategory: "Mexican restaurant", city: "Little Rock", state: "Arkansas", country: "USA",
    timezone: "America/Chicago", phone: "+1 (501) 555-0142", instagramUrl: "https://instagram.com/",
    facebookUrl: "https://facebook.com/", googleMapsUrl: "https://maps.google.com/", rating: 4.7, reviewCount: 199,
    source: "Demo seed", status: "QUALIFIED", leadScore: 87, hasWebsite: false, websiteMobileFriendly: "unknown",
    websiteHttps: "unknown", websiteNotes: "Aucun site dédié identifié.", instagramActive: true, facebookActive: true,
    googlePresence: true, independentBusiness: true, likelyFranchise: false,
    socialNotes: "Présence visuelle active avec des photos récentes.",
    qualificationReason: "Restaurant actif avec forte présence Google, Facebook et Instagram mais sans site dédié.",
    analysis: {
      isRealBusiness: true, independentBusiness: true, likelyFranchise: false, digitalPresence: "average",
      mainProblem: "No dedicated website to turn local discovery into direct enquiries.",
      relevance: "High", reasonToContact: "Strong local reputation and visual content make a concise showcase site immediately useful.",
      bestChannel: "instagram", salesAngle: "A simple, polished site that centralizes menu, hours, location and direct contact.", demo: true,
    }, createdAt: iso, updatedAt: iso,
  },
  {
    id: "prospect-river-city", campaignId: demoCampaign.id, businessName: "River City Smokehouse", category: "Restaurant",
    city: "Little Rock", state: "Arkansas", country: "USA", timezone: "America/Chicago", email: "hello@example.com",
    instagramUrl: "https://instagram.com/", rating: 4.5, reviewCount: 82, source: "Demo seed", status: "DRAFT_READY",
    leadScore: 72, qualificationReason: "Bon volume d’avis et présence Instagram, site actuel peu lisible sur mobile.", hasWebsite: true,
    websiteUrl: "https://example.com", websiteQualityScore: 35, websiteMobileFriendly: false, websiteHttps: true,
    instagramActive: true, facebookActive: "unknown", googlePresence: true, independentBusiness: true, likelyFranchise: false,
    createdAt: iso, updatedAt: iso,
  },
  {
    id: "prospect-arkansas-hvac", campaignId: demoCampaign.id, businessName: "Arkansas Comfort Co.", category: "HVAC",
    city: "Little Rock", state: "Arkansas", country: "USA", timezone: "America/Chicago", facebookUrl: "https://facebook.com/",
    phone: "+1 (501) 555-0198", rating: 4.8, reviewCount: 131, source: "Demo seed", status: "CONTACTED", leadScore: 78,
    qualificationReason: "Entreprise locale très bien notée sans parcours de demande de devis clair.", hasWebsite: true,
    websiteQualityScore: 45, websiteMobileFriendly: false, websiteHttps: true, instagramActive: false, facebookActive: true,
    googlePresence: true, independentBusiness: true, likelyFranchise: false, contactedAt: day(-3), nextFollowUpAt: day(0),
    createdAt: iso, updatedAt: iso,
  },
  {
    id: "prospect-auto", campaignId: demoCampaign.id, businessName: "Capital Auto Detail", category: "Auto detailing",
    city: "Little Rock", state: "Arkansas", country: "USA", timezone: "America/Chicago", instagramUrl: "https://instagram.com/",
    rating: 4.9, reviewCount: 56, source: "Demo seed", status: "INTERESTED", leadScore: 81,
    qualificationReason: "Photos avant/après fortes et aucun site dédié pour présenter les forfaits.", hasWebsite: false,
    websiteMobileFriendly: "unknown", websiteHttps: "unknown", instagramActive: true, facebookActive: false,
    googlePresence: true, independentBusiness: true, likelyFranchise: false, replyCategory: "interested",
    createdAt: iso, updatedAt: iso,
  },
];

export const demoMessages: OutreachMessage[] = [
  {
    id: "message-el-alamo", prospectId: "prospect-el-alamo", campaignId: demoCampaign.id, channel: "instagram",
    kind: "FIRST_CONTACT", status: "DRAFT", scheduledFor: day(0), recommendedLocalTime: "9:00 AM – 11:00 AM CDT",
    body: "Hi El Alamo team — I have a friend who lives in Little Rock, and while we were talking about local businesses and website prices, I came across your restaurant. You’ve built a great local presence with strong reviews and active social pages, but I couldn’t find a dedicated website that brings your menu, hours, and location together. I’m currently offering an introductory $350 price to a few small US businesses, and I’d be happy to show you a simple idea tailored to El Alamo. Would that be useful?",
    createdAt: iso, updatedAt: iso,
  },
  {
    id: "message-river", prospectId: "prospect-river-city", campaignId: demoCampaign.id, channel: "email",
    kind: "FIRST_CONTACT", status: "DRAFT", subject: "A mobile-friendly idea for River City Smokehouse",
    scheduledFor: day(0), recommendedLocalTime: "9:00 AM – 11:00 AM CDT",
    body: "Hi River City Smokehouse team, I came across your Little Rock restaurant and noticed how much customers enjoy it. Your current site makes the essentials a little hard to find on a phone. I build focused small-business sites and I’m offering an introductory $350 price to a few US businesses. Would you be open to seeing a quick, no-pressure idea?",
    createdAt: iso, updatedAt: iso,
  },
  {
    id: "message-followup", prospectId: "prospect-arkansas-hvac", campaignId: demoCampaign.id, channel: "facebook",
    kind: "FOLLOW_UP_1", status: "DRAFT", scheduledFor: day(0), recommendedLocalTime: "9:00 AM – 11:00 AM CDT",
    body: "Hi again — just following up on the website idea I sent for Arkansas Comfort Co. I’d be glad to sketch a simple direction focused on making quote requests easier on mobile. No rush at all; should I send it over?",
    createdAt: iso, updatedAt: iso,
  },
];

export const initialState: AppState = {
  campaigns: [demoCampaign],
  prospects: demoProspects,
  messages: demoMessages,
  activities: [
    { id: "activity-1", prospectId: "prospect-el-alamo", type: "ANALYZED", label: "Analyse démo créée", createdAt: iso },
    { id: "activity-2", prospectId: "prospect-arkansas-hvac", type: "CONTACTED", label: "Message Facebook marqué comme envoyé", createdAt: day(-3) },
  ],
  deals: [],
};
