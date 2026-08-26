import { NextResponse } from "next/server";
import { createSupabaseServerClient, hasSupabaseConfig } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (hasSupabaseConfig()) { const supabase = await createSupabaseServerClient(); await supabase.auth.signOut(); }
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
