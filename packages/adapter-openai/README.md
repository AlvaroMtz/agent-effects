# @agent-effects/adapter-openai

Planned in **0.0.5**. First real adapter, proving the abstraction supports
foreign code: maps model calls to `model.invoke` and tool calls to
`tool.invoke`. Adapter-specific data stays in namespaced `metadata`; see
ADR-0008 (portable contract vs adapter metadata).

Status: stub. No code yet — see `docs/ROADMAP.md` §0.0.5 for scope and exit criteria.
