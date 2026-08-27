import "server-only";
import { resolveRuntimeDataMode } from "@/lib/runtime-mode";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function hasAuthenticatedApiSession() {
  if (!hasSupabaseConfig()) return resolveRuntimeDataMode(process.env.NODE_ENV, false) === "demo";
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims);
  } catch {
    return false;
  }
}
