import type { JsonValue, Message, ToolDefinition } from "./support.js";

/**
 * The only two effect kinds in 0.0.1. Dispatch is constrained to exactly
 * these kinds (specs/effect-core → Requirement: Effect Kinds in Scope);
 * new kinds arrive additively (ADR-0009 versioning).
 */
export type EffectKind = "tool.invoke" | "model.invoke";

/**
 * A serializable request, not an event (ADR-0001). `input` is constrained to
 * `JsonValue`, so functions, promises, class instances, sockets and
 * connections are not representable in the portable contract. `id` and `runId` are
 * producer-assigned and required (ADR-0002). `parentEffectId` links a
 * child to the effect that produced it. `metadata` is adapter data in a
 * namespaced field set the core never interprets (ADR-0008).
 */
export interface Effect<TInput extends JsonValue = JsonValue> {
  id: string;
  runId: string;
  type: EffectKind;
  input: TInput;
  parentEffectId?: string;
  metadata?: Record<string, JsonValue>;
}

/**
 * Input payload for `tool.invoke` effects. Declared as a type alias, not an
 * interface: only type aliases carry the implicit index signature that makes
 * them assignable to `JsonValue` (ADR-0012 §4 depends on the contract being
 * structurally JSON).
 */
export type ToolInvokeInput = {
  tool: string;
  arguments: JsonValue;
};

/**
 * Input payload for `model.invoke` effects: a semantic inference intent
 * (ADR-0008), not a provider HTTP request.
 */
export type ModelInvokeInput = {
  provider?: string;
  model?: string;
  messages: Message[];
  tools?: ToolDefinition[];
  config?: {
    temperature?: number;
    maxTokens?: number;
  };
};
