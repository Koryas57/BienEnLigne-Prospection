import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { initialState } from "@/lib/demo-data";
import { loadWorkspace } from "@/lib/data/supabase-repository";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    const userId = typeof data?.claims?.sub === "string" ? data.claims.sub : undefined;
    if (!userId) redirect("/login");
    const initialData = await loadWorkspace(supabase, userId);
    return <Suspense fallback={<div className="app-loading">Bien En Ligne</div>}><AppShell initialData={initialData} mode="supabase" userId={userId}>{children}</AppShell></Suspense>;
  }
  return <Suspense fallback={<div className="app-loading">Bien En Ligne</div>}><AppShell initialData={initialState} mode="demo">{children}</AppShell></Suspense>;
}
