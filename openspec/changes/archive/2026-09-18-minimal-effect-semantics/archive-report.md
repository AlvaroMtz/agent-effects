# Archive Report — minimal-effect-semantics

- **Archived:** 2026-09-18
- **Delivered:** PR #1, merged as `16770e3`
- **Milestone:** 0.0.1 — minimal effect semantics

## What closed

All seven work units complete. The delta specs are promoted to
`openspec/specs/effect-core/spec.md` and `openspec/specs/journal/spec.md`,
which become the source of truth for the capability. They were written as
whole specifications rather than `ADDED`/`MODIFIED` deltas, because this was
the first change: there was nothing to merge into.

## Verified at close

| Check | Evidence |
|-------|----------|
| Clean clone needs no build | `dist/` removed, `pnpm -r test` and `pnpm -r typecheck` exit 0 |
| 20+ unit tests | 25 distinct at close |
| CI | GitHub Actions green on push and pull_request runs 35350122563 and 35350148354 |
| No forbidden dependency | Only runtime dependency in any manifest is the `@agent-effects/core` workspace link |

## Known stale content, deliberately preserved

The archived artifacts describe the contract as it shipped in 0.0.1. Two later
changes supersede parts of it and are **not** reflected here, because an
archive is an audit trail and is never rewritten:

- `portable-journal-semantics` (PR #2): executors return `ExecutionOutcome`,
  lookups take `(runId, effectId)`, request entries carry the whole effect,
  and the portable contract is `JsonValue`-constrained.
- `journal-formal` (PR #3): `run.failed` joins the entry union.

**The promoted specs in `openspec/specs/` carry the same staleness**, because
neither later change wrote delta specs — both were implemented from a
hand-written task list. Those deltas have to be written before the specs can be
trusted as the source of truth again. This is recorded rather than quietly
fixed here: editing the main specs without a delta would leave no trace of why
they changed.
