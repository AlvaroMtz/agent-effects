# Apply Progress — minimal-effect-semantics

Store: `openspec` · Mode: `repo-local` · Branch: `feat/minimal-effect-semantics-1a`
Slice: **1a only** (Tasks 1–3 — workspace scaffolding + core value types + journal/executor contracts). Tasks 4–7 (slices 1b/1c) intentionally untouched.

Native `gentle-ai.sdd-status` v2 consumed before work: `changeName: minimal-effect-semantics`, `artifactStore: openspec`, `applyState: ready`, `nextRecommended: apply`, `actionContext.mode: repo-local`, `allowedEditRoots: ["/Users/hwlap0276/orca/workspaces/agent-effects/fangtooth"]`, no `blockedReasons`. All edits stayed inside the workspace root. No previous apply-progress existed (status: `missing`); this file is the cumulative record.

## Completed tasks

- [x] Task 1 — Root workspace + core package scaffolding (checkbox marked in `tasks.md` immediately on completion). No TDD cycle (harness-building task, per tasks.md). Check evidence: `pnpm install` resolves 2 workspace projects; `pnpm -r test` exits 0 (Vitest runs with the `--passWithNoTests` placeholder; typecheck mode wired).
- [x] Task 2 — Core value types via strict TDD (RED → GREEN → TRIANGULATE → REFACTOR; checkbox marked).
- [x] Task 3 — Core journal + executor contracts via strict TDD (RED → GREEN → TRIANGULATE → REFACTOR; checkbox marked).

## Files changed (slice 1a)

| File | Status | Purpose |
|------|--------|---------|
| `package.json` | new | Workspace root: `packageManager: pnpm@10.33.4`, `engines.node >=22 <23`, root `test`/`typecheck`/`build` passthroughs |
| `pnpm-workspace.yaml` | new | Workspace members: `packages/*` |
| `.nvmrc` | new | Pins `22.20.0` (read by CI in task 7) |
| `tsconfig.json` | new | Root base: ES2022, NodeNext, strict, `declaration`, `isolatedModules`, `verbatimModuleSyntax` |
| `.gitignore` | modified (additive only) | + `node_modules/`, `dist/`, `*.tsbuildinfo`; pre-existing Pi-state entries preserved byte-for-byte |
| `packages/core/package.json` | new | `@agent-effects/core` 0.0.1: ESM, `exports` map, scripts `test` (`vitest run`; placeholder flag removed in task 2), `typecheck` (`tsc --noEmit`), `build` (`tsc`); devDeps vitest ^5.0.1, typescript ^5.9.3, @types/node ^22.20.3 |
| `packages/core/tsconfig.json` | new | Extends root; `outDir dist`, `rootDir src`, include `src` (tests typechecked too) |
| `packages/core/vitest.config.ts` | new | `test.typecheck.enabled` + `typecheck.include: ["src/**/*.test.ts"]` (deviation 1) |
| `packages/core/src/index.ts` | new | Public barrel — 16 of the 18 AC2 names; `export type` for all types, plain `export` only for the `JournalInvariantError` class |
| `packages/core/src/types/support.ts` | new | `JsonValue`, `SerializableError`, `Message`, `ToolDefinition` (design §5.3 verbatim) |
| `packages/core/src/types/effect.ts` | new | `EffectKind`, `Effect<TInput>`, `ToolInvokeInput`, `ModelInvokeInput` (ADR-0002 required producer-assigned `id`/`runId`; ADR-0008 namespaced metadata) |
| `packages/core/src/types/effect-result.ts` | new | `EffectResolutionState`, `EffectErrorCode`, six result interfaces, `EffectResult` union (ADR-0005: all six states day one) |
| `packages/core/src/types/journal.ts` | new | `JournalEntryKind`, four entry interfaces over a module-private `JournalEnvelope`, `JournalEntry` union, `EffectJournal`, `JournalInvariantError` (codes `duplicate-effect-id` \| `missing-request`) |
| `packages/core/src/types/executor.ts` | new | `EffectExecutor.execute(effect): Promise<EffectResult>` (deviation 3) |
| `packages/core/src/runtime.test.ts` | new | Tests #13–17, #20, #21 (task 2) + #19 (task 3) — design §13.3 |
| `pnpm-lock.yaml` | generated | Untracked-new; ships with the slice for AC1 clean-clone reproducibility; not counted as authored lines |

## Test commands run

- `pnpm install` → OK (2 workspace projects, 41 packages).
- `pnpm -r test` → task-by-task evidence below; final state **16 passed (8 runtime + 8 typecheck), 0 type errors, exit 0**.
- `pnpm -r typecheck` → exit 0 (tsc strict, no emit; covers `src/**` including tests).
- `pnpm -r build` → exit 0; emits ESM `dist/index.js` + `.d.ts` (AC11 evidence).

## TDD Cycle Evidence

| Task | Phase | Command | Result |
|------|-------|---------|--------|
| 1 | harness check | `pnpm install` && `pnpm -r test` | install OK; Vitest executes, exit 0 (`--passWithNoTests` placeholder; no tests yet by design) |
| 2 | RED | `pnpm -r test` | exit 1 — `TypeCheckError: Cannot find module './index.js'` + `Cannot find module './types/effect-result.js'` (TS2307 on both missing modules); type-shape contracts do not exist |
| 2 | GREEN | `pnpm -r test` | exit 0 — 14 passed (7 runtime + 7 typecheck), "Type Errors no errors" |
| 2 | GREEN (typecheck) | `pnpm -r typecheck` | exit 0 |
| 2 | TRIANGULATE | `pnpm -r test` | exit 0 — fixtures varied inside existing tests: `model.invoke` JSON round-trip with `tools` + nested metadata; second `SerializableError` with distinct code (`persistence-failed`) + `details` payload |
| 2 | REFACTOR | — | verified: barrel is type-only exports, 11 AC2 names; unions match design §5.3; no code change needed |
| 3 | RED | `pnpm -r test` | exit 1 — test #19 fails: `Unused '@ts-expect-error' directive` (with `JournalEntry`/`JournalEntryKind` missing from the barrel the annotation is unresolved, so the `run.failed` assignment does not error) |
| 3 | GREEN | `pnpm -r test` + `pnpm -r typecheck` | exit 0 — 16 passed (8 runtime + 8 typecheck); `run.failed` directive now load-bearing (union excludes it) |
| 3 | TRIANGULATE | `pnpm -r test` | exit 0 — #19 constructs one entry of each of the four kinds and asserts the exact kind sequence; `run.failed` absence asserted via `@ts-expect-error` (proposal Conflicts #3: arrives in 0.0.2) |
| 3 | REFACTOR | — | verified: names align with spec vocabulary (`JournalEntryKind`, `EffectJournal`, `JournalInvariantError`); barrel at 16/18 AC2 names |
| final | build | `pnpm -r build` | exit 0, ESM output + declarations |

## Deviations from design/tasks

1. **Vitest typecheck mode** (`vitest.config.ts`) instead of the tasks' plain `vitest run` letter: type-only assertions are erased by esbuild under plain vitest, so type-shape RED (#13–17, #19–21) requires the typechecker. Binding strict-TDD constraint wins. Double-running each matching file (runtime + typecheck suites) is accepted.
2. **Cross-file imports between type modules** (`effect.ts`→`support.ts`, `effect-result.ts`→`support.ts`, `journal.ts`→`effect-result.ts`, `executor.ts`→`effect.ts`+`effect-result.ts`): design §5.2 says "no cross-file imports" but the §5.3 sketches themselves reference across modules; followed §5.3 for a single source of truth.
3. **Non-generic `EffectExecutor.execute`**: `execute(effect: Effect): Promise<EffectResult>` — the §5.3 sketch's `execute<T = unknown>(...): Promise<EffectResult<T>>` parameterizes a non-generic `EffectResult` (TS2347). ⚠️ Carries into slice 1b: design's `EffectRuntime.resolve<T>` sketch has the same issue and must be resolved when `runtime.ts` is written (task 5).
4. **Barrel at 16/18 AC2 names**: `EffectRuntime` + `createRuntime` arrive with task 5 per the task sequencing (they are implemented in slice 1b, not deferred in scope).
5. **expect-type union limitation**: `toEqualTypeOf` reports spurious mismatches on heterogeneous object unions ("Expected never, Actual boolean" branding artifacts), so union membership is asserted via compile-time assignments (`const asUnion: EffectResult = result`) plus field-level `expectTypeOf`.
6. **`.gitignore` additions** (not in design §12.1's file list): `node_modules/`, `dist/`, `*.tsbuildinfo` — required for a clean, independently revertable slice tree. Pre-existing Pi-state entries preserved.
7. **Module-private entry interfaces**: `RunStartedEntry` etc. are not exported from `journal.ts` (design §5.3 sketch omits `export`); consumers name the `JournalEntry` union. `runId` lives once on `JournalEnvelope` (the sketch's per-entry repeat is an identical redundant redeclaration).
8. **Tool versions**: `typescript ^5.9.3` (mature 5.x line rather than the brand-new TS 7.0.2 major) chosen for vitest-typecheck compatibility; `vitest ^5.0.1`; `@types/node ^22.20.3` matching the engines pin. No version was mandated by the artifacts.

## Slice 1b — Task 4 (`@agent-effects/journal-memory`)

Branch: `feat/minimal-effect-semantics-1b`. Implemented directly (no SDD phase agent) at the user's explicit request in this session; the artifacts stay the plan of record.

| Phase | Command | Result |
|-------|---------|--------|
| RED | `pnpm -r test` | exit 1 — `Cannot find module './memory.js'`; the 7 journal tests cannot run |
| GREEN | `pnpm -r test` | exit 0 — 23 passed (16 core = 8 tests under the runtime and typecheck suites + 7 journal-memory), after the dist-collection fix below |
| GREEN | `pnpm -r typecheck` | exit 0 |
| GREEN | `pnpm -r build` | exit 0 |

TRIANGULATE and REFACTOR ran inside the same cycle: all four entry kinds appended in
lifecycle order, a second run asserting the per-run counter scope, a writer that stays
usable after a rejected duplicate, and a secret-like payload round-tripped through both
`entries()` and `findResult`; the two invariants live in named guards
(`rejectDuplicateEffectId`, `rejectMissingRequest`).

### Correction — inflated test counts (task 4)

Vitest was collecting `dist/**/*.test.js`, the compiled copy of each suite, so every
test ran twice and the reported totals were wrong: the slice-1a "24 passed" recorded in
`## Parent reconciliation` was 8 distinct core tests counted three times (runtime suite,
typecheck suite, compiled copy), not type-level surplus coverage. Fixed by excluding
`**/dist/**` from `test.exclude` in both Vitest configs and by building through a
`tsconfig.build.json` that excludes `src/**/*.test.ts`, so no test is emitted to `dist`
at all. Real counts today: **8 distinct core tests** (16 reported, runtime plus
typecheck) and **7 journal-memory tests** — 15 distinct, matching design §13.2's plan of
15 core plus 6 journal once task 5 adds the remaining 7 core tests. AC15 (≥21) is
therefore not met yet and is met by task 5, exactly as the plan sequenced it.

### Deviations (task 4)

9. **`JournalEntryDraft` added to core; `EffectJournal.append` now takes it.** Design §5.3
   declares `append(entry: JournalEntry)`, which forces the caller to supply `sequence`,
   `schemaVersion` and `timestamp` — while §6.3 step 4, ADR-0003 and ADR-0009 require the
   *writer* to assign exactly those three at append time. The two cannot both hold. The
   spec side wins: `JournalEntryDraft` is `JournalEntry` minus the three writer-assigned
   envelope fields, and `JournalEntry` stays the stored/read shape. Public surface is now
   19 names (AC2 said 18); task 5's runtime consumes the draft type instead of forging a
   sequence it has no counter for.
10. **Workspace resolution from source.** Both manifests expose `exports` -> `./src/index.ts`
   with a `publishConfig` block that rewrites `main`/`types`/`exports` to `dist` on publish
   (nothing is published in 0.0.1). This keeps a clean clone green under
   `pnpm install && pnpm -r test` with no build step, which AC1 requires and which a
   `dist`-only exports map would break in CI (task 7 runs install -> typecheck -> test).
11. **`MemoryEffectJournal.entries(runId)` reader.** Not in design §6.3's two-method sketch,
   but `specs/journal/spec.md` -> Requirement "Append-Only Source of Truth" specifies that
   earlier entries are readable unchanged in append order, and tests #9, #10 and #12 assert
   on stamped envelope fields that `findResult` does not expose. It is additive to
   `EffectJournal`, which journal-memory still implements as declared.

## Slice 1b — Task 5 (`createRuntime` / `resolve`)

| Phase | Command | Result |
|-------|---------|--------|
| RED | `pnpm --filter @agent-effects/core test` | exit 1 — 10 failed: `createRuntime is not a function` plus `TypeCheckError: Module "./index.js" has no exported member 'createRuntime'` |
| GREEN | `pnpm -r test` | exit 0 — core 36 reported (18 distinct tests under the runtime and typecheck suites), journal-memory 7 |
| GREEN | `pnpm -r typecheck` | exit 0 |
| GREEN | `pnpm -r build` | exit 0, no test emitted to `dist` |

Matrix rows #1–#6 and #11 land here; TRIANGULATE adds a `model.invoke` effect through
the same runtime, a thrown executor, and a non-terminal executor result. REFACTOR keeps
the pipeline flat with named helpers (`hasUsableId`, `attemptExecution`,
`mapRequestFailure`, `isTerminal`).

**AC15 is met**: 25 distinct tests (18 core + 7 journal-memory) against the 21 the
milestone requires.

### Deviations (task 5)

12. **A thrown executor maps to `execution-failed`.** Design §7.3 enumerates the failure
   branches as "complete, no unreachable branches" and lists only the two append
   failures, but `specs/effect-core/spec.md` → Requirement "Persistence and Execution
   Failures Have Defined Outcomes" states that an executor which fails maps to the
   execution-failure code, and Requirement "Effect Results Have Six Resolution States"
   forbids native exceptions crossing the boundary. The spec wins: `attemptExecution`
   catches and converts. The design table is incomplete, not contradictory.
13. **A non-terminal executor result is returned without a resolution entry.**
   `EffectResolvedEntry.result` admits only `ok` and `error` — pending is never
   journaled (design §11, and the type shipped in task 3). If an executor returns
   `pending`, `cancelled`, `denied` or `unknown`, the runtime returns it unchanged and
   records no resolution fact, because nothing terminal happened. The 0.0.1 runtime
   itself still produces only `ok`, `error` and `unknown`.
14. **`findResult` failures are not mapped.** No requirement or design branch assigns an
   outcome to a journal that throws during lookup, so the runtime does not invent one and
   the rejection propagates. Worth closing in 0.0.2 alongside the run-lifecycle entries.

## Slice 1b — Task 6 (`docs/concepts/README.md`) and the delivery decision

Task 6 replaces the stub. The superseded `validate -> policy -> execute -> journal ->
result` sketch is not merely deleted: it is named and marked superseded, because proposal
Conflicts #1 is about implementers following the old ordering, and a reader who remembers
the old sketch needs to be told it is wrong. All seven roadmap exit-criteria questions are
answered with their own section, each closing with the named spec requirement that states
the answer normatively. The ADR-0007 disclosure sentence appears verbatim, ADR-0004's
locked "effect-level deterministic replay" wording is used and the forbidden phrasing is
explicitly disclaimed, and ADR-0010's sensitive-by-default posture ships with the
deferred-hook disclosure. English only.

### Delivery decision — `size:exception` accepted

| Field | Value |
|-------|-------|
| Slice | 1b (tasks 4–6) |
| Authored lines | 748 source and config, 841 including these artifacts (`pnpm-lock.yaml` excluded as generated) |
| Review budget | 400 |
| Decision | maintainer accepted `size:exception` on 2026-09-18; no chain strategy is needed for this slice |

The slice is not shrinkable without dishonesty: roughly 375 lines are the strict-TDD test
suites themselves, the runtime and journal are the deliverable, and the concepts document
is a named acceptance criterion (AC14, AC17–AC21). `delivery_strategy` is recorded as
`exception-ok` in `tasks.md`.

## Slice 1c — Task 7 (CI + Changesets)

`.github/workflows/ci.yml` runs on push and pull_request: checkout, pnpm via
`pnpm/action-setup` (which reads the root `packageManager` pin), Node from `.nvmrc` with
the pnpm store cached, then `pnpm install --frozen-lockfile`, `pnpm -r typecheck` and
`pnpm -r test`. Changesets is initialized with `@changesets/cli` in the root
devDependencies and `.changeset/config.json` on `baseBranch: main`; no version bump and no
release run in 0.0.1.

### Checks

| Check | Evidence |
|-------|----------|
| AC1 — clean clone needs no build | `dist/` removed, then `pnpm -r test` and `pnpm -r typecheck` both exit 0 |
| AC15 — ≥21 tests | 25 distinct (18 core, reported as 36 across the runtime and typecheck suites, plus 7 journal-memory) |
| AC16 — no framework/CLI/database/HTTP/policy dependency | the only runtime dependency in any manifest is `@agent-effects/core` as a workspace link; devDependencies are vitest, typescript, @types/node, and @changesets/cli at the root |

### Deviations (task 7)

15. **`.changeset/config.json` written by hand.** `changeset init` is interactive in
   v3.0.3 (it prompts for the GitHub changelog integration) and cannot run
   non-interactively here. The config is the v3 default for the "no GitHub integration"
   answer, and `pnpm exec changeset status` parses it and resolves the workspace against
   `main`, which is the validation that matters. Its non-zero exit only reports that
   changed packages carry no changeset, which is the intended 0.0.1 state.
16. **CI does not run `build`.** Design §12.4 scopes the workflow to install, typecheck
   and test, so `pnpm -r build` stays a local check. Worth adding when 0.0.2 starts
   publishing anything.

## Remaining tasks (unchecked in tasks.md)

None — tasks 1–7 are complete.


## Workload / PR boundary

- **Slice boundary**: Tasks 1–3 only, on branch `feat/minimal-effect-semantics-1a` — the resolved delivery path for this apply (chosen chained-PR mode; slices 1b = tasks 4–6, 1c = task 7 are separate PRs).
- **Final authored line count: 527** (524 across the 14 new/edited source/config files + 3 `.gitignore` lines; `pnpm-lock.yaml` excluded as generated). Per task: 1 ≈ 80, 2 ≈ 281, 3 ≈ 163 + 3.
- **Budget status**: over the 400-line review budget and over the slice's ~315 estimate → **`size:exception` recommended** for this slice-PR. It cannot shrink honestly: ~200 lines are the strict-TDD RED tests themselves, the type declarations are the deliverable (not incidental code), and JSDoc lines carry the ADR/spec traceability the design mandates. The gate forbids deleting comments or tests to reach the number, and the slice is already the minimal cohesive unit — splitting the tests from the contracts they RED/GREEN would orphan the evidence.
- If the maintainer prefers strict budget adherence instead, the only honest fallback is re-slicing (e.g., task 1+2 as PR 1, task 3 folded into PR 2) — a chain-strategy decision, not a code change.

## Parent reconciliation (post-gate)

The orchestrator gate confirmed the slice-1a artifact directly: `pnpm -r test` 24 passed / exit 0, `pnpm -r typecheck` and `pnpm -r build` exit 0, `tasks.md` showing tasks 1–3 `- [x]` and 4–7 `- [ ]`, and every changed path inside the declared surfaces. Three reconciliations follow; the deviations above are preserved as the historical record.

- **Deviation 3 is closed at the design level.** The invalid `EffectResult<T>` parameterization in design §5.3 (both `EffectExecutor.execute` and `EffectRuntime.resolve`) was corrected in place, and the sketch now records why (`EffectResult` is a non-generic union; `EffectResult<T>` is TS2347). Task 5 must implement the corrected non-generic signature; the warning in deviation 3 no longer applies.
- **`AC2` in the slice table was corrected** to read "AC2 partial (16 of 18 public names)" for slice 1a, matching the reported barrel coverage; `EffectRuntime` and `createRuntime` complete AC2 in slice 1b with task 5.
- **Test-count accounting.** `pnpm -r test` reports 24 passing tests because Vitest typecheck mode counts each type-assertion suite alongside the 8 runtime tests. The design §13.2 expectation (15 core + 6 journal = 21) remains the milestone-level plan; the surplus is type-level coverage for the same matrix rows #13–#21 and satisfies AC15 without adding new scenarios.

## Verification pointer

Implementation is complete for tasks 1–3 and all slice checks pass; slice 1a's coverage is AC2 partial (16/18 names), AC3, AC11 and the first half of AC1, per the evidence above. Native status still selects verify/archive on its own state; change-level verification is not possible yet because tasks 4–7 remain unchecked by design.
