"use client";

import { useEffect, useState } from "react";
import { Bot, LoaderCircle } from "lucide-react";
import { Badge, Card } from "@/components/ui";
import type { OpenAIErrorPayload, OpenAIPublicStatus } from "@/lib/ai/contracts";
import type { DataMode } from "@/lib/types";

type TestResult = { success: boolean; message: string };

function responseError(payload: unknown, fallback: string) {
  return (payload as Partial<OpenAIErrorPayload> | null)?.error?.message || fallback;
}

export function OpenAIStatusCard({ mode }: { mode: DataMode }) {
  const [status, setStatus] = useState<OpenAIPublicStatus>();
  const [statusError, setStatusError] = useState<string>();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>();

  useEffect(() => {
    let cancelled = false;
    async function loadStatus() {
      try {
        const response = await fetch("/api/ai/status", { cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) throw new Error(responseError(payload, "Impossible de vérifier la configuration OpenAI."));
        if (!cancelled) setStatus((payload as { data: OpenAIPublicStatus }).data);
      } catch (error) {
        if (!cancelled) setStatusError(error instanceof Error ? error.message : "Impossible de vérifier la configuration OpenAI.");
      }
    }
    void loadStatus();
    return () => { cancelled = true; };
  }, []);

  async function testConnection() {
    setTesting(true);
    setTestResult(undefined);
    try {
      const response = await fetch("/api/ai/status", { method: "POST" });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(responseError(payload, "Le test OpenAI a échoué."));
      const data = (payload as { data: OpenAIPublicStatus & { message: string } }).data;
      setStatus({ configured: data.configured, model: data.model });
      setTestResult({ success: true, message: data.message });
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : "Le test OpenAI a échoué." });
    } finally {
      setTesting(false);
    }
  }

  const badge = statusError ? <Badge tone="red">État indisponible</Badge>
    : status?.configured ? <Badge tone="green">OpenAI configuré</Badge>
      : status ? <Badge tone="amber">Fallback démo</Badge> : <Badge>Vérification…</Badge>;

  return <Card className="card-pad">
    <div className="section-heading"><div><p className="eyebrow">Intelligence artificielle</p><h2>OpenAI</h2></div>{badge}</div>
    <p className="muted">{status?.configured
      ? "Les analyses et messages utilisent la configuration OpenAI du serveur."
      : mode === "supabase"
        ? "Le fallback démo est désactivé dans cet espace Supabase. Configurez la clé serveur avant toute génération."
        : "Sans clé serveur, les analyses et messages restent explicitement marqués « Demo AI result »."}</p>
    <div className="detail-row"><span>Modèle :</span><strong>{status?.model ?? "Vérification…"}</strong></div>
    <button className="button" type="button" disabled={testing} onClick={testConnection}>
      {testing ? <LoaderCircle className="spin" size={17} /> : <Bot size={17} />}{testing ? "Test en cours…" : "Tester OpenAI"}
    </button>
    {statusError ? <p className="form-error" role="alert">{statusError}</p> : null}
    {testResult ? <p className={testResult.success ? "small muted" : "form-error"} role={testResult.success ? "status" : "alert"}>{testResult.message}</p> : null}
  </Card>;
}
