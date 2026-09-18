# Proposal — minimal-effect-semantics (milestone 0.0.1)

Status: `proposed` · Phase: `proposal` · Store: `openspec`
Inputs: `explore.md` (this change), `docs/ROADMAP.md`, ADR-0001…0010, `openspec/config.yaml`.
Authority order: ADRs bind over the roadmap's illustrative sketches; where they disagree, the ADR wins and this document says so (`## Conflicts found`).

## Why

The project must first prove that `Effect → Executor → Result → Journal` is a coherent abstraction before any derived capability is built on it (`docs/ROADMAP.md:845`). Milestone 0.0.1 is the smallest change that can prove it: five abstractions, two effect kinds, one in-memory journal, no framework integration (`docs/ROADMAP.md:847,851-871`). Today the repository holds planning artifacts and stub READMEs only — no package manifests, no TypeScript, no tests (`openspec/config.yaml:31-34`; `packages/core/README.md:8`). This change turns that vocabulary into executable semantics with honest failure behavior and the mandated disclosure sentence (`docs/adr/0007-exactly-once.md:14`).

## What changes

- New pnpm-workspace monorepo with `@agent-effects/core` and `@agent-effects/journal-memory` (`docs/ROADMAP.md:895-897`; `openspec/config.yaml:35-39`).
- Core types: `Effect`, `EffectResult`, `EffectExecutor`, `EffectJournal`, `EffectRuntime` (`docs/ROADMAP.md:851-858`; sketches `:351-431`), plus supporting types and a minimal 0.0.1 journal entry model (Decisions 4 and 6).
- Runtime semantics: `createRuntime({ executor, journal })` with journal-first resolution, ID validation, and defined persistence-failure behavior (Decisions 1, 3, 5).
- In-memory journal with append-only writes, per-run monotonic `sequence`, `schemaVersion`, and append-time invariants (Decisions 4, 5).
- Harness: TypeScript strict, ESM, Node LTS pin, vitest, GitHub Actions CI, Changesets (Decisions 8, 9).
- Conceptual documentation expanded from its stub (`docs/concepts/README.md:8`) and the mandatory example delivered as a test plus mirrored walkthrough (Decision 10).

## Capabilities

New Capabilities:

- `effect-core` — the five abstractions (`Effect`, `EffectResult`, `EffectExecutor`, `EffectJournal`, `EffectRuntime`), the two invoke inputs, the supporting types, and the runtime resolution semantics (Decisions 1–6).
- `journal` — the journal contract, its append-time invariants, and the in-memory backend (Decisions 4, 5).

Modified Capabilities: none — no canonical spec exists yet under `openspec/specs/`.

Removed Capabilities: none.

## Scope

- The five abstractions only (`docs/ROADMAP.md:851-858`); effects `tool.invoke` and `model.invoke` only (`:861-865`); in-memory journal only (`:868-871`).
- The mandatory example (`:874-893`), 20+ unit tests (`:906`), conceptual documentation (`:905`), CI (`:903`), release-tooling choice (`:904`).
- Answers to the seven exit-criteria questions (`:919-929`), each traceable to a normative statement or a test (Decision 7).
- Specs, design, and task breakdown are owned by later SDD phases and are not written here.

## Decisions

1. **Journal-first resolution.** `resolve()` checks the journal for a recorded result before dispatching; a recorded result is returned as-is and never re-executed. Rationale: the runtime guarantees at-most-one execution attempt per recorded occurrence and "resolution checks the journal first (recorded results are reused)" (`docs/adr/0007-exactly-once.md:28-30`). The roadmap's pipeline sketch `append → execute → append → return` (`docs/ROADMAP.md:434-440`) predates ADR-0007 and is superseded by it. Rejected: keeping the sketch's no-check pipeline — it re-executes on repeated `resolve` and contradicts the binding ADR.
2. **Six resolution states ship in the 0.0.1 type model**: `ok | error | pending | cancelled | denied | unknown` (`docs/adr/0005-errors-and-retries.md:32-33`), superseding the two-state `EffectResult` sketch (`docs/ROADMAP.md:378-386`). The 0.0.1 runtime produces only the states reachable without a policy engine or asynchronous resumption: `ok`, `error` (codes `invalid-request`, `execution-failed`, `persistence-failed`, `run-failed`, `cancelled` — the ADR-0005 sites of `:30-31` minus `policy-denied`) and `unknown`. `pending` and `denied` are representable but not produced in 0.0.1. Rejected: starting with two states — explicitly rejected by ADR-0005 because `unknown` cannot be retrofitted honestly (`docs/adr/0005-errors-and-retries.md:49`).
3. **Persistence-failure semantics** (exit-criteria questions 6–7, `docs/ROADMAP.md:928-929`): if the journal fails when appending the request, the effect was never dispatched and the runtime reports `error` with code `persistence-failed`; if the executor completed but the result cannot be persisted, the runtime reports `unknown`, because the side effect may or may not have occurred (`docs/adr/0007-exactly-once.md:25-31`). Rejected: reporting a fabricated `ok` (the effect happened but is unverifiable) or `error/execution-failed` (the executor did not fail) — both lie about scenario B (`docs/adr/0007-exactly-once.md:31`).
4. **Minimal 0.0.1 journal entry model**: a discriminated union of four kinds — `run.started`, `effect.requested`, `effect.resolved`, `run.completed` (`docs/ROADMAP.md:131-136`) — each entry carrying `schemaVersion` written at creation (`docs/adr/0009-schema-versioning.md:24-25`) and a strictly monotonic per-run `sequence` assigned at append time (`docs/adr/0003-journal-append-only.md:28-29`), plus the run identity it belongs to and a creation timestamp; effect-scoped entries carry the effect id. The full 0.0.2 entry union and envelope are explicitly out of scope (`docs/ROADMAP.md:942-956`). Rejected: deferring the entry model to 0.0.2 — `EffectJournal.append(entry: JournalEntry)` is already in scope (`docs/ROADMAP.md:409`).
5. **Identity and uniqueness.** The runtime rejects an effect without an id as `invalid-request` (`docs/adr/0002-effect-identity.md:33-35`); per-run effect-id uniqueness and the resolved-requires-requested invariant are enforced at append time inside the journal writer (`docs/adr/0003-journal-append-only.md:32-34`), and the runtime surfaces the journal's rejection as `invalid-request`. Rejected: extending the 0.0.1 journal interface with a lookup API — the milestone's interface set exposes only `append` and `findResult` (`docs/ROADMAP.md:408-416`).
6. **Supporting types.** `JsonValue` is defined in 0.0.1 as the structural JSON type (referenced but undefined at `docs/ROADMAP.md:366,494`); `SerializableError` takes exactly the shape fixed by `docs/adr/0005-errors-and-retries.md:27`; `Message` and `ToolDefinition` are defined in 0.0.1 as minimal provider-agnostic shapes, because `model.invoke` is in scope (R4, `docs/ROADMAP.md:861-865`) and ADR-0008 defines it as semantic inference intent, not a provider HTTP request (`docs/adr/0008-adapter-metadata.md:32`). The exact field sets of the two invoke inputs are fixed by the spec phase, not here. Rejected: typing the inputs as opaque `JsonValue` — it erases the typed-core-fields contract (`docs/adr/0008-adapter-metadata.md:24`).
7. **Where the seven exit-criteria answers live** (`docs/ROADMAP.md:919-929`): the expanded conceptual documentation plus the spec; acceptance criteria must make each answer traceable to a normative statement or a test. Rejected: prose-only answers with no test traceability — that leaves the answers unverifiable and OQ5 unresolved.
8. **Harness.** pnpm workspaces; vitest as the test runner with `pnpm -r test` as the project test command (`openspec/config.yaml:60-61`); TypeScript strict with ESM output and Node current LTS pinned through `engines` plus a version file (`openspec/config.yaml:28-30`; `docs/ROADMAP.md:900-902`); GitHub Actions running install, typecheck, and test on push and pull request. Rejected: leaving package manager, runner, and CI undecided into implementation (OQ6–OQ10) — the 20+-test deliverable has no meaning without a wired runner (`docs/ROADMAP.md:906`).
9. **Release tooling: Changesets**, chosen over semantic-release for a two-package pre-1.0 workspace with human-reviewable version bumps. Explicitly reversible and not executed in 0.0.1 — the tooling is configured; no release is cut (`docs/ROADMAP.md:904` offers either). Rejected: semantic-release — heavier automation than the milestone needs, and a misconfigured auto-publish would cross the destructive-or-publishing preserved gate (`openspec/config.yaml:85-88`).
10. **The mandatory example** (`docs/ROADMAP.md:874-893`) is delivered as an executable test inside the core package plus the same walkthrough mirrored in the conceptual documentation; it does not use the repository layout's `examples/` directory, whose entries (`docs/ROADMAP.md:2462-2464`) target the §23 demo that needs replay and a CLI — both out of scope (`docs/ROADMAP.md:908-917`; replay arrives at 0.0.3, `:1000`). Rejected: an `examples/` package now — a duplicate demo surface with no replay to demonstrate.
11. **Artifact filename singular/plural inconsistency** between `docs/ROADMAP.md:1620,1623` (`effect.md`, `adapter.md`) and `:2453,2456` (`effects.md`, `adapters.md`) is recorded as a deferred follow-up for milestone 0.10.0, when the spec split names the artifacts (`docs/adr/0009-schema-versioning.md:29-30`). Rejected: normalizing now — it edits the founding document for zero 0.0.1 behavior.

## Acceptance criteria

- AC1: A clean clone passes `pnpm install` and `pnpm -r test`, building both packages (monorepo deliverable, `docs/ROADMAP.md:895-897`).
- AC2: `@agent-effects/core`'s public surface is exactly the five abstractions (`docs/ROADMAP.md:851-858`) plus the Decision 4 entry model and Decision 6 supporting types.
- AC3: Only `tool.invoke` and `model.invoke` inputs exist and are dispatchable (`docs/ROADMAP.md:861-865`).
- AC4: The only journal backend shipped is the in-memory `@agent-effects/journal-memory` (`docs/ROADMAP.md:868-871`).
- AC5: The mandatory example passes as a test: `createRuntime({ executor, journal })` resolves `fx_1`/`run_1`/`tool.invoke` (weather, Madrid) to `ok` (`docs/ROADMAP.md:874-893`).
- AC6: A repeated `resolve` of an already-resolved effect returns the recorded result without invoking the executor (Decision 1; `docs/adr/0007-exactly-once.md:28-30`).
- AC7: An effect without an id is rejected as `invalid-request` (Decision 5; `docs/adr/0002-effect-identity.md:33-35`).
- AC8: A duplicate effect id and a resolution without a prior request are rejected at append time (Decision 5; `docs/adr/0003-journal-append-only.md:32-34`).
- AC9: A journal failure on request-append surfaces `error`/`persistence-failed`, and executor-completed-but-unpersistable surfaces `unknown` (Decision 3; `docs/adr/0007-exactly-once.md:25-31`).
- AC10: Every journal entry carries `schemaVersion` and a strictly monotonic per-run `sequence` (Decision 4; `docs/adr/0009-schema-versioning.md:24-25`; `docs/adr/0003-journal-append-only.md:28-29`).
- AC11: Typecheck passes under TypeScript strict with ESM output on the `engines`-pinned Node LTS (Decision 8; `openspec/config.yaml:28-30`).
- AC12: GitHub Actions runs install, typecheck, and `pnpm -r test` on push and pull_request (Decision 8).
- AC13: Changesets is configured and no release is executed in 0.0.1 (Decision 9).
- AC14: The conceptual documentation carries the ADR-0004 locked wording (`docs/adr/0004-replay-semantics.md:32-33`), the ADR-0007 disclosure sentence (`docs/adr/0007-exactly-once.md:14`), and the ADR-0010 sensitive-by-default posture (`docs/adr/0010-sensitive-data.md:27`).
- AC15: `pnpm -r test` executes 20 or more unit tests, all passing (`docs/ROADMAP.md:906`).
- AC16: No framework integration (R2, `docs/ROADMAP.md:847`) and no CLI, LangGraph, OpenAI adapter, database, HTTP, UI, policy, or capability code or dependency exists in the milestone (`docs/ROADMAP.md:908-917`).
- AC17: Exit criteria 1–2 (what an Effect is / is not) are traceable to normative documentation grounded in ADR-0001 (`docs/adr/0001-effect-vs-event.md:28,34`).
- AC18: Exit criterion 3 (who generates the ID) is traceable to ADR-0002 and the AC7 test (`docs/adr/0002-effect-identity.md:25,33-35`).
- AC19: Exit criterion 4 (when it is written to the journal) is traceable to the documented journal-first pipeline and the AC6 test.
- AC20: Exit criterion 5 (how errors are represented) is traceable to `SerializableError` and the six states with tests (`docs/adr/0005-errors-and-retries.md:27,32-33`).
- AC21: Exit criteria 6–7 are traceable to the AC9 tests (`docs/ROADMAP.md:928-929`).
- AC22: Every deliverable of `docs/ROADMAP.md:895-906` maps to one of AC1–AC15 (review-checked).

## Non-goals

- No framework integration (`docs/ROADMAP.md:847`); none of CLI, LangGraph, OpenAI adapter, database, HTTP, UI, policy, capabilities (`docs/ROADMAP.md:908-917`).
- JSONL journal — 0.0.2 (`docs/adr/0003-journal-append-only.md:36-38`; `docs/ROADMAP.md:933,979`); replay runtime — 0.0.3 (`docs/ROADMAP.md:1000`); testing toolkit — 0.0.4 (`:1061`); first adapter — 0.0.5 (`:1116`).
- Policy engine — 0.2.0 (`docs/ROADMAP.md:1353`); human effects — 0.3.0 (`:1390`); forking — 0.4.0 (`:1425`); capabilities outside the initial MVP (`:715-717`).
- Threat model and sensitive-field guidance — 0.12.0; until then, the core never mutates or redacts implicitly (`docs/adr/0010-sensitive-data.md:34,40`).
- Project-level: not an agent framework, workflow engine, protocol, telemetry system, or universal LLM abstraction (`docs/ROADMAP.md:219-247`).
- Even 1.0 does not promise exactly-once external effects or deterministic LLM output (`docs/ROADMAP.md:1933-1950`).

## Risks

- Greenfield bootstrap: workspaces, strict TS/ESM, vitest, and CI must all exist before any semantics is testable; no manifests exist today (`openspec/config.yaml:31-34`; `openspec/config.yaml:59-61`).
- Review budget: the full milestone (two packages, 20+ tests, docs, CI, release config) will exceed the 400-line budget (`openspec/config.yaml:77-78`); per `ask-on-risk` that decision belongs to the user, and no chain strategy is invented here.
- Superseded sketches (Decision 1–2) can mislead implementers if docs and tests do not state the ADR behavior explicitly.
- The documentation deliverable is load-bearing: it must answer exit criteria and carry locked wording, the disclosure sentence, and the redaction posture, from a stub (`docs/concepts/README.md:6-8`).
- Invariant enforcement lives in the journal writer alone in 0.0.1; ADR-0003 also names validators (`docs/adr/0003-journal-append-only.md:32-34`), which are a 0.0.2 deliverable — a validator gap until then.

## Delivery forecast

Honest sizing: this milestone — monorepo scaffolding, two packages, 20+ tests, conceptual documentation, CI, and release configuration — will exceed the 400-line review budget recorded at `openspec/config.yaml:77-78`. Under `ask-on-risk` (`openspec/config.yaml:78`), the budget decision returns to the user before implementation; nothing here invents a chain strategy or size exception. Forecast split:

- Slice 1a — monorepo scaffolding plus core types plus the in-memory journal (AC1–AC4, AC7, AC8, AC10, AC11).
- Slice 1b — runtime `resolve` plus the mandatory-example test plus conceptual documentation (AC5, AC6, AC9, AC14–AC21).
- CI workflow and Changesets configuration (AC12, AC13) sit outside both slices and will be sized explicitly before scheduling.

## Open follow-ups

- OQ1 — artifact filename normalization (`docs/ROADMAP.md:1620,1623` vs `:2453,2456`): deferred to 0.10.0 per Decision 11.
- OQ5 — residual: the artifact format in which the spec phase states the seven answers normatively; acceptance criteria fix traceability, not format.
- OQ12 — `examples/` location stays reserved for the §23 demo; revisit when replay exists (`docs/ROADMAP.md:1000,2462-2464`).
- Run-lifecycle entries: which component writes `run.started`/`run.completed` in 0.0.1 and whether a failed run gets one — design phase; `run.failed` exists only in the 0.0.2 union (`docs/ROADMAP.md:942-956`; vocabulary `docs/adr/0001-effect-vs-event.md:34`).
- Exact field sets of `ModelInvokeInput`/`ToolInvokeInput` and `Message`/`ToolDefinition` — spec phase (Decision 6).
- Scheduling of the CI workflow and Changesets configuration outside slices 1a/1b.

## Conflicts found

1. Roadmap pipeline sketch vs ADR-0007: `docs/ROADMAP.md:434-440` shows `append → execute → append → return` with no journal check, while `docs/adr/0007-exactly-once.md:28-30` requires resolution to check the journal first. Resolution: ADR wins (Decision 1). Impact: `resolve()` deviates from the §5.5 sketch; tests must assert no re-execution (AC6). The concepts stub repeats the pre-ADR pipeline (`docs/concepts/README.md:6`) and must be rewritten in slice 1b.
2. Roadmap two-state sketch vs ADR-0005: `docs/ROADMAP.md:378-386` sketches only `ok | error`, while `docs/adr/0005-errors-and-retries.md:32-33` fixes six states and `:49` rejects a two-state start. Resolution: ADR wins (Decision 2). Impact: the type model ships six states from day one; consumers must handle all six.
3. Verified non-conflict: Decision 4 ships four of the five lifecycle fact kinds listed in ADR-0001 (`docs/adr/0001-effect-vs-event.md:34`); ADR-0001 explicitly permits kinds to grow additively under ADR-0009 (`:75`), and the fifth (`run.failed`) arrives with the 0.0.2 union (`docs/ROADMAP.md:942-956`).
