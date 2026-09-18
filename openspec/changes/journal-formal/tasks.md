# Tasks — journal-formal (0.0.2)

Turns the journal into a stable primitive: the roadmap's `0.0.2 — Journal
formal`. Branch `feat/journal-formal`, stacked on
`feat/portable-journal-semantics` while PR #2 is open, because the JSONL
backend depends on its contract (run-scoped lookup, self-contained request
entries).

Strict TDD per work unit (`openspec/config.yaml`): RED → GREEN →
TRIANGULATE → REFACTOR, binding command `pnpm -r test`.

## Roadmap deliverables and exit criteria

| Deliverable | Source |
|-------------|--------|
| `RunFailed` joins the `JournalEntry` union | ROADMAP §0.0.2 "Introducir" |
| Invariants defined | ROADMAP §0.0.2; already enforced by the writer since ADR-0003 and ADR-0012 |
| `@agent-effects/journal-jsonl`, `cat run.jsonl` useful to a human | ROADMAP §0.0.2 |
| Versioned schema | Exit criteria; ADR-0009 §4 places the per-entry schema in `schemas/` from 0.0.2 |
| Parser | Exit criteria |
| Validator | Exit criteria |
| Round-trip test | Exit criteria |
| Compatibility fixtures | Exit criteria |

### Two document conflicts, resolved here

1. **`fixtures/README.md` says compatibility fixtures start at 0.0.6**, while
   the roadmap's 0.0.2 exit criteria ask for them now. Resolved as: 0.0.2 ships
   *format* fixtures that pin the on-disk shape for the parser, validator and
   round-trip tests. The cross-language *conformance* suite stays at 0.11.0 and
   the first conformance fixtures at 0.0.6. The stub README is corrected.
2. **The 0.0.1 design deferred JSON schemas to 0.10.0.** ADR-0009 §4 defers only
   the per-artifact *split* to 0.10.0 and places the per-entry schema at 0.0.2.
   The ADR wins; `schemas/journal-entry.schema.json` ships here.

## Work units

- [ ] 1. `run.failed` entry kind in core.
  - `RunFailedEntry` with `error: SerializableError`; extend `JournalEntryKind` and `JournalEntry`.
  - The 0.0.1 suite carries a load-bearing `@ts-expect-error` asserting `run.failed` is absent; it fails as unused when the kind lands, which is what it was written to force. Update it consciously.
  - Note: no component writes run-lifecycle entries yet; `createRuntime` is synchronous and receives no run id. The kind is part of the entry model, not of the runtime's behavior.

- [ ] 2. `schemas/journal-entry.schema.json`.
  - JSON Schema (draft 2020-12) covering the five entry kinds and the envelope, normative per ADR-0009 §4.
  - Validated in tests against the fixtures with `ajv` as a **devDependency only**: no runtime schema dependency, per the 0.0.2 scope.

- [ ] 3. `@agent-effects/journal-jsonl` — the backend.
  - `JsonlEffectJournal` implements `EffectJournal` over an append-only file, one JSON object per line, many runs per file (ADR-0012 §1).
  - Async factory `open(path)`: an existing file is read once to rebuild the per-run sequence counters and the resolution index; appends are `O(1)` and lookups do not re-read the file.
  - Serialization already gives the ADR-0012 §4 snapshot guarantee; nothing is shared by reference.

- [ ] 4. Parser and validator.
  - `parseJournal(text)`: line-oriented, reporting the offending line number instead of failing the whole file silently.
  - `validateEntry(value)`: structural validation plus the ADR-0009 §3 reader rule — unknown fields inside the same major version are accepted, a different major is rejected with an error naming the observed and supported versions.

- [ ] 5. Fixtures and round-trip tests.
  - `fixtures/journal/` with a readable run, an unknown-field entry (same major, must be accepted) and a future-major entry (must be rejected).
  - Round trip: parse → serialize → parse yields an equal entry sequence; a journal written by `JsonlEffectJournal` reparses identically.

- [ ] 6. Documentation.
  - `packages/journal-jsonl/README.md`, `schemas/README.md` and `fixtures/README.md` lose their stub status.
  - `docs/concepts/README.md` gains the on-disk format and the reader compatibility rule.

Deferred, explicitly not tasks here: replay runtime (0.0.3), the conformance
suite (0.11.0), the per-artifact schema split (0.10.0), run-lifecycle writes
from the runtime, policy, adapters.
