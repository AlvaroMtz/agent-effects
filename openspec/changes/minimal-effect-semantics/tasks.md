# Tasks — minimal-effect-semantics

Ordered work units derived from `design.md` §12 (file-level change plan) and
§13 (strict-TDD test matrix), `specs/effect-core/spec.md`,
`specs/journal/spec.md`, and the proposal delivery forecast. Strict TDD
(`openspec/config.yaml`: RED → GREEN → TRIANGULATE → REFACTOR) is sequenced
inside each owning task with the binding command `pnpm -r test`; tests and
docs ship in the same work unit as the behavior they cover. Every TDD task
records RED and GREEN evidence (failing and passing `pnpm -r test` output)
in the apply notes.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~666 per design §12; this plan sizes ~640–700 including strict-TDD test-first deltas |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | Slice 1a: scaffolding + core types + contracts (~315) → Slice 1b: journal-memory + runtime + concepts docs (~350) → Slice 1c: CI + Changesets (~35) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

## Slices

Sizing refinement vs `proposal.md` §Delivery forecast: strict TDD pulls the
eight type-shape tests (~64 lines of `packages/core/src/runtime.test.ts`)
into the same work units as the type declarations (RED precedes GREEN), which
pushes the forecast slice 1a (~386) past the 400-line budget. Slice membership
below moves `@agent-effects/journal-memory` into slice 1b so both slices stay
≤ ~400 lines. The CI workflow and Changesets stay outside both slices and are
sized explicitly here, as the proposal requires. All acceptance criteria
remain covered; the chained-PR strategy itself is not chosen in this artifact.

| Slice | Work units | Est. lines | Acceptance criteria covered |
|-------|------------|------------|------------------------------|
| Slice 1a — Workspace + core types + contracts | Tasks 1–3 | ~315 | AC3, AC11; AC2 partial (16 of 18 public names — `EffectRuntime`/`createRuntime` land with task 5 in 1b); AC1 first half (install + harness) |
| Slice 1b — In-memory journal + runtime + docs | Tasks 4–6 | ~350 | AC4–AC10, AC14–AC22; completes AC1 and AC15 |
| Slice 1c — CI + Changesets (outside 1a/1b) | Task 7 | ~35 | AC12, AC13 |

Each slice is an autonomous work unit: it starts from a green tree, ends with
`pnpm -r test` and `pnpm -r typecheck` green, and reverts independently
(git revert of the slice's commits restores the prior state; the change is
additive). Dependency order: 1 → 2 → 3 → 4 → 5 → 6 and 7 (tasks 4 and 5
depend on 3; tasks 6 and 7 settle after 5).

## Tasks

- [x] 1. Root workspace + core package scaffolding (scaffolding-first: no test is runnable before this task).
  - Files: `package.json`, `pnpm-workspace.yaml`, `.nvmrc`, `tsconfig.json`, `packages/core/package.json`, `packages/core/tsconfig.json`.
  - Work: root manifest with pnpm `packageManager` and `engines` pinned to Node LTS (AC11); `pnpm-workspace.yaml` listing `packages/*`; `.nvmrc` LTS pin; root base tsconfig extended by per-package tsconfigs (design §12.1); `@agent-effects/core` manifest with `"type": "module"`, ESM `exports`, devDependencies `vitest`/`typescript`/`@types/node`, scripts `test` (`vitest run --passWithNoTests` placeholder until Task 2's RED removes it), `typecheck` (`tsc --noEmit`), `build` (`tsc`) (design §12.2 purpose "ESM, strict, vitest"; AC1, AC12).
  - Refs: `design.md` §12.1–§12.2; proposal AC1, AC11; `docs/ROADMAP.md` 0.0.1 deliverables (monorepo, TypeScript strict, ESM, Node LTS).
  - No TDD cycle here: this task builds the harness that makes later RED steps possible; its check is the harness itself.
  - Check: `pnpm install` resolves the workspace and links `@agent-effects/core`; `pnpm -r test` executes Vitest and exits 0.
  - Est. lines: 42.

- [x] 2. Core value types — Effect, EffectResult, supporting types (strict TDD inside this task).
  - Files: `packages/core/src/runtime.test.ts` (new), `packages/core/src/types/support.ts`, `packages/core/src/types/effect.ts`, `packages/core/src/types/effect-result.ts`, `packages/core/src/index.ts`, `packages/core/package.json` (remove the `--passWithNoTests` placeholder).
  - RED: write tests #13 `tool.invoke input has tool and arguments`, #14 `model.invoke input has messages and model`, #15 `error result carries code and message`, #16 `ok result carries output value`, #17 `error result carries serializable error`, #20 `effect round-trips through JSON stringify/parse`, #21 `EffectKind type allows only tool.invoke and model.invoke` (design §13.3 rows 13–17, 20–21). Run `pnpm -r test` → fails because the types do not exist; record RED evidence.
  - GREEN: implement `support.ts` (JsonValue, SerializableError, Message, ToolDefinition); `effect.ts` (Effect with producer-assigned required `id`/`runId` per ADR-0002, EffectKind, ToolInvokeInput, ModelInvokeInput, metadata `Record<string, JsonValue>` per ADR-0008); `effect-result.ts` (six-state union including pending/cancelled/denied/unknown that 0.0.1 does not produce — design §11, ADR-0005 §3; error variants carrying SerializableError and codes error/persistence-failed/invalid-request); start the type-only barrel `index.ts`. Run `pnpm -r test` → green; record GREEN evidence.
  - TRIANGULATE: vary fixtures (model.invoke round-trip, a distinct SerializableError code, a metadata payload) so shapes are not overfit to the weather example.
  - REFACTOR: tighten unions and exports; keep the public surface aligned with AC2.
  - Refs: `specs/effect-core/spec.md` → Requirements "Effect Kinds in Scope", "Effect Results Have Six Resolution States", "Effect Is a Serializable Request"; design §12.2.
  - Check: `pnpm -r test` green with #13–17, #20–21 passing; `pnpm -r typecheck` green.
  - Est. lines: ~190.

- [x] 3. Core journal + executor contracts, incl. JournalInvariantError (strict TDD inside this task).
  - Files: `packages/core/src/runtime.test.ts`, `packages/core/src/types/journal.ts`, `packages/core/src/types/executor.ts`, `packages/core/src/index.ts`.
  - RED: add test #19 `JournalEntry union covers all four kinds` (design §13.3 row 19) → fails; record RED evidence.
  - GREEN: implement `journal.ts` (EffectJournal with async `append`/`findResult`; JournalEntry union covering effect.requested, effect.resolved, run.started, run.completed; `schemaVersion: "1.0"` per design §9.2, ADR-0009; JournalInvariantError declared in core with codes `duplicate-effect-id` and `missing-request` per design §14 — journal-memory imports it from core, keeping the dependency direction journal-memory → core only); `executor.ts` (EffectExecutor); extend `index.ts`. Run `pnpm -r test` → green; record GREEN evidence.
  - TRIANGULATE: construct one entry of each of the four kinds; confirm `run.failed` is absent from the 0.0.1 union (proposal Conflicts #3 — it arrives in 0.0.2).
  - REFACTOR: align type names with spec vocabulary; finalize the AC2 public surface (five abstractions + entry model + supporting types).
  - Refs: `specs/journal/spec.md` → Requirement "Entry Kinds in Scope" (Scenario: four kinds cover the run lifecycle); design §12.2, §9.2, §14.
  - Check: `pnpm -r test` green including #19; `pnpm -r typecheck` green.
  - Est. lines: ~80.

- [ ] 4. @agent-effects/journal-memory — MemoryEffectJournal with append-time invariants (strict TDD inside this task).
  - Files: `packages/journal-memory/package.json`, `packages/journal-memory/tsconfig.json`, `packages/journal-memory/src/memory.test.ts` (new), `packages/journal-memory/src/memory.ts`, `packages/journal-memory/src/index.ts`.
  - Scaffold: package manifest (ESM, strict, vitest) with a workspace dependency on `@agent-effects/core` only (design §12.3; dependency direction journal-memory → core only, design §14).
  - RED: write tests #7 `append effect.resolved without prior request rejects` (assert JournalInvariantError code `missing-request`), #8 `append duplicate effect.requested rejects` (code `duplicate-effect-id`), #9 `sequence increases with each append`, #10 `every entry carries schemaVersion at creation` (value `"1.0"`), #12 `entries with secret-like values stored verbatim`, #18 `findResult returns full result from journal` (design §13.3 rows 7–10, 12, 18) → module missing, `pnpm -r test` fails; record RED evidence.
  - GREEN: implement `memory.ts` (append enforces the two invariants before writing, stamps a strictly monotonic per-run sequence and schemaVersion `"1.0"` at creation, never mutates or redacts entries; findResult returns the recorded full EffectResult or its absence; process-local store) and the single re-export barrel `index.ts`. Run `pnpm -r test` → green; record GREEN evidence.
  - TRIANGULATE: append all four entry kinds in sequence; append a different effect after a rejected duplicate (writer stays usable); round-trip a secret-like output through append and findResult verbatim.
  - REFACTOR: extract the two invariant guards into named checks; document the one-journal-instance-per-run convention in code (design §14; `specs/journal/spec.md` → Requirement "The In-Memory Backend Is Process-Local").
  - Refs: `specs/journal/spec.md` → Requirements "Append-Time Invariants Are Enforced by the Writer", "Strictly Monotonic Per-Run Sequence", "Every Entry Carries a Schema Version", "Entries Are Sensitive by Default", "Lookup Returns the Recorded Resolution or Its Absence"; ADR-0003, ADR-0009, ADR-0010; design §12.3.
  - Check: `pnpm -r test` green with #7–10, #12, #18 passing; `pnpm -r typecheck` green.
  - Est. lines: ~145.

- [ ] 5. Runtime — createRuntime/resolve journal-first pipeline + mandatory example (strict TDD inside this task).
  - Files: `packages/core/src/runtime.test.ts`, `packages/core/src/runtime.ts`, `packages/core/src/index.ts`.
  - RED: add tests #1 `resolve weather tool for Madrid returns ok` (roadmap 0.0.1 mandatory example: `createRuntime({ executor, journal })` resolves fx_1/run_1/tool.invoke weather Madrid to ok), #2 `resolve already-resolved effect without calling executor` (assert executor not invoked on the second resolve), #3 `resolve effect without id returns invalid-request`, #4 `journal append failure on request returns persistence-failed`, #5 `journal append failure on result returns unknown`, #6 `duplicate id rejected as invalid-request`, #11 `resolve with adapter metadata preserves metadata` (design §13.3 rows 1–6, 11). EffectJournal doubles are defined inside `runtime.test.ts` — core must not depend on journal-memory (design §14). `pnpm -r test` fails; record RED evidence.
  - GREEN: implement `runtime.ts`: sync `createRuntime({ executor, journal })` (no runId parameter; no shutdown/run-lifecycle API in 0.0.1 — design §14 tradeoff "Run-lifecycle entries"); `resolve` pipeline: validate id → findResult (journal-first reuse without execution) → append effect.requested (failure → error/persistence-failed) → one executor attempt → append effect.resolved (any Error → unknown, design §14) → return result; the runtime appends exactly effect.requested + effect.resolved. Extend `index.ts` with runtime exports. `pnpm -r test` → green; record GREEN evidence.
  - TRIANGULATE: push a second distinct tool.invoke effect and a model.invoke effect through the same runtime; exercise the request-append and resolved-append failure doubles independently.
  - REFACTOR: extract the failure-mapping helper (JournalInvariantError.code → invalid-request; request-append failure → persistence-failed; resolved-append failure → unknown); keep the pipeline flat and readable.
  - Refs: `specs/effect-core/spec.md` → Requirements "The Documented Weather Example Resolves Successfully", "Resolution Consults the Journal First", "At Most One Execution Attempt per Recorded Occurrence", "Identity Is Validated at the Boundary", "Persistence and Execution Failures Have Defined Outcomes", "Effect Is a Serializable Request" (metadata scenario); ADR-0004, ADR-0007, ADR-0008; design §12.2, §13.1–§13.2.
  - Check: `pnpm -r test` green with all 21 matrix tests present (AC15); executor invoked at most once per recorded occurrence (AC6).
  - Est. lines: ~125.

- [ ] 6. Rewrite docs/concepts/README.md — exit-criteria answers and ADR-locked wording (docs ship inside slice 1b with the behavior; non-code task).
  - Files: `docs/concepts/README.md` (rewrite the stub).
  - Work: replace the stub's pre-ADR `append → execute → append` sketch with the journal-first pipeline (proposal Conflicts #1); answer the seven roadmap 0.0.1 exit-criteria questions, each traceable to a named spec requirement (AC17–AC21; `specs/effect-core/spec.md` → Requirement "Exit-Criteria Answers Are Traceable to This Specification"); carry the ADR-0004 locked wording, the ADR-0007 no-exactly-once disclosure sentence, and the ADR-0010 sensitive-by-default posture with the deferred-redaction disclosure (AC14; design §10.2 — the hook seam is documented, not implemented); document the six resolution states including the three 0.0.1 never produces (design §11) and the one-journal-instance-per-run convention (design §14).
  - Refs: design §10, §11, §14, §16 (risk row "Documentation deliverable is load-bearing"); `docs/ROADMAP.md` 0.0.1 exit criteria; `docs/concepts/README.md` stub.
  - Check: no pre-ADR pipeline language remains; each of the seven questions maps to a named spec requirement; English only.
  - Est. lines: ~80.

- [ ] 7. CI workflow + Changesets (sized explicitly here; sits outside slices 1a/1b per the proposal forecast).
  - Files: `.github/workflows/ci.yml`, `.changeset/config.json`, `package.json` (add @changesets/cli devDependency).
  - Work: CI runs install (`pnpm install --frozen-lockfile`), typecheck (`pnpm -r typecheck`), and `pnpm -r test` on push and pull_request, using Node LTS from `.nvmrc` (design §12.4; AC12). Initialize Changesets with no version bump and no release executed in 0.0.1 (design §12.4 `changes/` row; AC13).
  - Refs: design §12.4; proposal §Delivery forecast third bullet; `docs/ROADMAP.md` 0.0.1 deliverables (CI, changesets).
  - Check: CI green on the PR; a clean clone passes `pnpm install` and `pnpm -r test` (AC1); the suite reports ≥21 passing tests (AC15); no framework/CLI/database/HTTP/policy dependency appears in any manifest (AC16 spot check).
  - Est. lines: ~35.

Deferred per design §15 (explicitly not tasks here): framework integration,
CLI/HTTP/database/UI, policy/capabilities, JSONL journal (0.0.2), replay
runtime (0.0.3), testing toolkit (0.0.4), adapters (0.0.5), threat model and
redaction hook (0.12.0).

End of work units — 21-test matrix complete; slice boundaries per Review Workload Forecast.
