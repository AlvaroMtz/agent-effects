# Architecture Decision Records

This directory records the foundational architectural decisions of Agent Effects,
following the Nygard ADR format. The roadmap (§20) mandates creating the first ten
records from the very beginning, before implementation starts. Later records are
added as decisions are made; an accepted record is never edited in place.

## Index

| Number | Title | Status |
| ------ | ----- | ------ |
| [0001](0001-effect-vs-event.md) | Effects versus Events | Accepted |
| [0002](0002-effect-identity.md) | Effect Identity | Accepted |
| [0003](0003-journal-append-only.md) | Append-Only Journal as Source of Truth | Accepted |
| [0004](0004-replay-semantics.md) | Replay Resolves from the Journal, Never Re-executes | Accepted |
| [0005](0005-errors-and-retries.md) | Serializable Errors and Retry Semantics | Accepted |
| [0006](0006-concurrency.md) | Ordering and Concurrency: Sequence versus Causality | Accepted |
| [0007](0007-exactly-once.md) | No Exactly-Once Guarantee for External Side Effects | Accepted |
| [0008](0008-adapter-metadata.md) | Portable Contract versus Adapter Metadata | Accepted |
| [0009](0009-schema-versioning.md) | Schema Versioning for Journal Entries | Accepted |
| [0010](0010-sensitive-data.md) | Journals Are Sensitive by Default; Redaction Is Explicit | Accepted |
| [0011](0011-execution-outcome.md) | Executors Return an Execution Outcome; the Runtime Owns the Result | Accepted |
| [0012](0012-run-scoped-journal-entries.md) | Journal Entries Are Run-Scoped, Self-Contained, and Immutable to Callers | Accepted |

## Process

- **Sequential numbering.** ADR numbers are assigned sequentially and never reused.
  File names follow the pattern `NNNN-kebab-case-title.md`.
- **Immutability.** An Accepted ADR is an immutable historical record.
  Do not edit its decision in place. If a decision changes, write a new ADR
  with a new sequential number that supersedes the old one, and update the
  superseded record's Status line to point at its successor.
- **References.** Every ADR cites the roadmap sections that motivate it and
  the related ADRs it depends on or constrains.
- **Scope.** These records constrain the portable contract (effects, results,
  journal entries) and the boundaries between core, adapters, and integrations.
