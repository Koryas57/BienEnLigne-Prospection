import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { initialState } from "@/lib/demo-data";
import { loadWorkspace } from "@/lib/data/supabase-repository";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

function WorkspaceLoading() {
  return <main className="app-loading" role="status" aria-live="polite">
    <div className="workspace-loading-card">
      <span className="workspace-loading-spinner" aria-hidden="true" />
      <strong>Connexion à votre espace...</strong>
      <span>Chargement de vos données synchronisées.</span>
    </div>
  </main>;
}

async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;
    if (!userId) redirect("/login");
    const initialData = await loadWorkspace(supabase, userId);
    return <AppShell initialData={initialData} mode="supabase" userId={userId}>{children}</AppShell>;
  }
  return <AppShell initialData={initialState} mode="demo">{children}</AppShell>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<WorkspaceLoading />}><AuthenticatedWorkspace>{children}</AuthenticatedWorkspace></Suspense>;
}
