/**
 * Structural JSON value type shared by the portable effect contract.
 * Adapter-specific data travels only inside `metadata` fields, which the
 * core never interprets (ADR-0008) and never mutates or redacts (ADR-0010).
 */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/**
 * Portable error shape that survives serialization across process
 * boundaries (ADR-0005 fixes the exact field set).
 */
export interface SerializableError {
  code: string;
  message: string;
  details?: JsonValue;
  retryable?: boolean;
}

/** Minimal provider-agnostic chat message (proposal Decision 6). */
export type Message = {
  role: "user" | "assistant";
  content: string;
};

/** Minimal provider-agnostic tool description (proposal Decision 6). */
export type ToolDefinition = {
  name: string;
  description: string;
  /** JSON Schema-ish description of the tool's input; opaque to the core. */
  inputSchema: JsonValue;
  required?: string[];
};
