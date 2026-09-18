import { describe, expect, expectTypeOf, it } from "vitest";
import type {
  Effect,
  EffectKind,
  EffectResult,
  JournalEntry,
  JournalEntryKind,
  JsonValue,
  Message,
  ModelInvokeInput,
  SerializableError,
  ToolInvokeInput,
} from "./index.js";
import type { EffectResultError, EffectResultOk } from "./types/effect-result.js";

describe("core type contracts", () => {
  it("tool.invoke input has tool and arguments", () => {
    const input: ToolInvokeInput = { tool: "weather", arguments: { city: "Madrid" } };
    expectTypeOf(input.tool).toEqualTypeOf<string>();
    expectTypeOf(input.arguments).toEqualTypeOf<JsonValue>();
    const effect: Effect<ToolInvokeInput> = {
      id: "fx_1",
      runId: "run_1",
      type: "tool.invoke",
      input,
    };
    expectTypeOf(effect.input).toEqualTypeOf<ToolInvokeInput>();
    expect(input.tool).toBe("weather");
    expect(input.arguments).toEqual({ city: "Madrid" });
  });

  it("model.invoke input has messages and model", () => {
    const input: ModelInvokeInput = {
      model: "gpt-4o",
      messages: [{ role: "user", content: "What is the weather in Madrid?" }],
    };
    expectTypeOf(input.messages).toEqualTypeOf<Message[]>();
    expectTypeOf(input.model).toEqualTypeOf<string | undefined>();
    expect(input.model).toBe("gpt-4o");
    expect(input.messages).toEqual([{ role: "user", content: "What is the weather in Madrid?" }]);
  });

  it("error result carries code and message", () => {
    const error: SerializableError = { code: "execution-failed", message: "tool crashed" };
    expectTypeOf(error.code).toEqualTypeOf<string>();
    expectTypeOf(error.message).toEqualTypeOf<string>();
    expect(error.code).toBe("execution-failed");
    expect(error.message).toBe("tool crashed");
    // Triangulation: a distinct code plus the optional details field.
    const persisted: SerializableError = {
      code: "persistence-failed",
      message: "journal unavailable",
      details: { backend: "memory", attempt: 1 },
    };
    expectTypeOf(persisted.details).toEqualTypeOf<JsonValue | undefined>();
    expect(persisted.details).toEqual({ backend: "memory", attempt: 1 });
  });

  it("ok result carries output value", () => {
    const result: EffectResultOk = { effectId: "fx_1", status: "ok", output: "sunny, 24°C" };
    // Membership in the six-state union is asserted at compile time by this assignment.
    const asUnion: EffectResult = result;
    expectTypeOf(result.output).toEqualTypeOf<unknown>();
    expect(asUnion.status).toBe("ok");
    expect(result.output).toBe("sunny, 24°C");
  });

  it("error result carries serializable error", () => {
    const result: EffectResultError = {
      effectId: "fx_2",
      status: "error",
      error: { code: "execution-failed", message: "provider unreachable", retryable: true },
    };
    // Membership in the six-state union is asserted at compile time by this assignment.
    const asUnion: EffectResult = result;
    expectTypeOf(result.error).toEqualTypeOf<SerializableError>();
    expect(asUnion.status).toBe("error");
    expect(result.error).toEqual({
      code: "execution-failed",
      message: "provider unreachable",
      retryable: true,
    });
  });

  it("effect round-trips through JSON stringify/parse", () => {
    const effect: Effect<ToolInvokeInput> = {
      id: "fx_1",
      runId: "run_1",
      type: "tool.invoke",
      input: { tool: "weather", arguments: { city: "Madrid" } },
      metadata: { "adapter.openai.call_id": "call_1" },
    };
    const roundTripped = JSON.parse(JSON.stringify(effect)) as Effect<ToolInvokeInput>;
    expect(roundTripped).toEqual(effect);
    expect(roundTripped.id).toBe("fx_1");
    // Triangulation: a model.invoke effect with nested metadata round-trips too.
    const modelEffect: Effect<ModelInvokeInput> = {
      id: "fx_2",
      runId: "run_1",
      type: "model.invoke",
      input: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Summarize the forecast" }],
        tools: [{ name: "weather", description: "Look up weather", inputSchema: { type: "object" } }],
      },
      metadata: { "adapter.openai.call_id": "call_2", "trace.depth": 2 },
    };
    const modelRoundTripped = JSON.parse(JSON.stringify(modelEffect)) as Effect<ModelInvokeInput>;
    expect(modelRoundTripped).toEqual(modelEffect);
    expect(modelRoundTripped.type).toBe("model.invoke");
  });

  it("EffectKind type allows only tool.invoke and model.invoke", () => {
    const tool: EffectKind = "tool.invoke";
    const model: EffectKind = "model.invoke";
    expectTypeOf(tool).toEqualTypeOf<"tool.invoke">();
    expectTypeOf(model).toEqualTypeOf<"model.invoke">();
    // Compile-time exhaustiveness: a third kind would break this Record.
    const exhaustive: Record<EffectKind, true> = {
      "tool.invoke": true,
      "model.invoke": true,
    };
    expect(exhaustive["tool.invoke"]).toBe(true);
    expect(exhaustive["model.invoke"]).toBe(true);
  });

  it("JournalEntry union covers all four kinds", () => {
    const entries: JournalEntry[] = [
      {
        kind: "run.started",
        sequence: 1,
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.000Z",
        runId: "run_1",
      },
      {
        kind: "effect.requested",
        sequence: 2,
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.001Z",
        runId: "run_1",
        effectId: "fx_1",
      },
      {
        kind: "effect.resolved",
        sequence: 3,
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.002Z",
        runId: "run_1",
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "ok", output: "sunny, 24°C" },
      },
      {
        kind: "run.completed",
        sequence: 4,
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.003Z",
        runId: "run_1",
      },
    ];
    expect(entries.map((entry) => entry.kind)).toEqual([
      "run.started",
      "effect.requested",
      "effect.resolved",
      "run.completed",
    ]);
    // Compile-time exhaustiveness: a fifth 0.0.1 kind would break this Record.
    const exhaustive: Record<JournalEntryKind, true> = {
      "run.started": true,
      "effect.requested": true,
      "effect.resolved": true,
      "run.completed": true,
    };
    expect(Object.keys(exhaustive)).toHaveLength(4);
    // run.failed is absent from the 0.0.1 union; it arrives in 0.0.2
    // (proposal Conflicts #3). If it is ever added, this directive fails
    // the build as "unused" and forces a conscious union update.
    // @ts-expect-error run.failed is not a 0.0.1 journal entry kind
    const failed: JournalEntryKind = "run.failed";
    expect(failed).toBe("run.failed");
  });
});
