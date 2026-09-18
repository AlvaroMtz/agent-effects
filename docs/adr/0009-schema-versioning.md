# ADR 0009: Schema Versioning for Journal Entries

- **Status:** Accepted
- **Date:** 2026-09-17

## Context

Journals are append-only records (ADR-0003) that outlive the binaries that
wrote them: a JSONL file recorded last month must remain readable by next
month's runtime — and by implementations in other languages (§0.10.0,
§0.11.0). The roadmap makes versioning a `0.0.2` exit criterion ("schema
versionado"), commits to publishing JSON Schemas at the spec split
(§0.10.0: `journal-entry.schema.json`, `effect.schema.json`,
`result.schema.json`), and requires versioned JSON Schema as part of the
1.0 Definition of Done (§16). §0.0.2 additionally demands parser, validator,
round-trip tests, and compatibility fixtures.

Without an explicit version and compatibility rules, every additive change
to entries risks silently breaking older readers, and cross-major reads
fail in confusing ways instead of actionable ones.

## Decision

1. **Every journal entry (and every portable artifact) carries a
   `schemaVersion` field**, written at creation time.
2. **Versioning follows semantic semantics: major = breaking change,
   minor = additive change.** Additions (new optional fields, new effect
   types in the taxonomy) bump the minor; removals, renames, or field
   meaning changes bump the major.
3. **Reader compatibility rule:** readers accept unknown fields within the
   same major version and must not fail on them; readers encountering a
   different major version reject the entry with an actionable error
   naming the observed and supported versions.
4. **Published JSON Schemas** live in `schemas/` — per-entry schema from
   `0.0.2`, split per artifact (`journal-entry`, `effect`, `result`) at
   `0.10.0` — and are the normative references for all implementations,
   in any language.

## Options considered

- **No versioning; treat the format as stable by willpower.** Rejected:
  pre-1.0 evolution is guaranteed, and unversioned drift converts every
  change into a potential silent corruption of stored history.
- **Date-based or arbitrary format versions.** Rejected: dates carry no
  compatibility semantics; readers could not distinguish additive from
  breaking changes mechanically.
- **Always-accept readers with best-effort interpretation.** Rejected:
  misreading a cross-major entry produces wrong replay results and false
  audit conclusions — worse than a loud, early, actionable failure.

## Consequences

**Positive**

- Old journals stay readable across releases; forward-compatible additive
  evolution is cheap and routine.
- Cross-language implementations (§0.10.0, §0.11.0) share one normative,
  versioned contract instead of reverse-engineering TypeScript types.
- Compatibility fixtures gain a precise vocabulary for what changed.

**Negative**

- Every portable-format change requires version discipline and a schema
  update in the same change.
- Cross-major upgrades require migration planning by consumers; dual-read
  windows add temporary code.

**Neutral**

- Unknown-field tolerance is permissive by design; validation strictness
  for known fields is separate and testable.

## References

- Roadmap §16 (versioned JSON Schema in the Definition of Done), §24
  (portable representation), §0.0.2 (schema versionado; parser; validator;
  round-trip; compatibility fixtures), §0.9.0 (concept RC review of JSON
  schemas), §0.10.0 (spec split; schemas/), §0.11.0 (cross-language
  conformance), §1.0.0 (stable Effect IR).
- Related: ADR-0003 (append-only journals that must remain readable),
  ADR-0008 (schemas cover portable fields only), ADR-0010 (sensitive
  fields may be formalized additively).
