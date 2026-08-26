"use client";

import { ChangeEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet, Upload } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Card, EmptyState, PageHeader } from "@/components/ui";

const targets = ["ignore", "businessName", "city", "category", "email", "phone", "websiteUrl", "instagramUrl", "facebookUrl", "googleMapsUrl"] as const;
type Target = (typeof targets)[number];

function parseCsv(text: string) {
  const lines = text.trim().split(/\r?\n/);
  const delimiter = (lines[0]?.match(/;/g)?.length ?? 0) > (lines[0]?.match(/,/g)?.length ?? 0) ? ";" : ",";
  const parse = (line: string) => line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  return { headers: parse(lines[0] ?? ""), rows: lines.slice(1).map(parse).filter((row) => row.some(Boolean)) };
}

export default function ImportPage() {
  const { state, addProspect } = useAppStore();
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<number, Target>>({});
  const [imported, setImported] = useState<number>();
  function fileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    const reader = new FileReader(); reader.onload = () => { const data = parseCsv(String(reader.result)); setHeaders(data.headers); setRows(data.rows); const inferred: Record<number, Target> = {}; data.headers.forEach((header, index) => { inferred[index] = targets.includes(header as Target) ? header as Target : header.toLowerCase().includes("name") ? "businessName" : header.toLowerCase().includes("city") ? "city" : "ignore"; }); setMapping(inferred); }; reader.readAsText(file);
  }
  async function runImport() {
    const campaign = state.campaigns[0]; if (!campaign) return;
    let count = 0;
    for (const row of rows) {
      const value = (target: Target) => row[Number(Object.entries(mapping).find(([, mapped]) => mapped === target)?.[0])] || "";
      if (!value("businessName")) continue;
      const id = await addProspect({ campaignId: campaign.id, businessName: value("businessName"), city: value("city") || campaign.city, state: campaign.state, country: campaign.country, timezone: campaign.timezone, category: value("category") || campaign.sector, email: value("email") || undefined, phone: value("phone") || undefined, websiteUrl: value("websiteUrl") || undefined, instagramUrl: value("instagramUrl") || undefined, facebookUrl: value("facebookUrl") || undefined, googleMapsUrl: value("googleMapsUrl") || undefined, source: "Import CSV", status: "NEW", leadScore: 0, qualificationReason: "À analyser", hasWebsite: value("websiteUrl") ? true : "unknown", websiteMobileFriendly: "unknown", websiteHttps: "unknown", instagramActive: value("instagramUrl") ? "unknown" : false, facebookActive: value("facebookUrl") ? "unknown" : false, googlePresence: value("googleMapsUrl") ? true : "unknown", independentBusiness: "unknown", likelyFranchise: "unknown" }); if (id) count++;
    }
    setImported(count);
  }
  return <>
    <Link href="/prospects" className="button ghost small-button"><ArrowLeft size={16} />Prospects</Link>
    <PageHeader eyebrow="Import V1" title="Importer un CSV" description="Chargez le fichier, associez les colonnes, puis vérifiez l’aperçu avant import." />
    <Card className="card-pad"><label className="button primary" htmlFor="csv"><Upload size={17} />Choisir un fichier CSV</label><input id="csv" type="file" accept=".csv,text/csv" onChange={fileChange} hidden /><p className="small muted section">Les séparateurs virgule et point-virgule sont reconnus. Les fichiers ne quittent pas votre appareil en mode local.</p></Card>
    {headers.length ? <Card className="card-pad section"><div className="section-heading"><h2>Mapping des colonnes</h2><span className="small muted">{rows.length} ligne(s)</span></div><div className="form-grid">{headers.map((header, index) => <div className="field" key={`${header}-${index}`}><label>{header}</label><select className="select" value={mapping[index] ?? "ignore"} onChange={(event) => setMapping((current) => ({ ...current, [index]: event.target.value as Target }))}>{targets.map((target) => <option key={target} value={target}>{target === "ignore" ? "Ignorer" : target}</option>)}</select></div>)}</div><div className="section"><h3>Aperçu</h3><div className="list">{rows.slice(0, 3).map((row, index) => <div className="list-card" key={index}><strong>{row[Number(Object.entries(mapping).find(([, value]) => value === "businessName")?.[0])] || "Nom non mappé"}</strong><p>{row.join(" · ")}</p></div>)}</div></div><div className="form-actions"><button className="button primary" onClick={runImport} disabled={!Object.values(mapping).includes("businessName")}><FileSpreadsheet size={16} />Importer {rows.length} prospects</button></div></Card> : <Card className="section"><EmptyState icon={<FileSpreadsheet size={28} />} title="Votre fichier apparaîtra ici" description="La colonne du nom de l’entreprise est la seule obligatoire." /></Card>}
    {imported !== undefined ? <div className="toast" role="status">{imported} prospect(s) importé(s).</div> : null}
  </>;
}
