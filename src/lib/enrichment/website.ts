import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ProspectEnrichmentProvider } from "@/lib/enrichment/contracts";
import type { EnrichmentEvidence, WebsiteType } from "@/lib/types";

const linkInBioHosts = ["linktr.ee", "beacons.ai", "linkin.bio", "campsite.bio", "taplink.cc", "bio.site", "lnk.bio", "solo.to"];
const socialHosts = ["instagram.com", "facebook.com", "fb.com", "tiktok.com", "x.com", "twitter.com", "youtube.com", "linkedin.com"];
const marketplaceHosts = ["yelp.com", "tripadvisor.com", "doordash.com", "ubereats.com", "grubhub.com"];
const bookingHosts = ["opentable.com", "resy.com", "toasttab.com", "chownow.com", "square.site"];

function matchesHost(hostname: string, hosts: string[]) {
  return hosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function classifyWebsiteUrl(value: string | undefined): WebsiteType {
  if (!value) return "unknown";
  try {
    const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (matchesHost(hostname, linkInBioHosts)) return "link_in_bio";
    if (matchesHost(hostname, socialHosts)) return "social_profile";
    if (matchesHost(hostname, marketplaceHosts)) return "marketplace";
    if (matchesHost(hostname, bookingHosts)) return "booking_platform";
    return hostname ? "dedicated" : "unknown";
  } catch {
    return "unknown";
  }
}

function isPrivateAddress(address: string) {
  if (address === "::1" || address === "0:0:0:0:0:0:0:1") return true;
  if (address.toLowerCase().startsWith("fe80:") || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd")) return true;
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const ipv4 = mapped ?? (isIP(address) === 4 ? address : undefined);
  if (!ipv4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127);
}

type ResolveHostname = (hostname: string) => Promise<string[]>;

async function defaultResolveHostname(hostname: string) {
  if (isIP(hostname)) return [hostname];
  return (await lookup(hostname, { all: true })).map((item) => item.address);
}

async function assertPublicUrl(value: string, resolveHostname: ResolveHostname) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Protocole non autorisé");
  const addresses = await resolveHostname(url.hostname);
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new Error("Adresse non publique");
  return url;
}

export class WebsiteInspectionProvider implements ProspectEnrichmentProvider {
  readonly id = "website_inspection";
  readonly cacheTtlMs = 6 * 60 * 60 * 1000;
  private readonly options: {
    fetchImpl?: typeof fetch;
    resolveHostname?: ResolveHostname;
    timeoutMs?: number;
  };
  constructor(options: {
    fetchImpl?: typeof fetch;
    resolveHostname?: ResolveHostname;
    timeoutMs?: number;
  } = {}) { this.options = options; }

  async enrich(prospect: Parameters<ProspectEnrichmentProvider["enrich"]>[0], fetchedAt: string) {
    if (!prospect.websiteUrl) return { status: "skipped" as const, message: "Aucune URL de site" };
    const originalType = classifyWebsiteUrl(prospect.websiteUrl);
    const platformOnly = originalType !== "dedicated" && originalType !== "unknown";
    let finalUrl = prospect.websiteUrl;
    let reachable = false;
    try {
      const fetchImpl = this.options.fetchImpl ?? fetch;
      const resolveHostname = this.options.resolveHostname ?? defaultResolveHostname;
      for (let redirect = 0; redirect < 5; redirect++) {
        const current = await assertPublicUrl(finalUrl, resolveHostname);
        const response = await fetchImpl(current, {
          method: "GET",
          redirect: "manual",
          signal: AbortSignal.timeout(this.options.timeoutMs ?? 7_000),
          headers: { "User-Agent": "BienEnLigne-Enrichment/1.0", Accept: "text/html,application/xhtml+xml" },
        });
        await response.body?.cancel();
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) break;
          finalUrl = new URL(location, current).toString();
          continue;
        }
        reachable = response.ok;
        break;
      }
    } catch {
      if (!platformOnly) return { status: "error" as const, message: "Inspection du site indisponible" };
    }
    const websiteType = classifyWebsiteUrl(finalUrl) === "unknown" ? originalType : classifyWebsiteUrl(finalUrl);
    const hasWebsite = websiteType === "dedicated" ? (reachable ? true : undefined) : websiteType === "unknown" ? undefined : false;
    const source = { kind: "direct_inspection" as const, provider: this.id, label: "Inspection directe du site", url: finalUrl };
    const evidence: EnrichmentEvidence[] = [
      { field: "websiteType", value: websiteType, source, fetchedAt, confidence: platformOnly ? 0.99 : 0.9 },
      { field: "websiteHttps", value: new URL(finalUrl).protocol === "https:", source, fetchedAt, confidence: 1 },
      ...(hasWebsite === undefined ? [] : [{ field: "hasWebsite" as const, value: hasWebsite, source, fetchedAt, confidence: 0.95 }]),
    ];
    return { status: "success" as const, evidence, message: reachable ? "URL inspectée" : "Type déduit du domaine public" };
  }
}
