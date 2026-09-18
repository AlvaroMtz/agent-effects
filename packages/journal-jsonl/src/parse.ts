import type { JournalEntry, JournalEntryKind } from "@agent-effects/core";
import { JOURNAL_SCHEMA_VERSION } from "./schema.js";

/** Why a line or an entry could not be read back. */
export type JournalFormatCode =
  | "malformed-json"
  | "unsupported-schema-version"
  | "invalid-entry";

/**
 * A journal that cannot be read back. `line` is 1-based and present when the
 * failure came from parsing a file, so a report can point at the offending
 * line instead of the whole journal.
 */
export class JournalFormatError extends Error {
  readonly code: JournalFormatCode;
  readonly line?: number;

  constructor(code: JournalFormatCode, message: string, line?: number) {
    super(line === undefined ? message : `line ${line}: ${message}`);
    this.name = "JournalFormatError";
    this.code = code;
    if (line !== undefined) {
      this.line = line;
    }
  }
}

const ENTRY_KINDS: readonly JournalEntryKind[] = [
  "run.started",
  "effect.requested",
  "effect.resolved",
  "run.completed",
  "run.failed",
];

const SUPPORTED_MAJOR = majorOf(JOURNAL_SCHEMA_VERSION);

/** One entry per line, newline-terminated: `cat run.jsonl` stays readable. */
export function serializeEntry(entry: JournalEntry): string {
  return `${JSON.stringify(entry)}\n`;
}

/**
 * Reads a JSONL journal. Blank lines are skipped, so a trailing newline is
 * not an error. The first unreadable line throws with its own number
 * attached rather than failing the file as a whole.
 */
export function parseJournal(text: string): JournalEntry[] {
  const entries: JournalEntry[] = [];

  text.split("\n").forEach((line, index) => {
    if (line.trim() === "") {
      return;
    }
    const lineNumber = index + 1;

    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch (failure) {
      throw new JournalFormatError("malformed-json", messageOf(failure), lineNumber);
    }

    try {
      entries.push(validateEntry(value));
    } catch (failure) {
      throw failure instanceof JournalFormatError
        ? new JournalFormatError(failure.code, bareMessage(failure), lineNumber)
        : failure;
    }
  });

  return entries;
}

/**
 * Checks one value against the entry contract and returns it typed.
 *
 * Unknown fields inside the supported major version are accepted and
 * preserved; a different major is rejected with both versions named
 * (ADR-0009 §3). The normative reference is
 * `schemas/journal-entry.schema.json`.
 */
export function validateEntry(value: unknown): JournalEntry {
  const entry = asRecord(value, "entry is not an object");

  const schemaVersion = asNonEmptyString(entry["schemaVersion"], "schemaVersion");
  if (!/^\d+\.\d+$/.test(schemaVersion)) {
    throw invalid(`schemaVersion "${schemaVersion}" is not major.minor`);
  }
  if (majorOf(schemaVersion) !== SUPPORTED_MAJOR) {
    throw new JournalFormatError(
      "unsupported-schema-version",
      `entry declares schema version ${schemaVersion}, but this reader supports ${JOURNAL_SCHEMA_VERSION}`,
    );
  }

  const kind = entry["kind"];
  if (!isEntryKind(kind)) {
    throw invalid(`unknown entry kind ${JSON.stringify(kind)}`);
  }
  asNonEmptyString(entry["runId"], "runId");
  asPositiveInteger(entry["sequence"], "sequence");
  asNonEmptyString(entry["timestamp"], "timestamp");

  validatePayload(kind, entry);

  return value as JournalEntry;
}

/** Each kind carries its own payload; the envelope alone is never enough. */
function validatePayload(kind: JournalEntryKind, entry: Record<string, unknown>): void {
  if (kind === "effect.requested") {
    const effect = asRecord(entry["effect"], "effect.requested has no effect");
    asNonEmptyString(effect["id"], "effect.id");
    const effectRunId = asNonEmptyString(effect["runId"], "effect.runId");
    asNonEmptyString(effect["type"], "effect.type");
    if (effect["input"] === undefined) {
      throw invalid("effect has no input");
    }
    if (effectRunId !== entry["runId"]) {
      throw invalid(`effect belongs to run ${effectRunId}, not ${String(entry["runId"])}`);
    }
    return;
  }

  if (kind === "effect.resolved") {
    asNonEmptyString(entry["effectId"], "effectId");
    const result = asRecord(entry["result"], "effect.resolved has no result");
    const status = result["status"];
    // Only terminal results are ever recorded; the other four states are
    // runtime answers, never facts about what happened.
    if (status !== "ok" && status !== "error") {
      throw invalid(`recorded resolution has non-terminal status ${JSON.stringify(status)}`);
    }
    if (status === "ok" && result["output"] === undefined) {
      throw invalid("recorded ok resolution has no output");
    }
    if (status === "error") {
      asRecord(result["error"], "recorded error resolution has no error");
    }
    return;
  }

  if (kind === "run.failed") {
    const error = asRecord(entry["error"], "run.failed has no error");
    asNonEmptyString(error["code"], "error.code");
    if (typeof error["message"] !== "string") {
      throw invalid("error.message is not a string");
    }
  }
}

function isEntryKind(value: unknown): value is JournalEntryKind {
  return typeof value === "string" && ENTRY_KINDS.includes(value as JournalEntryKind);
}

function asRecord(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalid(context);
  }
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value === "") {
    throw invalid(`${field} is not a non-empty string`);
  }
  return value;
}

function asPositiveInteger(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw invalid(`${field} is not a positive integer`);
  }
  return value;
}

function invalid(message: string): JournalFormatError {
  return new JournalFormatError("invalid-entry", message);
}

function majorOf(version: string): string {
  return version.split(".")[0] ?? "";
}

function messageOf(failure: unknown): string {
  return failure instanceof Error ? failure.message : String(failure);
}

/** Strips a previously attached `line N:` prefix so it is not doubled. */
function bareMessage(error: JournalFormatError): string {
  return error.message.replace(/^line \d+: /, "");
}
