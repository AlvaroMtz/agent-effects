import { readFileSync } from "node:fs";
import AjvModule from "ajv/dist/2020.js";
import type { ValidateFunction } from "ajv";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * The published schema is normative for every implementation in any
 * language (ADR-0009 §4), so it is exercised here directly rather than
 * through the TypeScript validator, which could agree with itself.
 */
const SCHEMA_PATH = new URL("../../../schemas/journal-entry.schema.json", import.meta.url);

/**
 * ajv ships CommonJS, so its ESM default import types as the module object
 * under NodeNext while the runner's interop hands back the class. One cast
 * names the constructor shape this test needs; nothing else is assumed.
 */
const Ajv2020 = AjvModule as unknown as new (options?: {
  strict?: boolean;
}) => { compile: (schema: unknown) => ValidateFunction };

const envelope = {
  runId: "run_1",
  sequence: 1,
  schemaVersion: "1.0",
  timestamp: "2026-01-01T00:00:00.000Z",
};

let validate: ValidateFunction;

beforeAll(() => {
  const schema: unknown = JSON.parse(readFileSync(SCHEMA_PATH, "utf8"));
  validate = new Ajv2020({ strict: false }).compile(schema);
});

describe("journal-entry.schema.json", () => {
  it("accepts one entry of every kind", () => {
    const entries = [
      { ...envelope, kind: "run.started" },
      {
        ...envelope,
        kind: "effect.requested",
        effect: {
          id: "fx_1",
          runId: "run_1",
          type: "tool.invoke",
          input: { tool: "weather", arguments: { city: "Madrid" } },
          metadata: { "adapter.openai.call_id": "call_1" },
        },
      },
      {
        ...envelope,
        kind: "effect.resolved",
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "ok", output: { temperature: 24 } },
      },
      { ...envelope, kind: "run.completed" },
      {
        ...envelope,
        kind: "run.failed",
        error: { code: "run-failed", message: "the run aborted" },
      },
    ];

    for (const entry of entries) {
      expect([entry.kind, validate(entry)]).toEqual([entry.kind, true]);
    }
  });

  it("requires each kind to carry its own payload", () => {
    expect(validate({ ...envelope, kind: "effect.requested" })).toBe(false);
    expect(validate({ ...envelope, kind: "effect.resolved", effectId: "fx_1" })).toBe(false);
    expect(validate({ ...envelope, kind: "run.failed" })).toBe(false);
    expect(
      validate({
        ...envelope,
        kind: "effect.resolved",
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "ok" },
      }),
    ).toBe(false);
  });

  it("rejects a resolution state that is never journaled", () => {
    // pending, cancelled, denied and unknown are runtime states; a recorded
    // resolution is terminal by construction.
    for (const status of ["pending", "cancelled", "denied", "unknown"]) {
      expect([
        status,
        validate({
          ...envelope,
          kind: "effect.resolved",
          effectId: "fx_1",
          result: { effectId: "fx_1", status },
        }),
      ]).toEqual([status, false]);
    }
  });

  it("accepts unknown fields within the same major version", () => {
    // ADR-0009 §3: a reader must not fail on fields it does not know.
    expect(validate({ ...envelope, kind: "run.started", futureField: 42 })).toBe(true);
    expect(
      validate({
        ...envelope,
        kind: "effect.requested",
        effect: {
          id: "fx_1",
          runId: "run_1",
          type: "tool.invoke",
          input: null,
          futureField: "ignored",
        },
      }),
    ).toBe(true);
  });

  it("rejects a malformed envelope", () => {
    expect(validate({ ...envelope, kind: "nope" })).toBe(false);
    expect(validate({ ...envelope, kind: "run.started", sequence: 0 })).toBe(false);
    expect(validate({ ...envelope, kind: "run.started", schemaVersion: "one" })).toBe(false);
    expect(validate({ ...envelope, kind: "run.started", runId: "" })).toBe(false);
  });
});
