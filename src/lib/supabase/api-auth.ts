import "server-only";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function hasAuthenticatedApiSession() {
  if (!hasSupabaseConfig()) return true;
  try {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.auth.getClaims();
    return Boolean(data?.claims);
  } catch {
    return false;
  }
}
