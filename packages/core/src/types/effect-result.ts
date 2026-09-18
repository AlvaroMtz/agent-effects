import type { JsonValue, SerializableError } from "./support.js";

/**
 * All six resolution states ship in the 0.0.1 type model (ADR-0005);
 * consumers must handle all six even though 0.0.1 produces only
 * `ok`, `error`, and `unknown`.
 */
export type EffectResolutionState =
  | "ok"
  | "error"
  | "pending"
  | "cancelled"
  | "denied"
  | "unknown";

/** Stable error codes (ADR-0005); `policy-denied` is not produced in 0.0.1. */
export type EffectErrorCode =
  | "invalid-request"
  | "execution-failed"
  | "persistence-failed"
  | "run-failed"
  | "cancelled"
  | "policy-denied";

export interface EffectResultOk {
  effectId: string;
  status: "ok";
  output: JsonValue;
  metadata?: Record<string, JsonValue>;
}

export interface EffectResultError {
  effectId: string;
  status: "error";
  error: SerializableError;
  retryable?: boolean;
  metadata?: Record<string, JsonValue>;
}

export interface EffectResultPending {
  effectId: string;
  status: "pending";
}

export interface EffectResultCancelled {
  effectId: string;
  status: "cancelled";
}

export interface EffectResultDenied {
  effectId: string;
  status: "denied";
}

export interface EffectResultUnknown {
  effectId: string;
  status: "unknown";
}

export type EffectResult =
  | EffectResultOk
  | EffectResultError
  | EffectResultPending
  | EffectResultCancelled
  | EffectResultDenied
  | EffectResultUnknown;
