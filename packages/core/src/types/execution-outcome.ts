import type { JsonValue, SerializableError } from "./support.js";

/**
 * What an executor reports about the outside world, and nothing more
 * (ADR-0011). It carries no effect id: identity is producer-assigned and
 * the runtime stamps it, so an executor cannot name a different effect
 * than the one it was handed.
 *
 * It also carries no `pending`, `cancelled` or `denied`. Those describe
 * lifecycle, cancellation and policy — machinery an executor cannot
 * observe. `EffectResult` still represents all six states for consumers;
 * only this seam is narrowed.
 */
export type ExecutionOutcome = ExecutionSuccess | ExecutionFailure;

export type ExecutionSuccess = {
  status: "ok";
  output: JsonValue;
  /** Adapter data the core never interprets (ADR-0008). */
  metadata?: Record<string, JsonValue>;
};

export type ExecutionFailure = {
  status: "error";
  error: SerializableError;
  retryable?: boolean;
  metadata?: Record<string, JsonValue>;
};
