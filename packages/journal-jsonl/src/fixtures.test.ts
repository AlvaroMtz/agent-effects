import { readFileSync } from "node:fs";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import AjvModule from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { beforeAll, describe, expect, it } from "vitest";
import { JournalFormatError, JsonlEffectJournal, parseJournal, serializeEntry } from "./index.js";

const Ajv2020 = AjvModule as unknown as new (options?: {
  strict?: boolean;
}) => { compile: (schema: unknown) => ValidateFunction };

const fixture = (name: string): string =>
  readFileSync(new URL(`../../../fixtures/journal/${name}`, import.meta.url), "utf8");

let validate: ValidateFunction;

beforeAll(() => {
  const schema: unknown = JSON.parse(
    readFileSync(new URL("../../../schemas/journal-entry.schema.json", import.meta.url), "utf8"),
  );
  validate = new Ajv2020({ strict: false }).compile(schema);
});

describe("compatibility fixtures", () => {
  it("parses a complete run", () => {
    const entries = parseJournal(fixture("basic-run.jsonl"));

    expect(entries.map((entry) => entry.kind)).toEqual([
      "run.started",
      "effect.requested",
      "effect.resolved",
      "effect.requested",
      "effect.resolved",
      "run.completed",
    ]);
    expect(entries.map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("parses a run that failed", () => {
    const entries = parseJournal(fixture("failed-run.jsonl"));
    const last = entries.at(-1);

    expect(last).toMatchObject({
      kind: "run.failed",
      error: { code: "run-failed" },
    });
  });

  it("every fixture entry satisfies the published schema", () => {
    // The fixtures pin the on-disk shape for any implementation, so they are
    // checked against the normative schema, not only against this parser.
    for (const name of ["basic-run.jsonl", "failed-run.jsonl", "forward-compatible.jsonl"]) {
      for (const entry of parseJournal(fixture(name))) {
        expect([name, validate(entry), validate.errors?.[0]?.message]).toEqual([
          name,
          true,
          undefined,
        ]);
      }
    }
  });

  it("keeps unknown fields from a newer minor version", () => {
    const entries = parseJournal(fixture("forward-compatible.jsonl"));

    // ADR-0009 §3: same major, so the reader accepts the entry and must not
    // drop what it does not understand.
    expect(entries[0]).toMatchObject({ schemaVersion: "1.7", lane: "experimental" });
    expect(entries[1]).toMatchObject({
      emittedBy: "agent-effects@0.1.7",
      effect: { budget: { maxCostUsd: 0.01 } },
    });
  });

  it("refuses a newer major version, naming both", () => {
    try {
      parseJournal(fixture("future-major.jsonl"));
      expect.unreachable("a future major must not be readable");
    } catch (error) {
      expect(error).toBeInstanceOf(JournalFormatError);
      expect(error).toMatchObject({ code: "unsupported-schema-version", line: 1 });
    }
  });

  it("round-trips every fixture byte for byte", () => {
    for (const name of ["basic-run.jsonl", "failed-run.jsonl", "forward-compatible.jsonl"]) {
      const text = fixture(name);
      expect([name, parseJournal(text).map(serializeEntry).join("")]).toEqual([name, text]);
    }
  });
});

describe("a journal this package wrote", () => {
  it("reparses into the entries it recorded", async () => {
    const path = join(await mkdtemp(join(tmpdir(), "agent-effects-")), "run.jsonl");
    const journal = await JsonlEffectJournal.open(path);
    const effect = {
      id: "fx_1",
      runId: "run_1",
      type: "tool.invoke" as const,
      input: { tool: "weather", arguments: { city: "Madrid" } },
    };

    await journal.append({ kind: "run.started", runId: "run_1" });
    await journal.append({ kind: "effect.requested", runId: "run_1", effect });
    await journal.append({
      kind: "effect.resolved",
      runId: "run_1",
      effectId: "fx_1",
      result: { effectId: "fx_1", status: "ok", output: { temperature: 24 } },
    });
    await journal.append({ kind: "run.completed", runId: "run_1" });

    const reparsed = parseJournal(await readFile(path, "utf8"));
    expect(reparsed).toEqual(journal.entries("run_1"));
    for (const entry of reparsed) {
      expect([entry.kind, validate(entry)]).toEqual([entry.kind, true]);
    }
  });
});
