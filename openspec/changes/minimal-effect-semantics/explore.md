# Exploration — minimal-effect-semantics (milestone 0.0.1)

Status: `done`
Phase: `explore`
Artifact store: `openspec`

## Provenance and harness deviation

This artifact was authored by the parent orchestrator from a read-only exploration report produced by a
generic exploration agent (`gentle-ai-explore`). The shipped SDD phase executor (`sdd-explore`) could not
be used in this session: every dispatch of a phase agent stalls. Three dispatches timed out at
`prompt accepted` with 0 turns and no child session file. The stall was reproduced outside the runner and
isolated to the delegated prompt text: a child that receives a prompt naming the SDD phase
(`Run the SDD explore phase for ...`) is accepted (`success: true`) and then blocks indefinitely at 0% CPU
(state `Ss`), while the same prompt phrased as plain work text starts the agent loop in ~2.5 s. The stall is
independent of the model (`nan/deepseek-v4-flash`, `nan/glm5.3-flash`), of the prompt size, of backticks, and
of the injected `## SDD Session Preflight` block.

The exploration analysis itself was performed with read-only tools and is evidence-backed. CodeGraph was
unavailable in this workspace (binary not found), so all evidence comes from `read`/`grep`/`find`, with
`path:line` citations verified against the files on disk. No source file was modified.

## Scope inspected

- Milestone chapter `0.0.1`: `docs/ROADMAP.md:841-929`.
- Type and pipeline sketches: `docs/ROADMAP.md:351-440`, `:470-496`.
- Journal kinds: `docs/ROADMAP.md:131-136`; journal envelope: `:942-956`.
- Repository layout: `docs/ROADMAP.md:2400-2470` (section 25).
- Binding decisions: `docs/adr/0001` … `docs/adr/0010`.
- Project configuration: `openspec/config.yaml`.

## 1. Requirements (milestone 0.0.1)

| ID | Requirement | Source |
| --- | --- | --- |
| R1 | Objective: prove that `Effect → Executor → Result → Journal` is a coherent abstraction. | `docs/ROADMAP.md:845` |
| R2 | No framework integration in this milestone. | `docs/ROADMAP.md:847` |
| R3 | Implement only: `Effect`, `EffectResult`, `EffectExecutor`, `EffectJournal`, `EffectRuntime`. | `docs/ROADMAP.md:851-858` |
| R4 | Initial effects: `tool.invoke` and `model.invoke` only. | `docs/ROADMAP.md:861-865` |
| R5 | Journal backend: in-memory. | `docs/ROADMAP.md:868-871` |
| R6 | Mandatory example: `createRuntime({ executor, journal })` resolving `fx_1` / `run_1` / `tool.invoke` (weather, Madrid). | `docs/ROADMAP.md:874-893` |
| R7 | Deliverables: monorepo; `@agent-effects/core`; `@agent-effects/journal-memory`; TypeScript strict; ESM; Node current LTS; CI; semantic-release **or** changesets; conceptual documentation; 20+ unit tests. | `docs/ROADMAP.md:895-906` |
| R8 | Not included: CLI, LangGraph, OpenAI adapter, database, HTTP, UI, policy, capabilities. | `docs/ROADMAP.md:908-917` |
| R9 | Exit criteria: seven questions must be answered clearly before publishing `0.0.2` — what an Effect is; what is not an Effect; who generates the ID; when it is written to the journal; how errors are represented; what happens if the journal fails; what if the executor completes but the result cannot be persisted. | `docs/ROADMAP.md:919-929` |

The roadmap also supplies requirement-by-sketch type shapes: `Effect` (`docs/ROADMAP.md:354-366`),
`EffectResult` (`:375-386`), `EffectExecutor` (`:396-399`), `EffectJournal` (`:408-416`),
`EffectRuntime` and the resolve pipeline (`:422-440`), `ModelInvokeInput` (`:470-480`),
`ToolInvokeInput` (`:492-496`).

## 2. Current state

Complete and trustworthy: `docs/ROADMAP.md` (founding document, Spanish, 2638 lines), `docs/adr/0001-0010`
plus index, root `README.md`, `openspec/config.yaml`.

Placeholders only (README stubs, all stating "Status: stub. No code yet"): every `packages/*/README.md`
(`packages/core/README.md:8`, `packages/journal-memory/README.md:7`, seven further packages),
`spec/README.md`, `schemas/README.md`, `fixtures/README.md`, `examples/README.md`, `conformance/README.md`,
`docs/concepts/README.md:8`.

Absent entirely (verified by tree-wide search): any `package.json`, `tsconfig*.json`, lockfile,
`pnpm-workspace.yaml`, test runner configuration, linter configuration, or CI configuration. There are zero
`.ts`/`.js` files outside documentation. `openspec/config.yaml:32-34` states this explicitly.
`openspec/changes/minimal-effect-semantics/` existed but was empty; this exploration is its first artifact.

## 3. Deliverables map

Legend: exists / stub only / must be created; plus the ADRs that constrain the deliverable.

| Deliverable | Status | Evidence | Constraining ADRs |
| --- | --- | --- | --- |
| Monorepo scaffolding (workspaces, package manifests, tsconfigs, lockfile) | must be created | no manifests anywhere; `openspec/config.yaml:32-34` | none; stack fixed by `openspec/config.yaml:28-33` |
| `@agent-effects/core` package | stub → must be created | `packages/core/README.md:3,8` | 0001, 0002, 0003, 0005, 0006, 0007, 0008 |
| `Effect` type | must be created | sketch `docs/ROADMAP.md:354-366` | 0001 (serializable), 0002 (identity), 0006 (causality fields), 0008 (portable fields vs metadata) |
| `EffectResult` type | must be created | sketch `docs/ROADMAP.md:375-386` | 0005 (error shape and resolution states) |
| `EffectExecutor` interface | must be created | sketch `docs/ROADMAP.md:396-399` | 0007 (at most one attempt per recorded occurrence) |
| `EffectJournal` interface | must be created | sketch `docs/ROADMAP.md:408-416` | 0003 (append-only, monotonic sequence, invariants), 0009 (schemaVersion), 0010 (write-boundary redaction hook) |
| `EffectRuntime` + `createRuntime`/`resolve` | must be created | sketch `docs/ROADMAP.md:422-440`; example `:877` | 0007 (journal-first), 0002 (reject missing ID), 0005 (failure codes), 0001 (request/result split) |
| `tool.invoke` / `model.invoke` inputs | must be created | `docs/ROADMAP.md:452-463`, `:470-496` | 0008 |
| `JournalEntry` model for 0.0.1 | must be created (shape undecided) | referenced `docs/ROADMAP.md:409`; union introduced at `:942-956` | 0003, 0009 |
| `SerializableError` | must be created | referenced `docs/ROADMAP.md:385`; shape in ADR-0005 | 0005, 0009 |
| `JsonValue` | must be created | referenced `docs/ROADMAP.md:366,494`; defined nowhere | 0001 |
| `Message`, `ToolDefinition` | must be created | referenced `docs/ROADMAP.md:474,476`; defined nowhere | 0008 |
| `@agent-effects/journal-memory` | stub → must be created | `packages/journal-memory/README.md:3,7` | 0003 (in-memory first), 0009, 0010 |
| Conceptual documentation | stub → must be created | `docs/concepts/README.md:3,8` | 0001, 0004 (locked wording), 0007 (disclosure sentence), 0010 (default posture) |
| 20+ unit tests | must be created | `docs/ROADMAP.md:906`; no runner exists | none directly; strict TDD per `openspec/config.yaml:59-69` |
| CI | must be created | `docs/ROADMAP.md:903`; no CI config exists | none |
| Release tooling (semantic-release or changesets) | must be created (choice open) | `docs/ROADMAP.md:904` | none |
| Mandatory example as runnable artifact | must be created | `docs/ROADMAP.md:874-893` | 0002, 0003, 0007 |

## 4. ADR bindings

- **ADR-0001** — effects are requests, journal entries are facts: `docs/adr/0001-effect-vs-event.md:28,34`.
  Fixes the split between the request pipeline and what the journal may contain.
- **ADR-0002** — `Effect.id` is producer-assigned, opaque, required at the boundary; the runtime rejects an
  effect without an ID as `invalid-request` and validates uniqueness within a run:
  `docs/adr/0002-effect-identity.md:25,33-35`.
- **ADR-0003** — the journal is the append-only source of truth, `sequence` is strictly monotonic and
  assigned at append time, every entry carries `schemaVersion`, and invariants are enforced by writers and
  validators: `docs/adr/0003-journal-append-only.md:25,28,31-34`. Backend order: in-memory (0.0.1), JSONL
  (0.0.2): `:36`.
- **ADR-0004** — replay semantics: the wording "effect-level deterministic replay" is locked for all
  documentation: `docs/adr/0004-replay-semantics.md:32-33`; `passthrough`/`mock` deferred past 0.1.0: `:35`.
- **ADR-0005** — portable error shape `SerializableError { code, message, details?, retryable? }`: `:27`;
  failure sites `policy-denied`, `invalid-request`, `execution-failed`, `persistence-failed`, `run-failed`,
  `cancelled`: `:30-31`; resolution states `ok | error | pending | cancelled | denied | unknown`: `:32-33`;
  a retry is a new Effect with a fresh ID: `:36`; shipping only `ok`/`error` first was explicitly rejected:
  `:49`.
- **ADR-0006** — `sequence` records append order only; causality is explicit through `parentEffectId` and
  `retryOf`: `docs/adr/0006-concurrency.md:24,27`; no logical clocks in core for 0.x.
- **ADR-0007** — no exactly-once promise for arbitrary external side effects: `:25`; at most one execution
  attempt per recorded effect occurrence, with resolution checking the journal first: `:28-30`; mandated
  disclosure sentence at `:14`.
- **ADR-0008** — the portable contract is typed core fields only: `:24`; adapter-specific data lives in
  namespaced `metadata`: `:27`; `model.invoke` represents semantic inference intent: `:32`.
- **ADR-0009** — every journal entry and portable artifact carries `schemaVersion` written at creation time;
  major breaks, minor is additive: `:24-26`.
- **ADR-0010** — journals are sensitive by default: `:27`; redaction is an explicit opt-in hook at the
  journal-writer boundary: `:30`; the core never redacts implicitly: `:32`; threat model deferred to 0.12.0:
  `:40`.

## 5. Open questions for the proposal and spec phases

Blocking design contradictions (must be resolved before implementation):

- **OQ2 — resolution states.** The `EffectResult` sketch carries only `ok | error`
  (`docs/ROADMAP.md:378-386`), while ADR-0005 fixes six states and explicitly rejected a two-state start
  (`docs/adr/0005-errors-and-retries.md:32-33,49`). The proposal must decide whether 0.0.1 ships six states
  from day one.
- **OQ3 — journal-first resolution.** The pipeline sketch is `append → execute → append → return`
  (`docs/ROADMAP.md:434-440`) with no journal check, while ADR-0007 requires resolution to check the journal
  first (`docs/adr/0007-exactly-once.md:28-30`). The sketch predates the ADR; the ADR wins, but the
  reconciliation must be explicit.
- **OQ4 — `JournalEntry` before its definition.** `EffectJournal.append(entry: JournalEntry)` is in scope
  (`docs/ROADMAP.md:409`) while the entry union and envelope appear only at 0.0.2 (`:942-956`). The proposal
  must define the minimal 0.0.1 entry model, including whether `sequence` and `schemaVersion` appear already
  (ADR-0003 `:28,31`, ADR-0009 `:24-25`).
- **OQ11 — undefined types on the critical path.** `Message` (`docs/ROADMAP.md:474`), `ToolDefinition`
  (`:476`), `JsonValue` (`:366,494`), `SerializableError` (`:385`) are referenced by in-scope inputs but
  defined nowhere. Define now or type the inputs as `JsonValue`.
- **OQ13 — uniqueness enforcement.** ADR-0002 requires per-run uniqueness validation
  (`docs/adr/0002-effect-identity.md:35`) but `EffectJournal` exposes only `append` and `findResult`
  (`docs/ROADMAP.md:408-416`). Decide where validation lives (journal internals or runtime).
- **OQ14 — persistence failure.** Exit criteria 6-7 (`docs/ROADMAP.md:928-929`) require defined behavior when
  the journal fails or the result cannot be persisted; the error code exists (ADR-0005 `:30-31`) and the
  `unknown` state exists (ADR-0007), but the result model has no such variant.

Open decisions (non-blocking but needed before apply):

- **OQ1 — singular vs plural artifact filenames** between `docs/ROADMAP.md:1620,1623` (`effect.md`,
  `adapter.md`) and `:2453,2456` (`effects.md`, `adapters.md`). Not a 0.0.1 blocker; normalize before 0.10.0.
- **OQ5 — exit criteria are questions, not acceptance criteria.** No artifact, format, or verification method
  is defined for the seven answers (`docs/ROADMAP.md:919-929`).
- **OQ6 — test runner wiring.** "20+ unit tests" (`docs/ROADMAP.md:906`) with no runner named; vitest and
  `pnpm -r test` are bound only once scaffolding lands (`openspec/config.yaml:60-65`).
- **OQ7 — CI undefined** beyond the word "CI" (`docs/ROADMAP.md:903`).
- **OQ8 — release tooling either/or unresolved** (`docs/ROADMAP.md:904`).
- **OQ9 — package manager undecided in the roadmap**; `openspec/config.yaml:61-62` implies pnpm.
- **OQ10 — "Node current LTS" is a moving target** (`docs/ROADMAP.md:902`); no minimum version is pinned.
- **OQ12 — location of the mandatory example** (`docs/ROADMAP.md:874-893`); the §25 `examples/` entries
  target the §23 demo, which requires replay and CLI, both out of scope for 0.0.1.

## 6. Non-goals

- No framework integration (`docs/ROADMAP.md:847`).
- Excluded in 0.0.1: CLI, LangGraph, OpenAI adapter, database, HTTP, UI, policy, capabilities
  (`docs/ROADMAP.md:908-917`).
- Deferred by milestone: JSONL journal 0.0.2 (`:933,979`), replay runtime 0.0.3 (`:1000`), testing toolkit
  0.0.4 (`:1061`), first adapter 0.0.5 (`:1116`).
- Project-level non-goals: not an agent framework, workflow engine, protocol, telemetry system, MCP, sandbox,
  tracing dashboard, or universal LLM abstraction; core excludes graphs, planners, prompt templates, RAG,
  vector databases, memory implementations, HTTP servers, UIs, schedulers (`docs/ROADMAP.md:219-247`).
- Policy engine at 0.2.0 (`:679`); capabilities not part of the initial MVP (`:715-717`); forking at 0.4.0
  (`:1425`); human effects at 0.3.0 (`:1390`).
- Even 1.0 promises neither exactly-once external effects nor deterministic LLM output
  (`docs/ROADMAP.md:1933-1950`).
- ADR-level deferrals: replay modes (`docs/adr/0004-replay-semantics.md:35`), sensitive-data threat model
  (`docs/adr/0010-sensitive-data.md:40`), logical clocks (`docs/adr/0006-concurrency.md`).

## 7. Risks and gaps

| Risk | Evidence |
| --- | --- |
| Greenfield tooling bootstrap: the entire harness (workspaces, strict TS, ESM, vitest, CI) must be created before any semantics is testable. | tree-wide search; `openspec/config.yaml:32-34,60-65` |
| Requirements only partially verifiable: "coherent abstraction" and the seven exit questions have no measurable thresholds. | `docs/ROADMAP.md:845,919-929` (OQ5) |
| ADR/roadmap tensions can produce ADR-violating code if not reconciled explicitly. | OQ2, OQ3, OQ4 |
| Undefined interfaces on the critical path. | OQ11 |
| Implicit validator scope: ADR-0003 delegates invariant enforcement to writers and validators, while "validator" is a 0.0.2 exit criterion (`docs/ROADMAP.md:990-996`). | `docs/adr/0003-journal-append-only.md:32-34` |
| Test-count criterion without wiring. | `docs/ROADMAP.md:906`; `openspec/config.yaml:64-65` (OQ6) |
| Undecided release and CI choices invite mid-implementation churn. | OQ7-OQ9 |
| Documentation deliverable is load-bearing but unoutlined: it must answer exit criteria and carry locked wording, the disclosure sentence, and the sensitive-data posture. | `docs/concepts/README.md:3-8`; ADR-0004 `:32-33`, ADR-0007 `:14`, ADR-0010 `:27` |
| Review-budget risk: the full milestone (two packages, tests, docs, CI) will exceed the 400-line budget with `ask-on-risk`. | `openspec/config.yaml:77-82` |

## 8. Recommended first slice

Anchor: R6 — the slice is coherent when `createRuntime({ executor, journal }).resolve(...)` runs the
documented `tool.invoke` example end-to-end under test.

In scope for the slice:

1. Scaffolding: root `package.json` and `pnpm-workspace.yaml`; `packages/core/package.json` +
   `tsconfig.json`; `packages/journal-memory/package.json` + `tsconfig.json`; TypeScript strict, ESM, Node
   LTS (`docs/ROADMAP.md:900-902`), pnpm (`openspec/config.yaml:61-62`, confirming OQ9).
2. `packages/core/src/`: the five in-scope types (`docs/ROADMAP.md:351-416`) plus the minimum supporting
   types the slice cannot avoid — `JsonValue`, `SerializableError` (ADR-0005 `:27`), a provisional
   `JournalEntry` (kinds from `docs/ROADMAP.md:131-136`) carrying `schemaVersion` (ADR-0009) and `sequence`
   (ADR-0003), and `ToolInvokeInput` (`:492-496`). `model.invoke` input requires an explicit decision
   (OQ11).
3. `packages/core/src/runtime.ts`: `createRuntime`/`resolve` with ID validation → `invalid-request`
   (ADR-0002 `:35`), journal-first resolution (ADR-0007 `:28-30`), then append request, execute, append
   result, return.
4. `packages/journal-memory/src/index.ts`: append-only in-memory journal with strictly monotonic per-run
   `sequence`, per-run effect-ID uniqueness, resolved-requires-requested invariant (ADR-0003 `:32-34`), and
   `findResult`.
5. Tests: the mandatory example as the anchor test plus invariant, identity, and failure-path tests, sized
   toward 20+ (`docs/ROADMAP.md:906`).
6. `docs/concepts/README.md` expanded to answer exit criteria 1-5 in ADR-0004-locked wording, with the
   ADR-0007 disclosure sentence and the ADR-0010 posture.

Sequencing under the 400-line budget: slice 1a = scaffolding + core types + `MemoryEffectJournal`;
slice 1b = `createRuntime`/`resolve` + mandatory-example test + concepts documentation. CI and the release
tooling decision may follow once the toolchain exists.

Out of scope by roadmap or ADR: JSONL journal, replay runtime, testing toolkit, adapters, policy,
capabilities, CLI, the §23 demo pairs, and the execution of the release tooling.

## 9. Handoff to the proposal phase

The proposal must decide, at minimum: the 0.0.1 resolution-state model (OQ2); the journal-first resolution
semantics and its divergence from the pipeline sketch (OQ3); the minimal `JournalEntry` model including
`sequence` and `schemaVersion` (OQ4); the definition or deferral of `Message`, `ToolDefinition`,
`JsonValue`, `SerializableError` (OQ11); where per-run uniqueness and invariants are enforced (OQ13); the
result model for persistence failure (OQ14); where the seven exit-criteria answers live (OQ5); the CI
platform, package manager, Node LTS pin, release tooling, and the location of the mandatory example
(OQ6-OQ10, OQ12).
