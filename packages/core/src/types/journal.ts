import type {
  EffectResult,
  EffectResultError,
  EffectResultOk,
} from "./effect-result.js";

/**
 * Envelope fields carried by every journal entry. `sequence` is strictly
 * monotonic per run and assigned at append time (ADR-0003); `schemaVersion`
 * is written at creation (ADR-0009). Not part of the public barrel.
 */
interface JournalEnvelope {
  sequence: number;
  schemaVersion: string;
  timestamp: string;
  runId: string;
}

/**
 * The four 0.0.1 entry kinds (proposal Decision 4). New kinds, including
 * `run.failed`, arrive additively in 0.0.2 (ADR-0009 versioning).
 */
export type JournalEntryKind =
  | "run.started"
  | "effect.requested"
  | "effect.resolved"
  | "run.completed";

interface RunStartedEntry extends JournalEnvelope {
  kind: "run.started";
}

interface EffectRequestedEntry extends JournalEnvelope {
  kind: "effect.requested";
  effectId: string;
}

interface EffectResolvedEntry extends JournalEnvelope {
  kind: "effect.resolved";
  effectId: string;
  /** Resolved entries record the full terminal result; pending is never journaled. */
  result: EffectResultOk | EffectResultError;
}

interface RunCompletedEntry extends JournalEnvelope {
  kind: "run.completed";
}

export type JournalEntry =
  | RunStartedEntry
  | EffectRequestedEntry
  | EffectResolvedEntry
  | RunCompletedEntry;

/** `Omit` that keeps the discriminated union open instead of collapsing it. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, K>
  : never;

/**
 * What a caller hands to `append`: the entry without the envelope fields
 * the writer stamps itself. `sequence` is assigned at append time and is
 * strictly monotonic per run (ADR-0003); `schemaVersion` and `timestamp`
 * are written at creation by the journal (ADR-0009). Callers cannot forge
 * any of the three.
 */
export type JournalEntryDraft = DistributiveOmit<
  JournalEntry,
  "sequence" | "schemaVersion" | "timestamp"
>;

/**
 * Thrown by journal writers when an append would violate a journal
 * invariant (ADR-0003). Core owns the error type so every backend rejects
 * identically; the runtime maps `duplicate-effect-id` and
 * `missing-request` to `invalid-request` results.
 */
export class JournalInvariantError extends Error {
  readonly code: "duplicate-effect-id" | "missing-request";

  constructor(code: "duplicate-effect-id" | "missing-request", message: string) {
    super(message);
    this.name = "JournalInvariantError";
    this.code = code;
  }
}

/**
 * The journal seam: append-only writes plus recorded-result lookup
 * (ADR-0007). Corrections happen only by appending, never by mutation.
 */
export interface EffectJournal {
  append(entry: JournalEntryDraft): Promise<void>;
  /**
   * Looks a resolution up by its run-scoped address. Identity is unique
   * within a run, not globally (ADR-0002), so `run_A/fx_1` and `run_B/fx_1`
   * are two occurrences and both are addressable (ADR-0012 §1).
   */
  findResult(runId: string, effectId: string): Promise<EffectResult | undefined>;
}
