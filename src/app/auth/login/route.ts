import { NextResponse } from "next/server";
import { parseLoginCredentials } from "@/lib/auth/login-credentials";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";
import { waitForSupabaseSessionReadiness } from "@/lib/supabase/jwt-clock-skew";

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL("/login?error=not-configured", request.url), 303);
  const form = await request.formData();
  const parsed = parseLoginCredentials(form);
  if (!parsed.success) return NextResponse.redirect(new URL("/login?error=invalid-input", request.url), 303);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return NextResponse.redirect(new URL("/login?error=invalid-credentials", request.url), 303);
  await waitForSupabaseSessionReadiness(supabase, data.user.id);
  return NextResponse.redirect(new URL("/dashboard", request.url), 303);
}
