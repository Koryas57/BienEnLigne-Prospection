import assert from "node:assert/strict";
import test from "node:test";
import {
  JWT_CLOCK_SKEW_BACKOFF_MS,
  JWT_ISSUED_AT_FUTURE,
  withJwtClockSkewRetry,
} from "../src/lib/supabase/jwt-clock-skew.ts";

const clockSkewError = () => new Error(JWT_ISSUED_AT_FUTURE);

test("réessaie une fois puis renvoie le résultat", async () => {
  let attempts = 0;
  const delays = [];
  const result = await withJwtClockSkewRetry(async () => {
    attempts += 1;
    if (attempts === 1) throw clockSkewError();
    return "ok";
  }, { sleep: async (delay) => { delays.push(delay); } });
  assert.equal(result, "ok");
  assert.equal(attempts, 2);
  assert.deepEqual(delays, [750]);
});

test("applique le backoff sur plusieurs erreurs transitoires", async () => {
  let attempts = 0;
  const delays = [];
  const result = await withJwtClockSkewRetry(async () => {
    attempts += 1;
    if (attempts <= 3) throw clockSkewError();
    return "ok";
  }, { sleep: async (delay) => { delays.push(delay); } });
  assert.equal(result, "ok");
  assert.equal(attempts, 4);
  assert.deepEqual(delays, [750, 1_500, 3_000]);
});

test("remonte l’erreur après le plafond borné", async () => {
  let attempts = 0;
  const delays = [];
  await assert.rejects(
    withJwtClockSkewRetry(async () => {
      attempts += 1;
      throw clockSkewError();
    }, { sleep: async (delay) => { delays.push(delay); } }),
    (error) => error.message === JWT_ISSUED_AT_FUTURE,
  );
  assert.equal(attempts, JWT_CLOCK_SKEW_BACKOFF_MS.length + 1);
  assert.deepEqual(delays, [...JWT_CLOCK_SKEW_BACKOFF_MS]);
});

test("ne réessaie jamais une autre erreur", async () => {
  let attempts = 0;
  const delays = [];
  const otherError = new Error("Database unavailable");
  await assert.rejects(
    withJwtClockSkewRetry(async () => {
      attempts += 1;
      throw otherError;
    }, { sleep: async (delay) => { delays.push(delay); } }),
    (error) => error === otherError,
  );
  assert.equal(attempts, 1);
  assert.deepEqual(delays, []);
});
