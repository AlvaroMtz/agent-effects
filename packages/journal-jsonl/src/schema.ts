/**
 * Schema version this package writes and reads. The normative document is
 * `schemas/journal-entry.schema.json` (ADR-0009 §4); this constant is what
 * the writer stamps and what the validator compares a major against.
 */
export const JOURNAL_SCHEMA_VERSION = "1.0";
