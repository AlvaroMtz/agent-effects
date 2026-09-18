import type { JsonValue, Message, ToolDefinition } from "./support.js";

/**
 * The only two effect kinds in 0.0.1. Dispatch is constrained to exactly
 * these kinds (specs/effect-core → Requirement: Effect Kinds in Scope);
 * new kinds arrive additively (ADR-0009 versioning).
 */
export type EffectKind = "tool.invoke" | "model.invoke";

/**
 * A serializable request, not an event (ADR-0001). `id` and `runId` are
 * producer-assigned and required (ADR-0002). `parentEffectId` links a
 * child to the effect that produced it. `metadata` is adapter data in a
 * namespaced field set the core never interprets (ADR-0008).
 */
export interface Effect<TInput = unknown> {
  id: string;
  runId: string;
  type: EffectKind;
  input: TInput;
  parentEffectId?: string;
  metadata?: Record<string, JsonValue>;
}

/** Input payload for `tool.invoke` effects. */
export interface ToolInvokeInput {
  tool: string;
  arguments: JsonValue;
}

/**
 * Input payload for `model.invoke` effects: a semantic inference intent
 * (ADR-0008), not a provider HTTP request.
 */
export interface ModelInvokeInput {
  provider?: string;
  model?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  config?: {
    temperature?: number;
    maxTokens?: number;
  };
}
