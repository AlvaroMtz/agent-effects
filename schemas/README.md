# Schemas

Normative JSON Schemas for the portable artifacts. They are the reference for
implementations in any language, not just this one (ADR-0009 §4).

| Schema | Since | Covers |
|--------|-------|--------|
| [`journal-entry.schema.json`](journal-entry.schema.json) | 0.0.2 | The five journal entry kinds and their envelope, schema version 1.0 |

The per-artifact split — `effect.schema.json` and `result.schema.json` beside
the entry schema — arrives at 0.10.0. Until then the entry schema embeds the
effect and result shapes in its `$defs`.

## Reader rule

`additionalProperties` is deliberately left open. A reader accepts unknown
fields within the same major version and must not fail on them; a different
major is rejected with an error naming the observed and the supported version.
Additions bump the minor, removals and meaning changes bump the major.

`fixtures/journal/` exercises exactly this: a newer-minor journal whose unknown
fields must survive a round trip, and a newer-major journal that must be
refused.
