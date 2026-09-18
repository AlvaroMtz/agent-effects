import type { Effect } from "./effect.js";
import type { EffectResult } from "./effect-result.js";

/**
 * Dispatches an effect to the outside world. The runtime calls an
 * executor at most once per recorded occurrence (ADR-0007); executors
 * must be idempotent-unfriendly, which is why the journal, not the
 * executor, decides what has already happened.
 */
export interface EffectExecutor {
  execute(effect: Effect): Promise<EffectResult>;
}
