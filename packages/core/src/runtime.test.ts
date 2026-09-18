import { describe, expect, expectTypeOf, it, vi } from "vitest";
import { createRuntime, JournalInvariantError } from "./index.js";
import type {
  Effect,
  EffectExecutor,
  ExecutionOutcome,
  EffectJournal,
  EffectKind,
  EffectResult,
  JournalEntry,
  JournalEntryDraft,
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
    expectTypeOf(result.output).toEqualTypeOf<JsonValue>();
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

  it("effect input is constrained to JSON-serializable values", () => {
    // Functions, sockets and class instances must not be representable in the
    // portable contract (specs/effect-core -> Effect Is a Serializable Request).
    // @ts-expect-error a function is not a JsonValue, so it cannot be an effect input
    type NonSerializable = Effect<{ callback: () => void }>;
    // Named so the directive above has a use; the type itself is never built.
    const unreachable: NonSerializable | undefined = undefined;
    expect(unreachable).toBeUndefined();

    // Both in-scope inputs stay assignable.
    expectTypeOf<ToolInvokeInput>().toMatchTypeOf<JsonValue>();
    expectTypeOf<ModelInvokeInput>().toMatchTypeOf<JsonValue>();
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

  it("JournalEntry union covers all five kinds", () => {
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
        effect: {
          id: "fx_1",
          runId: "run_1",
          type: "tool.invoke",
          input: { tool: "weather", arguments: { city: "Madrid" } },
        },
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
      {
        kind: "run.failed",
        sequence: 5,
        schemaVersion: "1.0",
        timestamp: "2026-01-01T00:00:00.004Z",
        runId: "run_2",
        error: { code: "run-failed", message: "the run aborted" },
      },
    ];
    expect(entries.map((entry) => entry.kind)).toEqual([
      "run.started",
      "effect.requested",
      "effect.resolved",
      "run.completed",
      "run.failed",
    ]);
    // Compile-time exhaustiveness: a sixth kind would break this Record.
    const exhaustive: Record<JournalEntryKind, true> = {
      "run.started": true,
      "effect.requested": true,
      "effect.resolved": true,
      "run.completed": true,
      "run.failed": true,
    };
    expect(Object.keys(exhaustive)).toHaveLength(5);
  });
});

/**
 * Journal double. Core must not depend on `@agent-effects/journal-memory`
 * (design §14), so the seam is faked here: it records what was appended,
 * serves pre-recorded results, and can be told to fail on one entry kind.
 */
class FakeJournal implements EffectJournal {
  readonly appended: JournalEntryDraft[] = [];
  readonly #recorded = new Map<string, EffectResult>();
  #failOn?: { kind: JournalEntryKind; error: Error };

  async append(entry: JournalEntryDraft): Promise<void> {
    if (entry.kind === this.#failOn?.kind) {
      throw this.#failOn.error;
    }
    this.appended.push(entry);
  }

  async findResult(runId: string, effectId: string): Promise<EffectResult | undefined> {
    return this.#recorded.get(`${runId}/${effectId}`);
  }

  /** Seeds a result as if a previous resolution had recorded it. */
  record(runId: string, effectId: string, result: EffectResult): void {
    this.#recorded.set(`${runId}/${effectId}`, result);
  }

  /** Makes `append` reject for one entry kind. */
  failOn(kind: JournalEntryKind, error: Error): void {
    this.#failOn = { kind, error };
  }
}

const weatherEffect: Effect<ToolInvokeInput> = {
  id: "fx_1",
  runId: "run_1",
  type: "tool.invoke",
  input: { tool: "weather", arguments: { city: "Madrid" } },
};

function okExecutor(output: JsonValue = "sunny, 24°C"): EffectExecutor {
  return {
    execute: vi.fn(async () => ({ status: "ok" as const, output })),
  };
}

describe("EffectRuntime.resolve", () => {
  it("resolve weather tool for Madrid returns ok", async () => {
    const journal = new FakeJournal();
    const executor = okExecutor();
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    expect(result).toEqual({ effectId: "fx_1", status: "ok", output: "sunny, 24°C" });
    expect(executor.execute).toHaveBeenCalledWith(weatherEffect);
    expect(journal.appended).toEqual([
      { kind: "effect.requested", runId: "run_1", effect: weatherEffect },
      {
        kind: "effect.resolved",
        runId: "run_1",
        effectId: "fx_1",
        result: { effectId: "fx_1", status: "ok", output: "sunny, 24°C" },
      },
    ]);
  });

  it("resolve already-resolved effect without calling executor", async () => {
    const journal = new FakeJournal();
    const recorded: EffectResult = { effectId: "fx_1", status: "ok", output: "cloudy, 12°C" };
    journal.record("run_1", "fx_1", recorded);
    const executor = okExecutor();
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    expect(result).toEqual(recorded);
    expect(executor.execute).not.toHaveBeenCalled();
    expect(journal.appended).toEqual([]);
  });

  it("resolve effect without id returns invalid-request", async () => {
    const journal = new FakeJournal();
    const executor = okExecutor();
    const runtime = createRuntime({ executor, journal });

    const withoutId = { runId: "run_1", type: "tool.invoke", input: weatherEffect.input };
    const result = await runtime.resolve(withoutId as unknown as Effect);

    expect(result).toMatchObject({ status: "error", error: { code: "invalid-request" } });
    expect(executor.execute).not.toHaveBeenCalled();
    expect(journal.appended).toEqual([]);

    // Triangulation: an empty id is just as absent as a missing one.
    const blank = await runtime.resolve({ ...weatherEffect, id: "   " });
    expect(blank).toMatchObject({ status: "error", error: { code: "invalid-request" } });
    expect(journal.appended).toEqual([]);
  });

  it("journal append failure on request returns persistence-failed", async () => {
    const journal = new FakeJournal();
    journal.failOn("effect.requested", new Error("journal unavailable"));
    const executor = okExecutor();
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    expect(result).toMatchObject({
      effectId: "fx_1",
      status: "error",
      error: { code: "persistence-failed" },
    });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("journal append failure on result returns unknown", async () => {
    const journal = new FakeJournal();
    journal.failOn("effect.resolved", new Error("journal unavailable"));
    const executor = okExecutor();
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    // The executor already ran, so the outcome is unverifiable -- never a
    // fabricated ok or error (ADR-0007 §3).
    expect(result).toEqual({ effectId: "fx_1", status: "unknown" });
    expect(executor.execute).toHaveBeenCalledTimes(1);
  });

  it("duplicate id rejected as invalid-request", async () => {
    const journal = new FakeJournal();
    journal.failOn(
      "effect.requested",
      new JournalInvariantError("duplicate-effect-id", "fx_1 already requested in run_1"),
    );
    const executor = okExecutor();
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    expect(result).toMatchObject({
      effectId: "fx_1",
      status: "error",
      error: { code: "invalid-request" },
    });
    expect(executor.execute).not.toHaveBeenCalled();
  });

  it("resolve with adapter metadata preserves metadata", async () => {
    const journal = new FakeJournal();
    const executor: EffectExecutor = {
      execute: vi.fn(async () => ({
        status: "ok" as const,
        output: "sunny, 24°C",
        metadata: { "adapter.openai.requestId": "req_abc123" },
      })),
    };
    const runtime = createRuntime({ executor, journal });
    const effect: Effect<ToolInvokeInput> = {
      ...weatherEffect,
      metadata: { "adapter.openai.call_id": "call_1", "trace.depth": 2 },
    };

    const result = await runtime.resolve(effect);

    // The core never reads, rewrites or strips metadata (ADR-0008).
    expect(executor.execute).toHaveBeenCalledWith(effect);
    expect(result).toMatchObject({ metadata: { "adapter.openai.requestId": "req_abc123" } });
  });

  it("maps a thrown executor failure to execution-failed", async () => {
    const journal = new FakeJournal();
    const executor: EffectExecutor = {
      execute: vi.fn(async () => {
        throw new Error("provider unreachable");
      }),
    };
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    // Native exceptions never cross the boundary (ADR-0005).
    expect(result).toMatchObject({
      effectId: "fx_1",
      status: "error",
      error: { code: "execution-failed", message: "provider unreachable" },
    });
    expect(journal.appended.at(-1)).toMatchObject({ kind: "effect.resolved" });
  });

  it("resolves a model.invoke effect through the same runtime", async () => {
    const journal = new FakeJournal();
    const executor = okExecutor("Madrid stays sunny all week.");
    const runtime = createRuntime({ executor, journal });
    const effect: Effect<ModelInvokeInput> = {
      id: "fx_2",
      runId: "run_1",
      type: "model.invoke",
      input: {
        model: "gpt-4o",
        messages: [{ role: "user", content: "Summarize the forecast" }],
      },
    };

    const result = await runtime.resolve(effect);

    expect(result).toEqual({
      effectId: "fx_2",
      status: "ok",
      output: "Madrid stays sunny all week.",
    });
    expect(journal.appended.map((entry) => entry.kind)).toEqual([
      "effect.requested",
      "effect.resolved",
    ]);
  });

  it("stamps result identity from the dispatched effect", async () => {
    const journal = new FakeJournal();
    // The outcome names no effect, so an executor cannot claim a different one.
    const executor: EffectExecutor = {
      execute: vi.fn(async () => ({ status: "ok" as const, output: "sunny, 24°C" })),
    };
    const runtime = createRuntime({ executor, journal });

    const result = await runtime.resolve(weatherEffect);

    expect(result).toEqual({ effectId: "fx_1", status: "ok", output: "sunny, 24°C" });
    expect(journal.appended.at(-1)).toMatchObject({
      kind: "effect.resolved",
      effectId: "fx_1",
      result: { effectId: "fx_1" },
    });
  });

  it("an execution outcome cannot name an effect", () => {
    // @ts-expect-error identity belongs to the runtime, never to the executor
    const foreign: ExecutionOutcome = { effectId: "fx_999", status: "ok", output: "x" };
    expect(foreign.status).toBe("ok");
  });
});
