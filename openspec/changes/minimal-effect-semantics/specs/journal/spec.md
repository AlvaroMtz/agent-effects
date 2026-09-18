# Journal Specification

## Purpose

The journal is the append-only source of truth for a run: it records lifecycle facts about effects as they happen, orders them with a per-run sequence, and exposes recorded resolutions for lookup. Milestone 0.0.1 covers the four in-scope entry kinds, the append-time invariants enforced by the writer, lookup semantics, and the in-memory backend.

## Requirements

### Requirement: Append-Only Source of Truth

The journal SHALL be the append-only source of truth for a run. Entries SHALL NEVER be mutated, reordered, or deleted once appended; corrections happen only by appending new entries. The append-only ordering of entries SHALL be authoritative for every reader.

#### Scenario: appended entries are immutable
- GIVEN entries have been appended to a journal
- WHEN the journal is read at any later point
- THEN every earlier entry is returned unchanged in append order and no journal operation rewrites or removes it
(Origin: docs/adr/0003-journal-append-only.md:25-27)

### Requirement: Strictly Monotonic Per-Run Sequence

Every appended entry SHALL receive a `sequence` value assigned at append time that is strictly monotonic within its run. The sequence SHALL record append order only; it SHALL NOT be interpreted as causal order, importance, or logical time. Causality SHALL be expressed only through explicit links such as `parentEffectId` and `retryOf`.

#### Scenario: sequence increases with append order
- GIVEN entries appended in a known order within one run
- WHEN their sequence values are read
- THEN each later append carries a strictly greater sequence than every earlier append, and the counter is scoped per run

#### Scenario: append order is not causality
- GIVEN two effects whose completion order differs from their causal relationship
- WHEN their entries are appended and read
- THEN the sequence reflects append order and readers can reconstruct causality only from explicit causality links, never from sequence
(Origin: docs/adr/0003-journal-append-only.md:28-29; docs/adr/0006-concurrency.md:24,27)

### Requirement: Every Entry Carries a Schema Version

Every journal entry SHALL carry a `schemaVersion` written at creation time. Version changes SHALL be additive within a minor version: new optional fields or new entry kinds bump the minor version, while removals, renames, or meaning changes bump the major version.

#### Scenario: schema version present at creation
- GIVEN a journal appends an entry of any in-scope kind
- WHEN the entry is read back
- THEN it carries the schema version the writer used at creation time

#### Scenario: additive change within a minor version
- GIVEN a writer emits an entry with one additional optional field under the same minor version
- WHEN an existing reader of that minor version reads it
- THEN the entry remains readable and previously recorded entries stay valid
(Origin: docs/adr/0009-schema-versioning.md:25-27)

### Requirement: Entry Kinds in Scope

This milestone's journal SHALL support exactly four entry kinds: run start, effect requested, effect resolved, and run completed. Effect-scoped entries SHALL carry the effect id they refer to. The wider entry union (for example, a run-failed kind) SHALL remain out of scope for this milestone.

#### Scenario: four kinds cover the run lifecycle
- GIVEN a run in which one effect is requested and resolved
- WHEN the journal is read
- THEN it contains only entries of the four in-scope kinds and the effect-scoped entries carry that effect's id
(Origin: docs/ROADMAP.md:131-136; docs/adr/0001-effect-vs-event.md:34-37)

### Requirement: Append-Time Invariants Are Enforced by the Writer

The journal writer SHALL enforce its invariants at append time: an effect resolution SHALL require a prior request for the same effect within the run, and an effect id SHALL be unique within the run. A violated invariant SHALL be rejected instead of recorded; the rejected entry SHALL NOT be appended.

#### Scenario: resolution without prior request is rejected
- GIVEN a run journal with no prior request for effect `fx_9`
- WHEN an effect resolution for `fx_9` is appended
- THEN the append is rejected and no resolution entry is recorded

#### Scenario: duplicate request is rejected
- GIVEN a run journal that already contains a request for an effect id
- WHEN another request for that same id is appended
- THEN the append is rejected and no duplicate request entry is recorded
(Origin: docs/adr/0003-journal-append-only.md:32-34)

### Requirement: Lookup Returns the Recorded Resolution or Its Absence

The journal SHALL expose the recorded resolution for an effect id, or SHALL report that no resolution is recorded, without reordering or rewriting entries. A lookup SHALL NOT fabricate a result for an unresolved effect.

#### Scenario: recorded resolution is found unchanged
- GIVEN an effect with a recorded resolution in the run
- WHEN the journal is asked for that effect's recorded result
- THEN the recorded result is returned unchanged with no entry reordered or rewritten

#### Scenario: absence is reported, not fabricated
- GIVEN an effect with no recorded resolution in the run
- WHEN the journal is asked for that effect's recorded result
- THEN the journal reports the absence and returns no fabricated result
(Origin: docs/ROADMAP.md:408-416; docs/adr/0004-replay-semantics.md:25-27)

### Requirement: The In-Memory Backend Is Process-Local

The milestone's journal backend SHALL be in-memory: process-local state with no dependency on external storage. It SHALL make no durability claim beyond the life of the process, and it SHALL enforce the same append-only, sequence, schema-version, and invariant rules as this specification.

#### Scenario: entries live only in process memory
- GIVEN an in-memory journal holding appended entries
- WHEN a new independent instance is created in the same process
- THEN the new instance is empty, no external storage is consulted, and the backend claims no persistence of the entries it held
(Origin: docs/ROADMAP.md:868-871; docs/adr/0003-journal-append-only.md:35-38)

### Requirement: Entries Are Sensitive by Default

Journal entries SHALL be treated as sensitive by default; storing or sharing a journal is the application's explicit decision. The core and the journal SHALL NOT filter, redact, or mutate entries implicitly. The milestone's documentation SHALL state this posture. An explicit opt-in redaction hook at the journal-writer boundary SHALL remain deferred beyond this milestone.

#### Scenario: no implicit redaction at the write boundary
- GIVEN an entry payload containing a value that looks like a secret
- WHEN the entry is appended and read back
- THEN the value is stored and returned verbatim, with no heuristic filtering or rewriting by the journal

#### Scenario: the posture is documented
- GIVEN the milestone's conceptual documentation
- WHEN it is reviewed
- THEN it states that journals are sensitive by default and that no implicit redaction happens
(Origin: docs/adr/0010-sensitive-data.md:27,30,34)
