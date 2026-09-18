import type { Effect, EffectJournal, EffectResult, EffectRuntime } from "@agent-effects/core";
import { ReplayMismatchError, ReplayMissError } from "./errors.js";
import { canonicalize } from "./fingerprint.js";

/**
 * Builds a runtime that resolves effects from a journal and never executes
 * anything: **effect-level deterministic replay** (ADR-0004 §3 fixes that
 * wording).
 *
 * It takes a journal and nothing else. There is no executor seam, so an
 * external call during replay is not merely forbidden by policy — it is
 * unrepresentable, which is what makes "zero IO" checkable rather than
 * promised.
 *
 * `strict` is the only mode in 0.0.3 (ADR-0004 §2): an occurrence with no
 * recorded resolution, or one whose effect differs from what was recorded,
 * is a hard failure. `passthrough` and `mock` are deferred past 0.1.0
 * because both silently blend recorded and fresh results.
 */
export function createReplayRuntime(config: { journal: EffectJournal }): EffectRuntime {
  const { journal } = config;

  return {
    async resolve(effect: Effect): Promise<EffectResult> {
      if (typeof effect.id !== "string" || effect.id.trim() === "") {
        throw new ReplayMissError(
          "invalid-request",
          effect.runId,
          String(effect.id),
          "an effect without a usable id cannot address a recorded occurrence",
        );
      }

      const recorded = await journal.findRequest(effect.runId, effect.id);
      if (recorded === undefined) {
        throw new ReplayMissError(
          "no-recorded-request",
          effect.runId,
          effect.id,
          `replaying ${effect.runId}/${effect.id}: the journal has no recorded request`,
        );
      }

      assertSameEffect(recorded, effect);

      const result = await journal.findResult(effect.runId, effect.id);
      if (result === undefined) {
        throw new ReplayMissError(
          "no-recorded-resolution",
          effect.runId,
          effect.id,
          `replaying ${effect.runId}/${effect.id}: the occurrence was requested but never resolved`,
        );
      }

      return result;
    },
  };
}

/**
 * Compares what is being replayed against what was recorded, on the fields
 * the agent actually asked for. `metadata` is excluded: adapter data is
 * outside the portable contract (ADR-0008), so a different provider request
 * id is not a divergence in the run.
 */
function assertSameEffect(recorded: Effect, requested: Effect): void {
  if (recorded.type !== requested.type) {
    throw new ReplayMismatchError(
      requested.runId,
      requested.id,
      "type",
      recorded.type,
      requested.type,
    );
  }

  const recordedInput = canonicalize(recorded.input);
  const requestedInput = canonicalize(requested.input);
  if (recordedInput !== requestedInput) {
    throw new ReplayMismatchError(
      requested.runId,
      requested.id,
      "input",
      recordedInput,
      requestedInput,
    );
  }
}
