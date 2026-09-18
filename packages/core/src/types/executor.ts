import type { Effect } from "./effect.js";
import type { ExecutionOutcome } from "./execution-outcome.js";

/**
 * Dispatches an effect to the outside world. The runtime calls an
 * executor at most once per recorded occurrence (ADR-0007); the journal,
 * not the executor, decides what has already happened.
 *
 * An executor reports an `ExecutionOutcome`, never an `EffectResult`: it
 * describes what the outside world did, while the runtime owns the
 * identity and the resolution state of the effect (ADR-0011).
 */
export interface EffectExecutor {
  execute(effect: Effect): Promise<ExecutionOutcome>;
}
