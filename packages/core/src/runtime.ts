import type { Effect } from "./types/effect.js";
import type {
  EffectErrorCode,
  EffectResult,
  EffectResultError,
  EffectResultOk,
} from "./types/effect-result.js";
import type { EffectExecutor } from "./types/executor.js";
import type { ExecutionOutcome } from "./types/execution-outcome.js";
import type { EffectJournal } from "./types/journal.js";
import { JournalInvariantError } from "./types/journal.js";

/**
 * Coordinates journal-first resolution. `resolve` is the only operation in
 * 0.0.1: there is no run lifecycle and no shutdown, because a synchronous
 * factory that never sees a run id cannot honestly write run entries
 * (design §14).
 */
export interface EffectRuntime {
  resolve(effect: Effect): Promise<EffectResult>;
}

/**
 * Builds a runtime over an executor and a journal.
 *
 * `resolve` runs the pipeline in this order
 * (`specs/effect-core/spec.md` → Requirement: Resolution Consults the
 * Journal First):
 *
 * 1. validate the producer-assigned id, before any write or dispatch;
 * 2. ask the journal for a recorded result and return it unchanged if
 *    there is one — the executor is never invoked for an occurrence that
 *    already resolved (ADR-0007);
 * 3. record the request fact;
 * 4. make exactly one execution attempt and stamp the effect's identity
 *    onto what the executor reported;
 * 5. record the resolution fact and return the result.
 */
export function createRuntime(config: {
  executor: EffectExecutor;
  journal: EffectJournal;
}): EffectRuntime {
  const { executor, journal } = config;

  return {
    async resolve(effect: Effect): Promise<EffectResult> {
      if (!hasUsableId(effect)) {
        return errorResult(
          "",
          "invalid-request",
          "effect id is required and must be a non-empty string",
        );
      }

      const recorded = await journal.findResult(effect.id);
      if (recorded !== undefined) {
        return recorded;
      }

      try {
        await journal.append({
          kind: "effect.requested",
          runId: effect.runId,
          effectId: effect.id,
        });
      } catch (failure) {
        return mapRequestFailure(effect.id, failure);
      }

      const outcome = await attemptExecution(executor, effect);
      const result = toResult(effect.id, outcome);

      try {
        await journal.append({
          kind: "effect.resolved",
          runId: effect.runId,
          effectId: effect.id,
          result,
        });
      } catch {
        // The executor already ran. Reporting ok or error would claim
        // knowledge the runtime does not have (ADR-0007 §3).
        return { effectId: effect.id, status: "unknown" };
      }

      return result;
    },
  };
}

/**
 * Identity is validated at the boundary: an absent, non-string or blank id
 * is rejected before any journal write and before dispatch
 * (`specs/effect-core/spec.md` → Requirement: Identity Is Validated at the
 * Boundary).
 */
function hasUsableId(effect: Effect): boolean {
  return typeof effect.id === "string" && effect.id.trim() !== "";
}

/** Makes exactly one execution attempt, keeping native exceptions inside. */
async function attemptExecution(
  executor: EffectExecutor,
  effect: Effect,
): Promise<ExecutionOutcome> {
  try {
    return await executor.execute(effect);
  } catch (failure) {
    return {
      status: "error",
      error: { code: "execution-failed", message: messageOf(failure) },
    };
  }
}

/**
 * Attaches the identity the runtime owns to what the executor reported
 * (ADR-0011). The executor never names the effect, so a recorded
 * resolution cannot disagree with the entry that holds it.
 */
function toResult(
  effectId: string,
  outcome: ExecutionOutcome,
): EffectResultOk | EffectResultError {
  return outcome.status === "ok"
    ? { effectId, ...outcome }
    : { effectId, ...outcome };
}

/**
 * A rejected invariant is an identity problem, so it surfaces as an
 * invalid request; anything else the journal throws is a storage failure
 * (design §7.3).
 */
function mapRequestFailure(effectId: string, failure: unknown): EffectResultError {
  return failure instanceof JournalInvariantError
    ? errorResult(effectId, "invalid-request", failure.message)
    : errorResult(effectId, "persistence-failed", messageOf(failure));
}

function errorResult(
  effectId: string,
  code: EffectErrorCode,
  message: string,
): EffectResultError {
  return { effectId, status: "error", error: { code, message } };
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}
