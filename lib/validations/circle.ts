// LIMIT_SYNC_TAG: v1.0.2
// These values MUST mirror the pub const declarations in contracts/ajo-circle/src/lib.rs.
// The CI script scripts/check-limit-sync.mjs enforces this automatically.
// Treat the Rust contract as the source of truth — update there first, then here.

import { z } from "zod";

// ---------------------------------------------------------------------------
// Canonical limits (mirrored from lib.rs)
// ---------------------------------------------------------------------------

/** Maximum number of members allowed in a single circle (including organizer). */
export const MAX_MEMBERS = 20;

/** Minimum contribution amount in stroops (1 XLM = 10_000_000 stroops). */
export const MIN_CONTRIBUTION_AMOUNT = 10_000_000;

/** Maximum contribution amount in stroops (10,000 XLM). */
export const MAX_CONTRIBUTION_AMOUNT = 100_000_000_000;

/** Minimum frequency between rounds, in days. */
export const MIN_FREQUENCY_DAYS = 1;

/** Maximum frequency between rounds, in days. */
export const MAX_FREQUENCY_DAYS = 365;

/** Minimum number of rounds a circle must run. */
export const MIN_ROUNDS = 2;

/** Maximum number of rounds a circle can run (must equal MAX_MEMBERS). */
export const MAX_ROUNDS = 20;

/** Early-withdrawal penalty percentage. */
export const WITHDRAWAL_PENALTY_PERCENT = 10;

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

export const createCircleSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  contributionAmount: z
    .number()
    .int("Must be an integer (stroops)")
    .min(MIN_CONTRIBUTION_AMOUNT, `Minimum contribution is ${MIN_CONTRIBUTION_AMOUNT} stroops`)
    .max(MAX_CONTRIBUTION_AMOUNT, `Maximum contribution is ${MAX_CONTRIBUTION_AMOUNT} stroops`),
  contributionFrequencyDays: z
    .number()
    .int()
    .min(MIN_FREQUENCY_DAYS, `Minimum frequency is ${MIN_FREQUENCY_DAYS} day`)
    .max(MAX_FREQUENCY_DAYS, `Maximum frequency is ${MAX_FREQUENCY_DAYS} days`),
  maxRounds: z
    .number()
    .int()
    .min(MIN_ROUNDS, `Minimum rounds is ${MIN_ROUNDS}`)
    .max(MAX_ROUNDS, `Maximum rounds is ${MAX_ROUNDS}`),
});

export const contributeSchema = z.object({
  amount: z
    .number()
    .int("Must be an integer (stroops)")
    .min(MIN_CONTRIBUTION_AMOUNT, `Minimum contribution is ${MIN_CONTRIBUTION_AMOUNT} stroops`)
    .max(MAX_CONTRIBUTION_AMOUNT, `Maximum contribution is ${MAX_CONTRIBUTION_AMOUNT} stroops`),
});

export type CreateCircleInput = z.infer<typeof createCircleSchema>;
export type ContributeInput = z.infer<typeof contributeSchema>;
