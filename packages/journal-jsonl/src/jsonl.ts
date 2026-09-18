import { appendFile, readFile } from "node:fs/promises";
import {
  assertAppendable,
  type EffectJournal,
  type EffectResult,
  type JournalEntry,
  type JournalEntryDraft,
} from "@agent-effects/core";
import { parseJournal, serializeEntry } from "./parse.js";
import { JOURNAL_SCHEMA_VERSION } from "./schema.js";

/**
 * Append-only JSONL journal: one JSON object per line, so `cat run.jsonl`
 * is useful to a human (roadmap §0.0.2).
 *
 * One file holds any number of runs (ADR-0012 §1): sequences are per run
 * and lookups are addressed by `(runId, effectId)`. Serialization gives
 * the snapshot guarantee for free — what is written is a copy by
 * construction, and what is read back is parsed fresh, so nothing is ever
 * shared by reference with a caller.
 *
 * Entries are sensitive by default (ADR-0010): this writer stores the file
 * wherever it was told to and filters nothing.
 */
export class JsonlEffectJournal implements EffectJournal {
  readonly #path: string;
  readonly #runs = new Map<string, JournalEntry[]>();

  private constructor(path: string, entries: readonly JournalEntry[]) {
    this.#path = path;
    for (const entry of entries) {
      this.#index(entry);
    }
  }

  /**
   * Attaches to a journal file, reading it once to rebuild the per-run
   * sequence counters and the resolution index. A missing file is an empty
   * journal and is created on the first append; a file that cannot be read
   * back refuses to open, naming the offending line, rather than appending
   * onto something it does not understand.
   */
  static async open(path: string): Promise<JsonlEffectJournal> {
    let text = "";
    try {
      text = await readFile(path, "utf8");
    } catch (failure) {
      if ((failure as NodeJS.ErrnoException).code !== "ENOENT") {
        throw failure;
      }
    }
    return new JsonlEffectJournal(path, parseJournal(text));
  }

  async append(entry: JournalEntryDraft): Promise<void> {
    const entries = this.#runs.get(entry.runId) ?? [];

    assertAppendable(entry, {
      hasRequest: (effectId) =>
        entries.some(
          (recorded) => recorded.kind === "effect.requested" && recorded.effect.id === effectId,
        ),
      hasResolution: (effectId) =>
        entries.some(
          (recorded) => recorded.kind === "effect.resolved" && recorded.effectId === effectId,
        ),
    });

    const stamped: JournalEntry = {
      ...entry,
      sequence: entries.length + 1,
      schemaVersion: JOURNAL_SCHEMA_VERSION,
      timestamp: new Date().toISOString(),
    };

    // The file is the source of truth: index only what was durably written,
    // so a failed append leaves neither a line nor a counter behind.
    await appendFile(this.#path, serializeEntry(stamped), "utf8");
    this.#index(stamped);
  }

  async findResult(runId: string, effectId: string): Promise<EffectResult | undefined> {
    const resolved = (this.#runs.get(runId) ?? []).find(
      (entry) => entry.kind === "effect.resolved" && entry.effectId === effectId,
    );
    return resolved?.kind === "effect.resolved" ? structuredClone(resolved.result) : undefined;
  }

  /** A run's entries in append order, as recorded. */
  entries(runId: string): readonly JournalEntry[] {
    return structuredClone(this.#runs.get(runId) ?? []);
  }

  /** Every run this file holds, in the order each was first seen. */
  runIds(): readonly string[] {
    return [...this.#runs.keys()];
  }

  #index(entry: JournalEntry): void {
    const entries = this.#runs.get(entry.runId) ?? [];
    entries.push(entry);
    this.#runs.set(entry.runId, entries);
  }
}
