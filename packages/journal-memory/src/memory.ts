import {
  JournalInvariantError,
  type EffectJournal,
  type EffectResult,
  type JournalEntry,
  type JournalEntryDraft,
} from "@agent-effects/core";

/** Schema version stamped on every entry at creation (ADR-0009, design §9.2). */
const SCHEMA_VERSION = "1.0";

/**
 * Process-local, append-only `EffectJournal` backend.
 *
 * Entries live in memory for the life of the process and nowhere else:
 * the backend makes no durability claim and consults no external storage
 * (`specs/journal/spec.md` → Requirement: The In-Memory Backend Is
 * Process-Local).
 *
 * One instance holds any number of runs: entries are keyed by `runId`,
 * sequences are per run, and lookups are addressed by `(runId, effectId)`
 * (ADR-0012 §1). The 0.0.1 "one journal instance per run" convention is
 * gone; nothing depended on it except the ambiguity it hid.
 *
 * Entries are sensitive by default: nothing here filters, redacts, or
 * rewrites a payload, and no entry is ever mutated or removed once
 * appended (ADR-0003, ADR-0010).
 */
export class MemoryEffectJournal implements EffectJournal {
  readonly #runs = new Map<string, JournalEntry[]>();

  /**
   * Records an entry after checking both append-time invariants. A
   * violated invariant rejects with `JournalInvariantError` and nothing
   * is written (`specs/journal/spec.md` → Requirement: Append-Time
   * Invariants Are Enforced by the Writer).
   */
  async append(entry: JournalEntryDraft): Promise<void> {
    const entries = this.#runs.get(entry.runId) ?? [];

    rejectRunIdMismatch(entry);
    rejectDuplicateEffectId(entry, entries);
    rejectMissingRequest(entry, entries);

    entries.push({
      ...entry,
      sequence: entries.length + 1,
      schemaVersion: SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
    });
    this.#runs.set(entry.runId, entries);
  }

  /**
   * Returns the result recorded for `(runId, effectId)`, or `undefined`
   * when no resolution was recorded in that run. Never fabricates a result for an unresolved
   * effect (`specs/journal/spec.md` → Requirement: Lookup Returns the
   * Recorded Resolution or Its Absence).
   */
  async findResult(runId: string, effectId: string): Promise<EffectResult | undefined> {
    const resolved = (this.#runs.get(runId) ?? []).find(
      (entry) => entry.kind === "effect.resolved" && entry.effectId === effectId,
    );
    return resolved?.kind === "effect.resolved" ? resolved.result : undefined;
  }

  /**
   * Reads a run's entries in append order. The returned entries are the
   * recorded ones, unchanged (`specs/journal/spec.md` → Requirement:
   * Append-Only Source of Truth).
   */
  entries(runId: string): readonly JournalEntry[] {
    return this.#runs.get(runId) ?? [];
  }
}

/**
 * Invariant 0: a request entry carries an effect from its own run
 * (ADR-0012 §2).
 */
function rejectRunIdMismatch(entry: JournalEntryDraft): void {
  if (entry.kind !== "effect.requested" || entry.effect.runId === entry.runId) {
    return;
  }
  throw new JournalInvariantError(
    "run-id-mismatch",
    `effect ${entry.effect.id} belongs to run ${entry.effect.runId}, not ${entry.runId}`,
  );
}

/**
 * Invariant 1: an effect id is requested at most once within a run
 * (ADR-0002, ADR-0003 §4).
 */
function rejectDuplicateEffectId(
  entry: JournalEntryDraft,
  entries: readonly JournalEntry[],
): void {
  if (entry.kind !== "effect.requested") {
    return;
  }
  const alreadyRequested = entries.some(
    (recorded) =>
      recorded.kind === "effect.requested" && recorded.effect.id === entry.effect.id,
  );
  if (alreadyRequested) {
    throw new JournalInvariantError(
      "duplicate-effect-id",
      `effect ${entry.effect.id} was already requested in run ${entry.runId}`,
    );
  }
}

/**
 * Invariant 2: a resolution requires a prior request for the same effect
 * within the run (ADR-0003 §4).
 */
function rejectMissingRequest(
  entry: JournalEntryDraft,
  entries: readonly JournalEntry[],
): void {
  if (entry.kind !== "effect.resolved") {
    return;
  }
  const wasRequested = entries.some(
    (recorded) =>
      recorded.kind === "effect.requested" && recorded.effect.id === entry.effectId,
  );
  if (!wasRequested) {
    throw new JournalInvariantError(
      "missing-request",
      `effect ${entry.effectId} was never requested in run ${entry.runId}`,
    );
  }
}
