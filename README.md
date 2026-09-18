# Agent Effects

Agent Effects makes agent side effects explicit.

Record a real run once.
Replay it offline.
Mock tools and models in tests.
Inspect exactly what the agent attempted to do.

Works below your agent framework instead of replacing it.

An agent run is mostly a sequence of intentional requests to the outside world:
invoke a model, call a tool, ask a human, write state, wait for a timer.
Agent Effects turns those requests into first-class, JSON-serializable **effects**,
routes them through a runtime that validates, applies policy, executes, and journals,
and derives replay, mocking, audit, diffing, and observability from that single record.

## Status

Pre-`0.0.1`. This repository currently contains planning artifacts only:
the roadmap, foundational architecture decision records, and skeletons for the
planned package and document layout. No runnable code exists yet.
The authoritative plan is [`docs/ROADMAP.md`](docs/ROADMAP.md).

## Documentation

- [Roadmap 0.0.1 → 1.0.0](docs/ROADMAP.md) — verbatim project roadmap, single source of truth.
- [Architecture Decision Records](docs/adr/README.md) — the ten foundational ADRs.
- [Concepts](docs/concepts/README.md) — planned conceptual documentation (effects, journal, replay).
- [Specification](spec/README.md) — planned framework-neutral spec split (0.10.0).
- [Schemas](schemas/README.md) — planned versioned JSON Schemas (0.0.2 → 0.10.0).

## Repository layout

Planned structure per roadmap §25; items marked *(stub)* hold only a README today.

```text
agent-effects/
├── packages/
│   ├── core/               Effect, EffectResult, Executor, Journal, Runtime (0.0.1) *stub*
│   ├── journal-memory/     In-memory journal (0.0.1) *stub*
│   ├── journal-jsonl/      Append-only JSONL journal (0.0.2) *stub*
│   ├── replay/             Effect-level deterministic replay (0.0.3) *stub*
│   ├── testing/            Test runtime, mocks, assertions (0.0.4) *stub*
│   ├── adapter-openai/     First framework adapter (0.0.5) *stub*
│   ├── adapter-langgraph/  Second adapter + neutrality check (0.0.6) *stub*
│   ├── otel/               OpenTelemetry exporter (0.6.0) *stub*
│   └── cli/                `agentfx` record/replay/fork/diff (0.17.0) *stub*
├── spec/                   Framework-neutral specification (0.10.0) *stub*
├── schemas/                Versioned JSON Schemas (0.0.2 → 0.10.0) *stub*
├── fixtures/               Cross-language conformance fixtures (0.0.6 → 0.11.0) *stub*
├── examples/               Weather-agent record/replay/fork demos *stub*
├── docs/
│   ├── concepts/           Conceptual documentation *stub*
│   ├── adr/                Architecture decision records (populated)
│   └── ROADMAP.md          Verbatim roadmap (populated)
└── conformance/            Adapter conformance suite (0.0.6) *stub*
```

Later candidates (roadmap §13), not part of the initial layout:
`adapter-mastra`, `adapter-vercel-ai`, `adapter-pydantic-ai`,
`journal-sqlite`, `journal-postgres`, `policy`, `capabilities`.

## Non-goals

From roadmap §3, the project is not: another agent framework, workflow engine,
agent-to-agent or agent-to-UI protocol, telemetry system, MCP, sandbox,
tracing dashboard, or universal LLM abstraction. The core deliberately excludes
graphs, agent planners, prompt templates, RAG, vector databases, memory
implementations, HTTP servers, web UIs, deployment platforms, and distributed schedulers.

From roadmap §15, even `1.0.0` does not promise: portable process snapshots,
exactly-once external effects, deterministic LLM output, arbitrary cross-framework
migration, sandbox isolation, tool authorization outside controlled channels,
or distributed scheduling. What it does promise: portable effect semantics,
a portable journal representation, effect-level replay, adapter conformance,
and a testable execution boundary.
