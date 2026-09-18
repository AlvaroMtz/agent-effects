import type { JsonValue } from "@agent-effects/core";

/**
 * Canonical JSON: object keys sorted, so two encodings of the same value
 * compare equal. Used only to diagnose a replay mismatch; it is never an
 * identity (ADR-0002 §2), which stays the producer-assigned id.
 */
export function canonicalize(value: JsonValue): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const entries = Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalize(value[key] as JsonValue)}`);
  return `{${entries.join(",")}}`;
}
