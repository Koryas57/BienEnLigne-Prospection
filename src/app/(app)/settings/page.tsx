"use client";

import Link from "next/link";
import { Database, KeyRound, RotateCcw, ShieldCheck } from "lucide-react";
import { useAppStore } from "@/components/app-store";
import { Badge, Card, PageHeader } from "@/components/ui";

export default function SettingsPage() {
  const { resetDemo } = useAppStore();
  return <>
    <PageHeader eyebrow="Configuration" title="Réglages" description="Les valeurs ci-dessous préparent la connexion aux services réels sans bloquer le mode local." />
    <div className="grid grid-2">
      <Card className="card-pad"><div className="section-heading"><div><p className="eyebrow">Stockage</p><h2>Mode local</h2></div><Badge tone="green">Actif</Badge></div><p className="muted">Les modifications sont enregistrées dans ce navigateur. Branchez Supabase pour synchroniser plusieurs appareils.</p><button className="button danger" onClick={() => { if (window.confirm("Réinitialiser toutes les données locales avec les données de démonstration ?")) resetDemo(); }}><RotateCcw size={16} />Réinitialiser la démo</button></Card>
      <Card className="card-pad"><div className="section-heading"><div><p className="eyebrow">Intelligence artificielle</p><h2>OpenAI</h2></div><Badge tone="amber">Fallback démo</Badge></div><p className="muted">Sans clé serveur, les analyses et messages restent explicitement marqués « Demo AI result ».</p><div className="detail-row"><span>Clé attendue</span><strong>OPENAI_API_KEY</strong></div></Card>
      <Card className="card-pad"><div className="section-heading"><h2>Supabase</h2><Database size={19} className="muted" /></div><p className="muted">Authentification, PostgreSQL, RLS et audit sont prêts dans la migration.</p><div className="detail-list"><div className="detail-row"><span>URL projet</span><strong>NEXT_PUBLIC_SUPABASE_URL</strong></div><div className="detail-row"><span>Clé publique</span><strong>NEXT_PUBLIC_SUPABASE_ANON_KEY</strong></div></div></Card>
      <Card className="card-pad"><div className="section-heading"><h2>Sécurité d’envoi</h2><ShieldCheck size={19} color="var(--brand)" /></div><p className="muted">Aucun provider d’envoi n’est actif. La contrainte d’approbation est vérifiée dans le modèle métier et la base.</p><Link className="button" href="/approval"><KeyRound size={16} />Voir la file de validation</Link></Card>
    </div>
    <Card className="card-pad section"><h2>Cadence de relance</h2><div className="form-grid"><div className="field"><label>Follow-up 1</label><input className="input" value="J+3" readOnly /></div><div className="field"><label>Follow-up 2</label><input className="input" value="J+8" readOnly /></div></div><p className="small muted">Après la seconde relance : STOP. Toute réponse ou statut DO_NOT_CONTACT annule les relances restantes.</p></Card>
  </>;
}
