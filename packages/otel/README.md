# @agent-effects/otel

Planned in **0.6.0**. OpenTelemetry exporter projecting the journal onto
existing GenAI semantic conventions (`model.invoke` → inference span,
`tool.invoke` → `execute_tool`, `agent.invoke` → `invoke_agent`).
Principle: OTel is a projection; the journal is the execution truth.

Status: stub. No code yet — see `docs/ROADMAP.md` §0.6.0 and §4 (OpenTelemetry GenAI).
