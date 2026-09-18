import type { JournalEntryDraft } from "./types/journal.js";
import { JournalInvariantError } from "./types/journal.js";

/**
 * What a writer must be able to answer about the run it is appending to.
 * Backends index this however they like; the invariants do not care.
 */
export interface RunView {
  hasRequest(effectId: string): boolean;
  hasResolution(effectId: string): boolean;
}

/**
 * Enforces the append-time invariants every journal writer shares
 * (ADR-0003 §4, ADR-0012 §2–§3). It lives in core so that each backend
 * rejects identically: the same reasoning that put `JournalInvariantError`
 * here rather than in one backend.
 *
 * Throws before anything is written; a rejected entry is never recorded.
 */
export function assertAppendable(entry: JournalEntryDraft, run: RunView): void {
  if (entry.kind === "effect.requested") {
    if (entry.effect.runId !== entry.runId) {
      throw new JournalInvariantError(
        "run-id-mismatch",
        `effect ${entry.effect.id} belongs to run ${entry.effect.runId}, not ${entry.runId}`,
      );
    }
    if (run.hasRequest(entry.effect.id)) {
      throw new JournalInvariantError(
        "duplicate-effect-id",
        `effect ${entry.effect.id} was already requested in run ${entry.runId}`,
      );
    }
    return;
  }

  if (entry.kind === "effect.resolved") {
    if (!run.hasRequest(entry.effectId)) {
      throw new JournalInvariantError(
        "missing-request",
        `effect ${entry.effectId} was never requested in run ${entry.runId}`,
      );
    }
    if (run.hasResolution(entry.effectId)) {
      throw new JournalInvariantError(
        "duplicate-resolution",
        `effect ${entry.effectId} already has a recorded resolution in run ${entry.runId}`,
      );
    }
  }
}
