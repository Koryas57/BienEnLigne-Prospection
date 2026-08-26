import type { SupabaseClient } from "@supabase/supabase-js";

export const JWT_ISSUED_AT_FUTURE = "JWT issued at future";
export const JWT_CLOCK_SKEW_BACKOFF_MS = [750, 1_500, 3_000, 1_500] as const;
export const JWT_CLOCK_SKEW_MAX_WAIT_MS = JWT_CLOCK_SKEW_BACKOFF_MS.reduce((total, delay) => total + delay, 0);

type RetryOptions = {
  delaysMs?: readonly number[];
  sleep?: (delayMs: number) => Promise<void>;
};

export function isJwtIssuedAtFutureError(error: unknown): error is { message: string } {
  return Boolean(error && typeof error === "object" && "message" in error && error.message === JWT_ISSUED_AT_FUTURE);
}

export async function withJwtClockSkewRetry<T>(operation: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const delays = options.delaysMs ?? JWT_CLOCK_SKEW_BACKOFF_MS;
  const sleep = options.sleep ?? ((delayMs: number) => new Promise<void>((resolve) => setTimeout(resolve, delayMs)));

  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      if (!isJwtIssuedAtFutureError(error) || attempt >= delays.length) throw error;
      await sleep(delays[attempt]);
    }
  }
}

export async function waitForSupabaseSessionReadiness(supabase: SupabaseClient, userId: string) {
  await withJwtClockSkewRetry(async () => {
    const { error } = await supabase.from("profiles").select("id").eq("id", userId).single();
    if (error) throw error;
  });
}
