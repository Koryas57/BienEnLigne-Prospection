import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  if (hasSupabaseConfig()) {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) redirect("/login");
  }
  return <Suspense fallback={<div className="app-loading">Bien En Ligne</div>}><AppShell>{children}</AppShell></Suspense>;
}
