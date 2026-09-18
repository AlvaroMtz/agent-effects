# Design — minimal-effect-semantics (milestone 0.0.1)

> **Change:** `minimal-effect-semantics` · **Phase:** design · **Scope:**
> `@agent-effects/core` + `@agent-effects/journal-memory` · **Author:**
> SDD design executor · **Date:** 2026-09-18

This design turns the proposal's five abstractions, two effect kinds, and
one in-memory journal into concrete TypeScript contracts, module boundaries,
and a test-first plan.  Every decision is traceable to ADRs 0001–0010.

**Citation convention.** `ADR-00NN §N` names Decision item N of that ADR
(ADR sections are titled, not numbered); `specs/... → Requirement: X` and
`Scenario: Y` name an existing heading verbatim.

---

## 1. Architecture and module boundaries

Two packages, no internal cross-dependencies, no external dependencies.

| Package | Responsibility | Exports |
|---------|---------------|---------|
| `@agent-effects/core` | Effect type model, result model, executor contract, journal contract, runtime orchestration, journal error types | Five abstractions + supporting types + `JournalInvariantError` |
| `@agent-effects/journal-memory` | In-memory, process-local journal backend | `MemoryEffectJournal` class |

**Boundary rules.** The core package owns all interfaces, types, the
`createRuntime` / `resolve` pipeline, and the `JournalInvariantError`
signal class.  The journal-memory package implements only the
`EffectJournal` interface; it imports `JournalInvariantError` from core
and throws it on invariant violation.  **Dependency direction is
journal-memory → core only.**  Core never imports journal-memory or any
of its types.

No other package exists in this milestone.  `@agent-effects/journal-memory`
is the only backend shipped; JSONL, replay, testing, and adapter packages
are explicitly deferred.

---

## 2. Run-lifecycle entries decision

**Problem (proposal Open follow-up):** which component writes
`run.started` / `run.completed` in 0.0.1, and does a failed run get
`run.started`?  The `EffectRuntime` interface exposes only `resolve`;
it has no `startRun()` or `completeRun()` method and no `shutdown()`
method.

**Answer (0.0.1):** no component writes `run.started`, `run.completed`,
or `run.failed`.  In 0.0.1 the runtime appends exactly two entry kinds
at resolve time: `effect.requested` (before dispatch) and
`effect.resolved` (after execution).  A failed run gets no dedicated
lifecycle entry — the failure is visible through the per-effect journal
entries (an `effect.resolved` with `status: "error"` or an
`effect.requested` with no recorded resolution).  The `runId` on
every entry keeps run attribution possible for all four kinds in the
union.

`run.started`, `effect.requested`, `effect.resolved`, `run.completed`
remain the four-kind discriminated union because the entry model is
in scope (proposal Decision 4) and `EffectJournal.append` must accept
all four kinds.  `run.failed` arrives with the 0.0.2 union.  A
conformance test asserts that the union is closed and exhaustive.

**Rejected alternative.**  Writing `run.started` inside `createRuntime()`
and `run.completed` inside a `shutdown()` method — rejected because:
(1) `createRuntime` is synchronous and receives no `runId` while
`JournalEnvelope` requires `runId` and `journal.append` is async;
(2) `shutdown()` would add public surface not required by any
specification or acceptance criterion (AC2 / AC5).

---

## 3. Data flow

```
Caller
  │  Effect (id, runId, type, input, parentEffectId?, metadata?)
  ▼
EffectRuntime.resolve()
  │
  ├─ 1. Validate id present → return error/invalid-request if missing
  ├─ 2. journal.findResult(effectId)
  │     ├─ found → return recorded EffectResult (no executor call)
  │     └─ absent → proceed
  ├─ 3. journal.append(effect.requested entry)
  │     ├─ JournalInvariantError (duplicate-effect-id) → error/invalid-request
  │     └─ other Error → error/persistence-failed
  ├─ 4. executor.execute(effect)
  ├─ 5. journal.append(effect.resolved entry)
  │     └─ Error (any) → unknown  (executor already ran; outcome unverifiable)
  └─ 6. return EffectResult
```

This flow implements ADR-0007 (journal-first resolution), ADR-0004
(replay resolves from the journal, never re-executes), and proposal
Decision 1.  On step 5 the `unknown` mapping is uniform because the
executor has already completed — reporting `invalid-request` would
describe a request-identity problem that the effect did not have.

---

## 4. One-instances-per-run constraint

`MemoryEffectJournal` in 0.0.1 is constrained: one instance serves one
run.  This constraint follows from two facts: (1)
`EffectJournal.findResult(effectId)` takes no run parameter, and
(2) ADR-0002 makes effect IDs unique only per run.  Per-instance
uniqueness removes lookup ambiguity entirely.  The `EffectJournal`
interface is not changed and no constructor arguments are added — the
constraint is enforced by convention at construction time in the tests
and the user code.

**Risk.**  A single instance serving several runs with colliding effect
IDs is out of scope for 0.0.1; per-run uniqueness and per-run monotonic
`sequence` are enforced within the instance's run only.

---

## 5. Module detail — `@agent-effects/core`

### 5.1. Public surface

The public barrel `src/index.ts` exports exactly the types required by
AC2 — the five abstractions from the proposal's scope and capabilities,
the Decision 4 entry model, and the Decision 6 supporting types:

| Export | Kind | Defined in | Notes |
|--------|------|-----------|-------|
| `Effect` | interface | `effect.ts` | Serializable request envelope |
| `EffectKind` | type | `effect.ts` | `"tool.invoke" \| "model.invoke"` |
| `EffectResult` | type (union) | `effect-result.ts` | Six resolution states |
| `EffectExecutor` | interface | `executor.ts` | Execute an effect |
| `EffectJournal` | interface | `journal.ts` | Append entries, find results |
| `EffectRuntime` | interface | `runtime.ts` | `resolve(effect)` |
| `createRuntime` | function | `runtime.ts` | Factory producing an `EffectRuntime` |
| `JournalEntry` | type (union) | `journal.ts` | Four in-scope kinds |
| `JournalEntryKind` | type (union) | `journal.ts` | Four kinds literal |
| `SerializableError` | interface | `support.ts` | Portable error shape |
| `JsonValue` | type | `support.ts` | Structural JSON |
| `ToolInvokeInput` | interface | `effect.ts` | `tool.invoke` input |
| `ModelInvokeInput` | interface | `effect.ts` | `model.invoke` input |
| `Message` | interface | `support.ts` | Provider-agnostic message |
| `ToolDefinition` | interface | `support.ts` | Provider-agnostic tool definition |
| `EffectErrorCode` | type (union) | `effect-result.ts` | Six stable error codes |
| `EffectResolutionState` | type (union) | `effect-result.ts` | Six states |
| `JournalInvariantError` | class | `journal.ts` | Invariant-rejection signal; codes `duplicate-effect-id` and `missing-request` |

Justification for `EffectKind` in the public barrel:
`specs/effect-core/spec.md → Requirement: Effect Kinds in Scope`
specifies that exactly two kinds are dispatchable (restated in proposal
`## Scope` and AC3), and consumers who construct effects need a reliable
way to reference the two valid kinds (e.g., type guards, discriminated
unions on `effect.type`).

Justification for `JournalInvariantError`: the class is part of the
`EffectJournal` abstraction's rejection contract (AC2 — every type in
the public surface is either one of the five abstractions, an entry
model type, or a supporting type; this is a supporting type owned by
core that journal-memory imports and throws).  It is not a sixth
abstraction.  This boundary judgment must be confirmed by the tasks
and review phases.

No helper, internal, or exported type exists outside the public barrel.
AC2 enforces this constraint.

### 5.2. Internal layout

```
packages/core/src/
├── index.ts          ← public barrel (re-exports everything)
├── types/
│   ├── effect.ts         ← Effect, EffectKind, ToolInvokeInput, ModelInvokeInput
│   ├── effect-result.ts  ← EffectResult, EffectResolutionState, EffectErrorCode
│   ├── executor.ts       ← EffectExecutor
│   ├── journal.ts        ← EffectJournal, JournalEntry, JournalEntryKind, JournalInvariantError
│   └── support.ts        ← JsonValue, SerializableError, Message, ToolDefinition
├── runtime.ts    ← createRuntime, resolve pipeline
└── runtime.test.ts  ← mandatory example + 15 unit tests
```

Every type file exports exactly the types it defines.  No cross-file
imports between type modules; the barrel re-exports them all.  The
runtime module imports from the type modules but the type modules
never import the runtime.

### 5.3. TypeScript contracts

All type definitions live in `packages/core/src/types/`.  The barrel
(`src/index.ts`) re-exports the following:

```ts
// -- support.ts --
export type JsonValue = string | number | boolean | null
  | JsonValue[] | { [key: string]: JsonValue };
export interface SerializableError {
  code: string; message: string; details?: JsonValue; retryable?: boolean;
}
export interface Message { role: "user" | "assistant"; content: string; }
export interface ToolDefinition {
  name: string; description: string; inputSchema: JsonValue; required?: string[];
}

// -- effect.ts --
export type EffectKind = "tool.invoke" | "model.invoke";
export interface Effect<TInput = unknown> {
  id: string; runId: string; type: EffectKind; input: TInput;
  parentEffectId?: string; metadata?: Record<string, JsonValue>;
}
export interface ToolInvokeInput { tool: string; arguments: JsonValue; }
export interface ModelInvokeInput {
  provider?: string; model?: string; messages: Message[];
  tools?: ToolDefinition[]; config?: { temperature?: number; maxTokens?: number };
}

// -- effect-result.ts --
export type EffectResolutionState =
  | "ok" | "error" | "pending" | "cancelled" | "denied" | "unknown";
export type EffectErrorCode =
  | "invalid-request" | "execution-failed" | "persistence-failed"
  | "run-failed" | "cancelled" | "policy-denied";
export interface EffectResultOk { effectId: string; status: "ok"; output: unknown;
  metadata?: Record<string, JsonValue>; }
export interface EffectResultError { effectId: string; status: "error";
  error: SerializableError; retryable?: boolean; metadata?: Record<string, JsonValue>; }
export interface EffectResultPending { effectId: string; status: "pending"; }
export interface EffectResultCancelled { effectId: string; status: "cancelled"; }
export interface EffectResultDenied { effectId: string; status: "denied"; }
export interface EffectResultUnknown { effectId: string; status: "unknown"; }
export type EffectResult = EffectResultOk | EffectResultError
  | EffectResultPending | EffectResultCancelled
  | EffectResultDenied | EffectResultUnknown;

// -- executor.ts --
export interface EffectExecutor {
  execute(effect: Effect): Promise<EffectResult>;
}

// -- journal.ts --
class JournalEnvelope { sequence: number; schemaVersion: string;
  timestamp: string; runId: string; }
export class JournalInvariantError extends Error {
  readonly code: "duplicate-effect-id" | "missing-request";
}
export type JournalEntryKind =
  | "run.started" | "effect.requested"
  | "effect.resolved" | "run.completed";
interface RunStartedEntry extends JournalEnvelope {
  kind: "run.started"; runId: string; }
interface EffectRequestedEntry extends JournalEnvelope {
  kind: "effect.requested"; runId: string; effectId: string; }
interface EffectResolvedEntry extends JournalEnvelope {
  kind: "effect.resolved"; runId: string; effectId: string;
  result: EffectResultOk | EffectResultError; }
interface RunCompletedEntry extends JournalEnvelope {
  kind: "run.completed"; runId: string; }
export type JournalEntry = RunStartedEntry | EffectRequestedEntry
  | EffectResolvedEntry | RunCompletedEntry;
export interface EffectJournal {
  append(entry: JournalEntry): Promise<void>;
  findResult(effectId: string): Promise<EffectResult | undefined>;
}

// -- runtime.ts --
export interface EffectRuntime {
  resolve(effect: Effect): Promise<EffectResult>;
}
export function createRuntime(config: {
  executor: EffectExecutor; journal: EffectJournal;
}): EffectRuntime;
// EffectRuntime declares resolve only; no shutdown().
// `EffectResult` is a non-generic union, so neither `execute` nor `resolve`
// carries a type parameter (verified against tsc: `EffectResult<T>` is TS2347).
```

Key notes: `id` is producer-assigned and required (ADR-0002);
`metadata` is opaque to the core (ADR-0008); `EffectKind` constrains
dispatch to `tool.invoke` and `model.invoke` only
(`specs/effect-core/spec.md → Requirement: Effect Kinds in Scope`);
all six resolution states exist from day one but only `ok`, `error`,
`unknown` are produced by 0.0.1 (ADR-0005).

---

## 6. Module detail — `@agent-effects/journal-memory`

### 6.1. Public surface

```ts
// index.ts
export { MemoryEffectJournal } from "./memory.js";
// 2 lines total (1 export, 1 comment)
```

Single named export: `MemoryEffectJournal`.

### 6.2. Internal layout

```
packages/journal-memory/src/
├── index.ts          ← barrel, re-exports MemoryEffectJournal (2 lines)
└── memory.ts         ← MemoryEffectJournal class (append, findResult, invariants)
```

### 6.3. MemoryEffectJournal class

The journal stores entries in a per-run array: `Map<string, JournalEntry[]>`.

**append(entry):**

1. Validates runId is present (from `JournalEnvelope`).
2. Checks append-time invariants (ADR-0003 §4):
   - An `effect.resolved` entry requires a prior
     `effect.requested` for the same `effectId` within the run.
   - An `effectId` must be unique within the run.
3. If an invariant is violated, throws `JournalInvariantError` with the
   appropriate code (`missing-request` or `duplicate-effect-id`) —
   imported from `@agent-effects/core` — the entry is **not** appended.
4. If valid, assigns a strictly monotonic `sequence` value
   (per the current run counter), sets `schemaVersion` to `"1.0"`,
   records `timestamp` as ISO 8601, and appends the entry.

**findResult(effectId):** scans the per-run entry array for the first
`EffectResolvedEntry` matching `effectId` and returns its `result` field.
Returns `undefined` if no such entry exists.  Never fabricates a result
for an unresolved effect
(`specs/journal/spec.md → Requirement: Lookup Returns the Recorded Resolution or Its Absence`).

---

## 7. Journal append / lookup seams

### 7.1. Append flow (runtime → journal-memory)

The runtime calls `journal.append(entry)` at two points in the
resolve pipeline:

1. **Before execution** — to record the `effect.requested` fact.
   A failure returns `error/persistence-failed` to the caller and the
   effect is never dispatched
   (`specs/effect-core/spec.md → Requirement: Persistence and Execution Failures Have Defined Outcomes`).
2. **After execution** — to record the `effect.resolved` fact.
   A failure returns `unknown` to the caller; the executor already
   completed but the outcome cannot be verified
   (`ADR-0007 §3`).

The journal-memory implementation stores entries in a per-run array
and assigns a strictly monotonic `sequence` counter on each append
(`ADR-0003 §2`).

### 7.2. Lookup seam (runtime ← journal-memory)

`findResult(effectId)` scans the per-run entry array for the first
`EffectResolvedEntry` matching `effectId` and returns its `result` field.
Returns `undefined` if no such entry exists.  Does not fabricate results
for unresolved effects
(`specs/journal/spec.md → Requirement: Lookup Returns the Recorded Resolution or Its Absence`).

### 7.3. Invariant enforcement and failure mapping

The journal-memory writer enforces two invariants at append time
(`specs/journal/spec.md → Requirement: Append-Time Invariants Are Enforced by the Writer`):

| Invariant | Violation → Throws | ADR |
|-----------|-------------------|-----|
| `effect.resolved` requires prior `effect.requested` for same `effectId` | `JournalInvariantError(missing-request)` | ADR-0003 §4 |
| No duplicate `effectId` within a run | `JournalInvariantError(duplicate-effect-id)` | ADR-0002, ADR-0003 |

**Failure mapping at the runtime boundary** (complete, no unreachable branches):

- On `journal.append(requested)` in step 3:
  - `JournalInvariantError` (any code) → `error/invalid-request`
    (effect identity problem, per ADR-0002 and proposal Decision 5).
  - Other `Error` → `error/persistence-failed` (journal storage failure,
    per ADR-0007 §3).
- On `journal.append(resolved)` in step 5:
  - Any `Error` (including `JournalInvariantError`) → `unknown`
    (executor already ran, outcome unverifiable per ADR-0007 §3).

No other failure branches exist.  The `duplicate-effect-id` mapping to
`invalid-request` on step 5 was removed as unreachable on that code
path: after step 3 succeeds, the effect is known to be new, so
step 5 cannot re-encounter a duplicate.  If a case is genuinely
unreachable, it is omitted rather than mapped.

---

## 8. Adapter metadata handling

Adapter-specific data lives in the `metadata` field on `Effect` and
`EffectResult`.  The core never reads, interprets, or modifies metadata.

### 8.1. Write path

The producer (agent code or adapter) attaches namespaced metadata:

```ts
const effect: Effect = {
  id: "fx_1", runId: "run_1", type: "tool.invoke",
  input: { tool: "weather", arguments: { city: "Madrid" } },
  metadata: { "openai.requestId": "req_abc123", "latencyMs": 42 }
};
```

The runtime and journal pass metadata through unchanged.  No validation
is performed on keys or values.

### 8.2. Read path

Metadata round-trips through JSON serialization without transformation.
The core's tests never assert on metadata content; they only verify that
the core does not modify it
(`specs/effect-core/spec.md → Scenario: adapter data stays out of the portable contract`).

### 8.3. Conformance rule

If an adapter needs to carry provider-specific values, it must use
`metadata["namespace.key"]` only.  Conformance tests ignore metadata
fields (`ADR-0008 §3`).

---

## 9. Schema versioning

### 9.1. Version scheme

Every `JournalEntry` carries `schemaVersion` as a string in
`"MAJOR.MINOR"` form (`ADR-0009`):

| Change type | Bump |
|-------------|------|
| New optional field or new entry kind | Minor |
| Removal, rename, or meaning change | Major |

### 9.2. 0.0.1 version

All four entry kinds in 0.0.1 carry `"1.0"`.  The `schemaVersion` is
written at entry creation time inside the `MemoryEffectJournal.append()`
call, never modified afterward.

### 9.3. Reader compatibility rule

Readers accept unknown fields within the same major version.  A
different major version is treated as an incompatibility (deferred
to 0.0.2, but the design records the rule here).

---

## 10. Sensitive-data redaction posture

### 10.1. Default posture

Journals are **sensitive by default** (`ADR-0010`).  The core and the
journal-memory package never filter, redact, or mutate entries.  The
mandatory example's test includes a value that looks like a secret;
the assertion verifies the value is stored and returned verbatim
(`specs/journal/spec.md → Scenario: no implicit redaction at the write boundary`).

### 10.2. Redaction — deferred

Per `specs/journal/spec.md → Requirement: Entries Are Sensitive by Default`:
*"An explicit opt-in redaction hook at the journal-writer boundary SHALL
remain deferred beyond this milestone."*

In 0.0.1, the seam is documented but **not implemented**.  No
`beforeAppend` transformer parameter exists on the `MemoryEffectJournal`
constructor or on `EffectJournal.append()`.  The sensitive-by-default
posture and "no implicit redaction" behavior are enforced by non-mutation
— entries are stored and returned verbatim.  The hook's interface will be
defined in 0.12.0 alongside the threat model.

---

## 11. Error / retry modeling

Resolution states are produced by 0.0.1 as follows: `ok` (successful
executor result), `error` (executor throws or returns error), and
`unknown` (result cannot be persisted, `ADR-0007`).  `pending`,
`cancelled`, and `denied` are representable but not produced (deferred
to human effects, cancellation, and policy engine, respectively).  All
six types exist in the union from day one so consumers can handle them
without a later breaking change (`ADR-0005 §3`, proposal Decision 2).

### 11.1. Retry modeling

A retry is a **new Effect with a fresh `id`**, linked to its predecessor
by `metadata["retryOf"]` containing the original effect's id
(`ADR-0005 §4`).  The runtime does not manage retry chains; it only sees
individual effects.  The retry chain is visible in the journal as separate
`effect.requested` / `effect.resolved` pairs.

No `attempt` counter exists on the type model (rejected by `ADR-0005`).

---

## 12. File-level change plan

### 12.1. Root-level scaffolding

| File | Purpose | Est. lines |
|------|---------|------------|
| `package.json` | Workspace root, package manager config | 12 |
| `pnpm-workspace.yaml` | Workspace member list | 2 |
| `.nvmrc` | Node LTS pin | 1 |
| `tsconfig.json` | Root extends per-package tsconfig | 4 |

### 12.2. `@agent-effects/core`

| File | Purpose | Est. lines |
|------|---------|------------|
| `packages/core/package.json` | Package manifest (ESM, strict, vitest) | 15 |
| `packages/core/tsconfig.json` | Strict TS, ESM, lib: ES2022 | 8 |
| `packages/core/src/index.ts` | Public barrel re-export (18 names) | 18 |
| `packages/core/src/types/effect.ts` | Effect, EffectKind, ToolInvokeInput, ModelInvokeInput | 40 |
| `packages/core/src/types/effect-result.ts` | EffectResult union, states, error codes | 50 |
| `packages/core/src/types/executor.ts` | EffectExecutor interface | 6 |
| `packages/core/src/types/journal.ts` | EffectJournal, JournalEntry, JournalInvariantError | 60 |
| `packages/core/src/types/support.ts` | JsonValue, SerializableError, Message, ToolDefinition | 30 |
| `packages/core/src/runtime.ts` | createRuntime, resolve pipeline | 55 |
| `packages/core/src/runtime.test.ts` | Mandatory example + 15 unit tests | 120 |

### 12.3. `@agent-effects/journal-memory`

| File | Purpose | Est. lines |
|------|---------|------------|
| `packages/journal-memory/package.json` | Package manifest (ESM, strict, vitest) | 15 |
| `packages/journal-memory/tsconfig.json` | Strict TS, ESM | 8 |
| `packages/journal-memory/src/index.ts` | Barrel: single re-export (2 lines) | 2 |
| `packages/journal-memory/src/memory.ts` | MemoryEffectJournal class (append, findResult, invariants) | 75 |
| `packages/journal-memory/src/memory.test.ts` | Invariant tests, lookup tests, no-redaction test | 40 |

### 12.4. Documentation and configuration

| File | Purpose | Est. lines |
|------|---------|------------|
| `docs/concepts/README.md` | Expanded: exit-criteria answers, ADR-locked wording, disclosure | 80 |
| `.github/workflows/ci.yml` | CI: install, typecheck, test on push/PR | 25 |
| `changes/` directory | Changesets initialized (no version bump) | 0 |

**Total estimated changed lines:** the tables above sum to
approximately **666** lines (scaffolding 19, `core` 402,
`journal-memory` 140, docs/CI 105) across both packages, tests,
scaffolding, and docs.  This exceeds the 400-line review budget, so the
tasks phase must size delivery slices from these per-file estimates, not
from a rounded total (proposal §Delivery forecast, `ask-on-risk`).

---

## 13. Test strategy (strict TDD)

### 13.1. Harness

- **Runner:** Vitest (workspace root).  The command is `pnpm -r test`.
- **Evidence recording:** Per the SDD harness, every task records RED
  (failing test) and GREEN (passing test) evidence.

### 13.2. Test file layout

| Test file | Coverage | Est. tests |
|-----------|----------|------------|
| `packages/core/src/runtime.test.ts` | `createRuntime`, `resolve`, journal-first, error paths, metadata, type checks | 15 |
| `packages/journal-memory/src/memory.test.ts` | Invariants, monotonic sequence, schemaVersion, no-redaction, error types, lookup | 6 |

**Total: 21 unit tests** (above the 20+ minimum required by AC15).

### 13.3. Test matrix

| # | Scenario | Package | Test name pattern | Requirement / Scenario ref |
|---|----------|---------|-------------------|---------------------------|
| 1 | Mandatory example: weather tool Madrid → ok | core | `resolve weather tool for Madrid returns ok` | `specs/effect-core/spec.md → Requirement: The Documented Weather Example Resolves Successfully`, Scenario: mandatory example end to end |
| 2 | Journal-first: reuse recorded result | core | `resolve already-resolved effect without calling executor` | `specs/effect-core/spec.md → Requirement: Resolution Consults the Journal First`, Scenario: recorded result is reused without re-execution |
| 3 | Missing effect id → invalid-request | core | `resolve effect without id returns invalid-request` | `specs/effect-core/spec.md → Requirement: Identity Is Validated at the Boundary`, Scenario: missing id is rejected before dispatch |
| 4 | Journal request-append fails → persistence-failed | core | `journal append failure on request returns persistence-failed` | `specs/effect-core/spec.md → Requirement: Persistence and Execution Failures Have Defined Outcomes`, Scenario: request cannot be recorded |
| 5 | Journal result-append fails → unknown | core | `journal append failure on result returns unknown` | `specs/effect-core/spec.md → Requirement: Persistence and Execution Failures Have Defined Outcomes`, Scenario: completed but unpersistable result |
| 6 | Duplicate effect id → invalid-request at runtime | core | `duplicate id rejected as invalid-request` | `specs/effect-core/spec.md → Requirement: Identity Is Validated at the Boundary`, Scenario: duplicate id within a run is surfaced as invalid |
| 7 | effect.resolved without effect.requested rejected | journal | `append effect.resolved without prior request rejects` | `specs/journal/spec.md → Requirement: Append-Time Invariants Are Enforced by the Writer`, Scenario: resolution without prior request is rejected |
| 8 | Duplicate request rejected | journal | `append duplicate effect.requested rejects` | `specs/journal/spec.md → Requirement: Append-Time Invariants Are Enforced by the Writer`, Scenario: duplicate request is rejected |
| 9 | Sequence is monotonic | journal | `sequence increases with each append` | `specs/journal/spec.md → Requirement: Strictly Monotonic Per-Run Sequence`, Scenario: sequence increases with append order |
| 10 | schemaVersion present on every entry | journal | `every entry carries schemaVersion at creation` | `specs/journal/spec.md → Requirement: Every Entry Carries a Schema Version`, Scenario: schema version present at creation |
| 11 | Adapter metadata passes through unchanged | core | `resolve with adapter metadata preserves metadata` | `specs/effect-core/spec.md → Requirement: Effect Is a Serializable Request`, Scenario: adapter data stays out of the portable contract |
| 12 | No implicit redaction | journal | `entries with secret-like values stored verbatim` | `specs/journal/spec.md → Requirement: Entries Are Sensitive by Default`, Scenario: no implicit redaction at the write boundary |
| 13 | ToolInvokeInput has required fields | core | `tool.invoke input has tool and arguments` | `specs/effect-core/spec.md → Requirement: Effect Kinds in Scope` (the `tool.invoke` sentence) |
| 14 | ModelInvokeInput has required fields | core | `model.invoke input has messages and model` | `specs/effect-core/spec.md → Requirement: Effect Kinds in Scope`, Scenario: model invocation stays semantic |
| 15 | SerializableError has required fields | core | `error result carries code and message` | `specs/effect-core/spec.md → Requirement: Effect Results Have Six Resolution States`, Scenario: errored resolution carries the serializable error |
| 16 | EffectResult ok carries output | core | `ok result carries output value` | `specs/effect-core/spec.md → Requirement: Effect Results Have Six Resolution States`, Scenario: successful resolution carries its output |
| 17 | EffectResult error carries SerializableError | core | `error result carries serializable error` | `specs/effect-core/spec.md → Requirement: Effect Results Have Six Resolution States`, Scenario: errored resolution carries the serializable error |
| 18 | Effect resolved entry carries full result | journal | `findResult returns full result from journal` | `specs/journal/spec.md → Requirement: Lookup Returns the Recorded Resolution or Its Absence`, Scenario: recorded resolution is found unchanged |
| 19 | Journal entry kinds are exhaustive | core | `JournalEntry union covers all four kinds` | `specs/journal/spec.md → Requirement: Entry Kinds in Scope`, Scenario: four kinds cover the run lifecycle |
| 20 | Effect is JSON-serializable | core | `effect round-trips through JSON stringify/parse` | `specs/effect-core/spec.md → Requirement: Effect Is a Serializable Request`, Scenario: producer-assigned id on a serializable request |
| 21 | EffectKind is a valid kind | core | `EffectKind type allows only tool.invoke and model.invoke` | `specs/effect-core/spec.md → Requirement: Effect Kinds in Scope` (exactly two kinds; no other is dispatchable) |

---

## 14. Explicit tradeoffs

| Tradeoff | Chosen | Rationale |
|----------|--------|-----------|
| Six resolution states | Ship all six from day 1 | ADR-0005 rejects two-state; `unknown` cannot be retrofitted honestly. |
| Runtime orchestrates journal + executor | `createRuntime({ executor, journal })` | Core must be small (roadmap §2.6). |
| Invariants enforced where? | Journal-writer (journal-memory) | ADR-0003 places invariants at the journal; it is the source of truth. |
| Invariant-rejection signal ownership | Core declares `JournalInvariantError` | Removes core→journal-memory cross-dependency; journal-memory imports from core only. |
| Failure-mapping mechanism | `JournalInvariantError.code` | Explicit, type-safe, owned by core; minimal boundary crossing. |
| Redaction in 0.0.1 | Deferred beyond milestone (no hook) | Journal spec requires deferred; non-mutation enforces sensitive-by-default. |
| Run-lifecycle entries (0.0.1) | No component writes them; runtime writes `effect.requested` / `effect.resolved` only | `createRuntime` is sync with no `runId`; `shutdown()` is not in any spec. |
| Export `EffectKind` from barrel | Include in public surface | Consumers need valid kinds; the in-scope-kinds requirement constrains dispatch to two values. |
| JsonValue shape | Structural union | Sufficient for JSON serialization; deep recursion harms type-checking. |
| Metadata type | Plain `Record<string, JsonValue>` | ADR-0008: core never interprets metadata. |
| JSON schemas in 0.0.1 | Deferred to 0.10.0 | Roadmap schedules spec split and schema publication at 0.10.0. |
| Mandatory example location | Test in `runtime.test.ts` | `examples/` targets the §23 demo with replay+CLI, both out of scope. |
| Release tooling | Changesets over semantic-release | Pre-1.0, human-reviewable bumps; explicitly reversible (Decision 9). |
| `EffectResult` in journal entry | Store complete result | `findResult` needs full result without re-execution. |
| `findResult` is async | `Promise<...>` matching `append` | Consistent interface; allows future backends. |
| One journal instance per run | Convention enforced at construction | Removes lookup ambiguity without changing the `EffectJournal` interface. |
| JournalInvariantError in 0.0.1 | Two codes (`duplicate-effect-id`, `missing-request`) | Matches the two append-time invariants; strings are the minimal signal for invariant violations from a separate package. |
| Resolved-append failure → unknown | Uniform mapping (any Error → unknown) | Executor already ran; reporting `invalid-request` would describe a request-identity problem the effect did not have. |

---

## 15. Non-goals reaffirmed

The following are explicitly excluded from this milestone, per the
proposal's Non-goals section:

- Framework integration (LangGraph, OpenAI SDK, etc.).
- CLI, HTTP server, database, or UI code.
- Policy engine, capabilities, or forking.
- JSONL journal backend (deferred to 0.0.2).
- Replay runtime (deferred to 0.0.3).
- Testing toolkit / mock runtime (deferred to 0.0.4).
- Adapter implementations (deferred to 0.0.5).
- Threat model and sensitive-field guidance (deferred to 0.12.0).

---

## 16. Risk register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Full milestone exceeds 400-line review budget | Delivery decision requires user consent (`ask-on-risk`) | Proposal splits into slices 1a/1b; tasks phase will size CI and changesets explicitly. |
| Superseded roadmap sketches mislead implementers | Code could follow the old `append → execute → append` pipeline instead of journal-first | Tests must explicitly assert no-re-execution on second `resolve` (AC6); concepts documentation must be rewritten. |
| Two-state sketch conflicts with ADR-0005 six-state requirement | Implementers following the roadmap sketch would miss `pending`, `denied`, `unknown` | Design explicitly ships six states; spec scenarios cover all states. |
| Greenfield tooling bootstrap | No manifests, no TS config, no CI exist today | Scaffolding is slice 1a's first deliverable; nothing is testable until it lands. |
| Validator gap until 0.0.2 | Invariant enforcement lives only in the writer, not in a formal validator | Acceptable for 0.0.1; the writer's checks cover the two invariants required by ADR-0003. |
| Documentation deliverable is load-bearing | Must answer seven exit-criteria questions and carry ADR-locked wording, disclosure sentence, and redaction posture from a stub | Concepts doc is slice 1b; it rewrites the stub with normative statements. |
| One-instance-per-run ambiguity with colliding IDs | If a single journal instance serves multiple runs, effects with colliding IDs cause lookup collisions | Out of scope for 0.0.1; per-run uniqueness enforced by convention within the instance. |
| JournalInvariantError boundary judgment | Placing the invariant error class in core may need review confirmation | Tasks/review phase must confirm this AC2 boundary judgment. |

---

## 17. Next steps

This design resolves all questions needed for the tasks phase to split
work into reviewable slices.  The next SDD phase is **tasks**, which
converts this design into ordered, scoped work units sized for the
400-line review budget under `ask-on-risk`.

---

## Key Learnings

The run-lifecycle entries (run.started, run.completed) cannot be written by createRuntime because it is synchronous and receives no runId while the journal envelope requires runId and append is async.

Core-owned JournalInvariantError with discriminated codes replaces runtime instanceof checks against journal-memory's error classes, eliminating the core→journal-memory dependency inversion entirely.

When the executor has already run, any append failure to the journal must map to unknown rather than invalid-request because the outcome is unverifiable and invalid-request describes a request-identity problem the effect did not have.

The proposal's scope and capabilities sections are the correct authority for abstraction-level citations, not the proposal Decisions, which describe implementation choices rather than the abstractions themselves.

Keeping one journal instance per run by convention removes lookup ambiguity without changing the EffectJournal interface because ADR-0002 guarantees effect IDs are unique within a run.