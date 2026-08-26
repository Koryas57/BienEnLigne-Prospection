import { NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

const credentials = z.object({ email: z.string().email(), password: z.string().min(8) });

export async function POST(request: Request) {
  if (!hasSupabaseConfig()) return NextResponse.redirect(new URL("/login?error=not-configured", request.url), 303);
  const form = await request.formData();
  const parsed = credentials.safeParse({ email: form.get("email"), password: form.get("password") });
  if (!parsed.success) return NextResponse.redirect(new URL("/login?error=invalid-input", request.url), 303);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  return NextResponse.redirect(new URL(error ? "/login?error=invalid-credentials" : "/dashboard", request.url), 303);
}
