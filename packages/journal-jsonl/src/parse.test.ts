import type { JournalEntry } from "@agent-effects/core";
import { describe, expect, it } from "vitest";
import { JournalFormatError, parseJournal, serializeEntry, validateEntry } from "./index.js";

const started = {
  kind: "run.started",
  runId: "run_1",
  sequence: 1,
  schemaVersion: "1.0",
  timestamp: "2026-01-01T00:00:00.000Z",
};

const requested = {
  ...started,
  kind: "effect.requested",
  sequence: 2,
  effect: {
    id: "fx_1",
    runId: "run_1",
    type: "tool.invoke",
    input: { tool: "weather", arguments: { city: "Madrid" } },
  },
};

describe("validateEntry", () => {
  it("returns the entry it was given", () => {
    expect(validateEntry(started)).toEqual(started);
    expect(validateEntry(requested)).toEqual(requested);
  });

  it("accepts unknown fields within the same major version", () => {
    // ADR-0009 §3: a reader must not fail on fields it does not know.
    const future = { ...started, schemaVersion: "1.7", lane: "experimental" };
    expect(validateEntry(future)).toEqual(future);
  });

  it("rejects a different major version naming both versions", () => {
    const next = { ...started, schemaVersion: "2.0" };
    expect(() => validateEntry(next)).toThrow(JournalFormatError);
    try {
      validateEntry(next);
    } catch (error) {
      expect(error).toMatchObject({ code: "unsupported-schema-version" });
      // The message has to be actionable on its own, in any language binding.
      expect((error as Error).message).toContain("2.0");
      expect((error as Error).message).toContain("1.0");
    }
  });

  it("rejects an entry missing the payload its kind requires", () => {
    expect(() => validateEntry({ ...started, kind: "effect.requested" })).toThrow(
      JournalFormatError,
    );
    expect(() => validateEntry({ ...started, kind: "run.failed" })).toThrow(JournalFormatError);
    expect(() =>
      validateEntry({ ...started, kind: "effect.resolved", effectId: "fx_1" }),
    ).toThrow(JournalFormatError);
  });

  it("rejects a malformed envelope", () => {
    expect(() => validateEntry(null)).toThrow(JournalFormatError);
    expect(() => validateEntry("run.started")).toThrow(JournalFormatError);
    expect(() => validateEntry({ ...started, kind: "run.exploded" })).toThrow(JournalFormatError);
    expect(() => validateEntry({ ...started, sequence: 0 })).toThrow(JournalFormatError);
    expect(() => validateEntry({ ...started, runId: "" })).toThrow(JournalFormatError);
    expect(() => validateEntry({ ...started, schemaVersion: "one" })).toThrow(JournalFormatError);
  });

  it("rejects a resolution that is not terminal", () => {
    expect(() =>
      validateEntry({
        ...started,
        kind: "effect.resolved",
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "unknown" },
      }),
    ).toThrow(JournalFormatError);
  });
});

describe("parseJournal", () => {
  it("parses a run and ignores blank lines", () => {
    const text = `${serializeEntry(started as JournalEntry)}\n\n${serializeEntry(
      requested as JournalEntry,
    )}\n`;

    expect(parseJournal(text).map((entry) => entry.kind)).toEqual([
      "run.started",
      "effect.requested",
    ]);
  });

  it("names the offending line on malformed JSON", () => {
    // serializeEntry already terminates the line, so the bad entry is line 2.
    const text = `${serializeEntry(started as JournalEntry)}{not json\n`;

    try {
      parseJournal(text);
      expect.unreachable("parseJournal should have thrown");
    } catch (error) {
      // A journal is meant to be read by a human with cat; "invalid JSON"
      // somewhere in a long file is not a usable report.
      expect(error).toMatchObject({ code: "malformed-json", line: 2 });
    }
  });

  it("names the offending line on an invalid entry", () => {
    const text = `${serializeEntry(started as JournalEntry)}${JSON.stringify({
      ...started,
      schemaVersion: "3.0",
    })}\n`;

    try {
      parseJournal(text);
      expect.unreachable("parseJournal should have thrown");
    } catch (error) {
      expect(error).toMatchObject({ code: "unsupported-schema-version", line: 2 });
    }
  });

  it("round-trips entries through serialize and parse", () => {
    const entries = [started, requested] as JournalEntry[];
    const text = entries.map(serializeEntry).join("");

    expect(parseJournal(text)).toEqual(entries);
    // Serializing what was parsed reproduces the same bytes.
    expect(parseJournal(text).map(serializeEntry).join("")).toBe(text);
  });
});
