export type RuntimeDataMode = "supabase" | "demo" | "configuration_error";

export function hasCompleteSupabaseConfig(url: string | undefined, anonKey: string | undefined) {
  return Boolean(url?.trim() && anonKey?.trim());
}

export function resolveRuntimeDataMode(nodeEnv: string | undefined, supabaseConfigured: boolean): RuntimeDataMode {
  if (supabaseConfigured) return "supabase";
  return nodeEnv === "development" ? "demo" : "configuration_error";
}
