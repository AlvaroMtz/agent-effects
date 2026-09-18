# Agent Effects — Roadmap 0.0.1 → 1.0.0

> **Nombre provisional:** `agent-effects`  
> **Tesis:** una representación portable de los efectos externos producidos durante una ejecución agentic, con journal, replay determinista, testing y policy enforcement como capacidades derivadas.  
> **Estado:** propuesta inicial de arquitectura y roadmap OSS.

---

## 1. Visión

Los frameworks de agentes actuales resuelven principalmente cómo definir y orquestar agentes: grafos, workflows, tools, handoffs, memory, streaming, human-in-the-loop, etc.

El problema que este proyecto quiere abordar está un nivel por debajo:

> **¿Cómo representar de forma explícita, portable y reproducible todo aquello que un agente intenta hacer fuera de su cómputo puro?**

Ejemplos:

- invocar un modelo;
- ejecutar una herramienta;
- solicitar input humano;
- leer o escribir estado;
- crear un artefacto;
- lanzar otro agente;
- esperar un timer;
- acceder a memoria;
- realizar una operación externa.

La propuesta es convertir estas operaciones en **effects** explícitos.

```text
Agent
  │
  │ solicita Effect
  ▼
Effect Runtime
  │
  ├── valida
  ├── aplica policy
  ├── ejecuta
  ├── registra
  └── devuelve EffectResult
```

De este modelo se derivan de manera natural:

- deterministic replay;
- mocks y testing offline;
- audit log;
- policy enforcement;
- human approval;
- forks de ejecución;
- comparación de runs;
- snapshots semánticos;
- observabilidad;
- adaptadores entre frameworks.

El proyecto **no pretende definir cómo se construye un agente**.

Pretende definir la frontera entre:

```text
cálculo agentic
        │
        ▼
mundo exterior / side effects
```

---

# 2. Principios de diseño

## 2.1. Runtime-agnostic

El core no debe depender de:

- LangGraph;
- OpenAI Agents SDK;
- Mastra;
- Vercel AI SDK;
- Pydantic AI;
- Temporal;
- un proveedor de modelos;
- una base de datos;
- OpenTelemetry;
- MCP;
- A2A.

Todos ellos deben poder ser integraciones.

---

## 2.2. Effects, no events

Un `event` describe algo que ha ocurrido.

Un `effect` representa algo que la ejecución **solicita que ocurra**.

```text
event:
    tool.executed

effect:
    tool.invoke(...)
```

Esta distinción es fundamental.

El runtime puede:

```text
effect
  │
  ├── ejecutar
  ├── rechazar
  ├── pedir aprobación
  ├── simular
  ├── recuperar resultado previo
  └── delegar
```

---

## 2.3. Journal append-only

La fuente de verdad debe poder expresarse como una secuencia append-only.

Ejemplo:

```jsonl
{"kind":"run.started","runId":"run_1"}
{"kind":"effect.requested","effectId":"fx_1","effectType":"model.invoke"}
{"kind":"effect.resolved","effectId":"fx_1","result":{"status":"ok"}}
{"kind":"effect.requested","effectId":"fx_2","effectType":"tool.invoke"}
{"kind":"effect.resolved","effectId":"fx_2","result":{"status":"ok"}}
{"kind":"run.completed","runId":"run_1"}
```

Esto facilita:

- almacenamiento;
- debugging;
- streaming;
- replay;
- migraciones;
- inspección manual;
- interoperabilidad.

---

## 2.4. Determinismo acotado

El proyecto **no debe prometer que un agente completo es determinista**.

Debe prometer algo más limitado:

> Dados los mismos effects resueltos con los mismos resultados registrados, el runtime de replay no volverá a ejecutar dichos side effects.

El determinismo pertenece a la frontera de effects.

No a:

- scheduling interno arbitrario;
- comportamiento del modelo;
- closures del framework;
- estado no capturado;
- concurrencia externa;
- clock del proceso.

---

## 2.5. JSON-first

Todo aquello que forme parte de la representación portable debe ser serializable.

Preferencia:

```text
JSON-compatible
```

No:

```text
Function
Class instance
Socket
Promise
Closure
Database connection
```

Los runtimes podrán añadir metadata opaca, pero no debe formar parte del contrato portable.

---

## 2.6. Core pequeño

Objetivo:

```text
@agent-effects/core
```

debe poder entenderse en una tarde.

Idealmente:

- sin dependencias runtime;
- TypeScript-first;
- APIs pequeñas;
- interfaces estables;
- sin decorators;
- sin DI container;
- sin framework interno.

---

# 3. Qué NO es el proyecto

No es:

- otro framework de agentes;
- otro LangGraph;
- otro workflow engine;
- otro protocolo agent-to-agent;
- otro protocolo agent-to-UI;
- otro sistema de telemetry;
- otro MCP;
- otro sandbox;
- otro tracing dashboard;
- otra abstracción universal de LLMs.

No debe incluir en el core:

```text
Graph
Agent planner
Prompt templates
RAG
Vector database
Memory implementation
HTTP server
Web UI
Deployment platform
Scheduler distribuido
```

---

# 4. Relación con estándares y proyectos existentes

## Agent Protocol

Agent Protocol cubre conceptos como:

- threads;
- runs;
- checkpoints;
- streaming;
- human-in-the-loop;
- replay de streams;
- state snapshots;
- tool lifecycle.

`agent-effects` no debe competir con esta capa.

La integración deseada sería:

```text
Agent Protocol
       │
       ▼
 adapter
       │
       ▼
Agent Effects
```

---

## OpenTelemetry GenAI

OpenTelemetry ya define semántica para operaciones como:

- `invoke_agent`;
- `invoke_workflow`;
- `execute_tool`;
- inference;
- retrieval;
- memory.

`agent-effects` no debería inventar otro sistema de observabilidad.

Debe permitir:

```text
Effect Journal
      │
      ▼
OTel exporter
      │
      ▼
spans / metrics / events
```

---

## Temporal / DBOS / Restate

Estos proyectos resuelven durable execution.

`agent-effects` no debe intentar reemplazarlos.

Deben poder funcionar como executors o persistence backends:

```text
Agent Effects
     │
     ▼
Temporal Executor
```

---

## Pydantic AI StepPersistence

Pydantic AI ya demuestra una dirección muy relevante:

- settled snapshots;
- event log;
- tool-effect ledger;
- continuation y forking.

Es una referencia conceptual importante.

La diferencia propuesta aquí es hacer que la abstracción de effect sea:

```text
framework-neutral
+
portable
+
conformance-testable
```

---

# 5. Modelo conceptual

## 5.1. Effect

```ts
export interface Effect<
  TType extends string = string,
  TInput = unknown
> {
  id: string;
  type: TType;
  input: TInput;

  runId: string;

  parentEffectId?: string;

  metadata?: Record<string, JsonValue>;
}
```

---

## 5.2. EffectResult

```ts
export type EffectResult<T = unknown> =
  | {
      effectId: string;
      status: "ok";
      output: T;
      metadata?: Record<string, JsonValue>;
    }
  | {
      effectId: string;
      status: "error";
      error: SerializableError;
      retryable?: boolean;
      metadata?: Record<string, JsonValue>;
    };
```

---

## 5.3. Executor

```ts
export interface EffectExecutor {
  execute<T = unknown>(
    effect: Effect
  ): Promise<EffectResult<T>>;
}
```

---

## 5.4. Journal

```ts
export interface EffectJournal {
  append(entry: JournalEntry): Promise<void>;

  findResult(
    effectId: string
  ): Promise<EffectResult | undefined>;
}
```

---

## 5.5. Runtime

```ts
export interface EffectRuntime {
  resolve<T = unknown>(
    effect: Effect
  ): Promise<EffectResult<T>>;
}
```

Una implementación básica:

```text
resolve(effect)
    │
    ├─ journal.append(request)
    │
    ├─ executor.execute(effect)
    │
    ├─ journal.append(result)
    │
    └─ return result
```

---

# 6. Taxonomía inicial de effects

La taxonomía debe empezar muy pequeña.

## Core effects 1.0 candidate

```text
model.invoke
tool.invoke
human.request
agent.invoke
state.read
state.write
artifact.read
artifact.write
timer.wait
```

No todos deben existir en `0.0.1`.

---

## `model.invoke`

```ts
interface ModelInvokeInput {
  provider?: string;
  model?: string;

  messages: Message[];

  tools?: ToolDefinition[];

  config?: {
    temperature?: number;
    maxTokens?: number;
  };
}
```

Debe representar intención semántica, no un request HTTP específico de OpenAI o Anthropic.

---

## `tool.invoke`

```ts
interface ToolInvokeInput {
  tool: string;
  arguments: JsonValue;
}
```

Opcional posteriormente:

```ts
capability?: string;
```

---

## `human.request`

```ts
interface HumanRequestInput {
  kind:
    | "approval"
    | "input"
    | "selection";

  prompt: string;

  options?: JsonValue[];
}
```

---

## `agent.invoke`

Permite representar nesting:

```ts
interface AgentInvokeInput {
  agent: string;
  input: JsonValue;
}
```

---

# 7. Identidad de effects

Uno de los problemas más importantes será decidir cuándo dos effects representan "la misma operación".

No utilizar únicamente hash de input.

Debe distinguirse:

```text
effect identity
```

de:

```text
effect equivalence
```

Ejemplo:

```text
fx_1 tool.invoke("weather", Madrid)
fx_2 tool.invoke("weather", Madrid)
```

Tienen inputs equivalentes.

Pero pueden representar dos decisiones distintas del agente.

Por tanto:

```text
ID != content hash
```

El ID identifica la ocurrencia lógica.

---

# 8. Replay

## Replay exacto de effects

```ts
const runtime = createReplayRuntime({
  journal
});
```

Cuando recibe:

```text
effect id = fx_42
```

busca:

```text
effect.requested fx_42
effect.resolved  fx_42
```

y devuelve el resultado registrado.

No ejecuta el side effect.

---

## Modos futuros

```ts
replay({
  mode: "strict"
});
```

Falla si aparece un effect desconocido.

```ts
replay({
  mode: "passthrough"
});
```

Effects conocidos se reproducen.

Effects nuevos se ejecutan.

```ts
replay({
  mode: "mock"
});
```

Effects desconocidos se resuelven mediante mocks.

---

# 9. Forking

Posteriormente:

```ts
fork(runId, {
  fromEffect: "fx_17",
  overrides: {
    fx_17: alternateResult
  }
});
```

El nuevo run comparte historia hasta:

```text
fx_16
```

y diverge desde:

```text
fx_17
```

Modelo:

```text
run A
├── fx1
├── fx2
├── fx3
└── fx4

          fork

run B
├── fx1  reused
├── fx2  reused
├── fx3' overridden
└── fx4' recomputed
```

---

# 10. Policy

Policy debe ser una capa sobre effects.

```ts
interface EffectPolicy {
  evaluate(
    effect: Effect,
    context: PolicyContext
  ): Promise<PolicyDecision>;
}
```

Resultados:

```ts
type PolicyDecision =
  | { type: "allow" }
  | { type: "deny"; reason: string }
  | { type: "require-approval"; reason?: string };
```

Pipeline:

```text
Effect
  ↓
Policy
  ↓
allow ──────────────→ Execute
deny ───────────────→ Error
require-approval ───→ HumanEffect
```

---

# 11. Capabilities

No deben formar parte del MVP inicial.

Cuando entren:

```ts
interface CapabilityRequirement {
  name: string;

  resource?: string;

  action?: string;
}
```

Ejemplo:

```json
{
  "name": "github.issue",
  "resource": "org/repo",
  "action": "create"
}
```

Un effect podrá declarar:

```ts
requires?: CapabilityRequirement[];
```

El runtime deberá decidir si están concedidas.

Importante:

> Una capability declarativa sin enforcement real no debe venderse como seguridad.

---

# 12. Snapshot semántico

No intentar serializar la máquina interna de cada framework.

Definir posteriormente:

```ts
interface SemanticCheckpoint {
  version: string;

  runId: string;

  conversation?: Message[];

  state?: JsonValue;

  journalCursor: string;

  pendingEffects?: Effect[];

  artifacts?: ArtifactRef[];

  capabilities?: CapabilityGrant[];

  runtime?: {
    name: string;
    opaqueState?: JsonValue;
  };
}
```

Niveles de compatibilidad:

```text
exact
semantic
unsupported
```

Un adapter debe poder declarar:

```ts
checkpointCompatibility(): "exact" | "semantic" | "none";
```

---

# 13. Paquetes previstos

```text
packages/

  core/
  journal-memory/
  journal-jsonl/
  replay/
  testing/

  adapter-openai/
  adapter-langgraph/

  otel/

  cli/
```

Posteriormente:

```text
adapter-mastra/
adapter-vercel-ai/
adapter-pydantic-ai/

journal-sqlite/
journal-postgres/

policy/
capabilities/
```

---

# 14. Roadmap

---

# 0.0.1 — Semántica mínima

## Objetivo

Probar que `Effect → Executor → Result → Journal` es una abstracción coherente.

No intentar integración con frameworks todavía.

## Scope

Implementar únicamente:

```text
Effect
EffectResult
EffectExecutor
EffectJournal
EffectRuntime
```

Effects iniciales:

```text
tool.invoke
model.invoke
```

Journal:

```text
in-memory
```

## Ejemplo obligatorio

```ts
const runtime = createRuntime({
  executor,
  journal
});

const result = await runtime.resolve({
  id: "fx_1",
  runId: "run_1",
  type: "tool.invoke",
  input: {
    tool: "weather",
    arguments: {
      city: "Madrid"
    }
  }
});
```

## Deliverables

- monorepo;
- `@agent-effects/core`;
- `@agent-effects/journal-memory`;
- TypeScript strict;
- ESM;
- Node current LTS;
- CI;
- semantic-release o changesets;
- documentación conceptual;
- 20+ tests unitarios.

## No incluir

- CLI;
- LangGraph;
- OpenAI adapter;
- database;
- HTTP;
- UI;
- policy;
- capabilities.

## Exit criteria

No publicar `0.0.2` hasta poder responder claramente:

1. ¿Qué es un Effect?
2. ¿Qué NO es un Effect?
3. ¿Quién genera el ID?
4. ¿Cuándo se escribe en journal?
5. ¿Cómo se representan errores?
6. ¿Qué sucede si journal falla?
7. ¿Qué sucede si executor completa pero no se puede persistir el resultado?

---

# 0.0.2 — Journal formal

## Objetivo

Convertir el journal en una primitiva estable.

## Introducir

```ts
type JournalEntry =
  | RunStarted
  | EffectRequested
  | EffectResolved
  | RunCompleted
  | RunFailed;
```

Cada entrada:

```ts
interface JournalEnvelope {
  sequence: number;
  timestamp: string;
  runId: string;
}
```

## Definir invariantes

Ejemplos:

```text
EffectResolved requiere EffectRequested previo.

Un effectId es único dentro de un run.

sequence es monotónico.

Journal es append-only.
```

## JSONL format

Introducir:

```text
@agent-effects/journal-jsonl
```

Objetivo:

```bash
cat run.jsonl
```

debe ser útil para un humano.

## Exit criteria

- schema versionado;
- parser;
- validator;
- round-trip test;
- fixtures de compatibilidad.

---

# 0.0.3 — Replay mínimo

## Objetivo

Demostrar la primera capacidad diferencial.

```ts
const replay = createReplayRuntime({
  journal
});
```

## Implementar

Modo:

```text
strict
```

Algoritmo:

```text
Effect solicitado
      │
      ▼
buscar EffectRequested equivalente
      │
      ▼
buscar EffectResolved asociado
      │
      ▼
devolver resultado
```

No llamar al executor real.

## Primer gran demo

```text
Run real:
OpenAI + Weather API
        ↓
run.jsonl

Run replay:
0 llamadas OpenAI
0 llamadas Weather API
        ↓
mismo effect result stream
```

## Exit criteria

- replay 100% offline;
- ninguna llamada externa;
- tests verifican zero IO;
- detección de mismatch.

---

# 0.0.4 — Testing toolkit

## Objetivo

Hacer el proyecto útil aunque nadie adopte todavía adapters.

Crear:

```text
@agent-effects/testing
```

API candidata:

```ts
const runtime = createTestRuntime();

runtime.when({
  type: "tool.invoke",
  match: {
    tool: "weather"
  }
}).respond({
  temperature: 20
});
```

Assertions:

```ts
expect(runtime)
  .toHaveRequestedEffect("tool.invoke");

expect(runtime)
  .toHaveRequestedTool("weather");
```

## No inventar un Jest propio

Integrarse con:

- Vitest;
- Jest;
- Node test.

## Exit criteria

Puede testearse un agente custom sin:

- internet;
- API keys;
- base de datos.

---

# 0.0.5 — Primer adapter real

## Objetivo

Validar que la abstracción soporta código ajeno.

Elegir **un solo framework**.

Candidato prioritario:

```text
OpenAI Agents SDK JS
```

o:

```text
LangGraph JS
```

No ambos todavía.

## El adapter debe mapear

```text
model call → model.invoke
tool call  → tool.invoke
```

No intentar cubrir:

- handoffs;
- HITL;
- subagents;
- checkpoint migration.

## Exit criteria

Demo:

```text
framework agent
     ↓
adapter
     ↓
agent-effects runtime
     ↓
journal
     ↓
offline replay
```

---

# 0.0.6 — Segundo adapter + conformance

## Objetivo

Descubrir si el IR realmente es neutral.

Añadir un segundo framework diferente.

Si `0.0.5` usa OpenAI:

```text
0.0.6 → LangGraph
```

Si `0.0.5` usa LangGraph:

```text
0.0.6 → OpenAI
```

## Crear conformance suite

```ts
defineAdapterConformance(adapter);
```

Debe verificar al menos:

```text
✓ model invocation
✓ tool invocation
✓ errors
✓ multiple tool calls
✓ cancellation semantics documentadas
```

## Regla clave

Si ambos frameworks requieren metadata privada distinta:

```text
portable fields
+
adapter metadata
```

No contaminar el core con detalles del framework.

---

# 0.0.7 — Error semantics + retries

## Objetivo

Resolver una de las partes más difíciles antes de crecer.

Distinguir:

```text
effect request failed
effect execution failed
effect result persistence failed
run failed
effect cancelled
```

Introducir:

```ts
SerializableError
```

y opcionalmente:

```ts
attempt: number
```

Un retry no debe ocultar su historia.

```text
fx_12 attempt 1 → error
fx_12 attempt 2 → ok
```

O definir explícitamente otra semántica si cada intento es un Effect independiente.

Esta decisión debe documentarse mediante ADR.

---

# 0.0.8 — Concurrencia

## Objetivo

Resolver effects paralelos.

Ejemplo:

```text
       ┌─ fx2
fx1 ───┼─ fx3
       └─ fx4
```

El journal no debe depender del orden de completion para representar causalidad.

Introducir:

```ts
parentEffectId
```

o una forma explícita de:

```text
causal predecessors
```

## Investigar

- Lamport clocks;
- monotonic sequence;
- causal graph;
- logical timestamp.

No añadir complejidad distribuida si no es necesaria.

---

# 0.0.9 — Primer release candidate conceptual

## Objetivo

Congelar los conceptos antes del salto a `0.1.0`.

Realizar revisión pública de:

- naming;
- JSON schemas;
- error model;
- concurrency;
- replay;
- adapter contract.

Publicar RFC:

```text
RFC-001: Effect Model
RFC-002: Journal Format
RFC-003: Replay Semantics
RFC-004: Adapter Contract
```

Solicitar casos reales donde el modelo falle.

---

# 0.1.0 — Core usable

## Significado

Primera versión que terceros deberían poder usar experimentalmente.

Garantías:

- core documentado;
- JSONL versionado;
- replay estricto;
- testing toolkit;
- 2 adapters;
- conformance suite.

A partir de aquí:

```text
breaking changes permitidos
```

pero deben estar documentados mediante migration guide.

---

# 0.2.0 — Policy engine

## Objetivo

Interponer decisiones antes de resolver effects.

```ts
runtime.usePolicy(policy);
```

Decisiones:

```text
allow
deny
require-approval
```

No copiar middleware HTTP.

Policy trabaja exclusivamente sobre:

```text
Effect + ExecutionContext
```

## Built-ins

```text
denyTool(...)
allowTools(...)
maxModelCost(...)
requireApproval(...)
```

---

# 0.3.0 — Human effects

Introducir:

```text
human.request
```

Casos:

```text
approval
input
selection
```

El effect puede permanecer:

```text
pending
```

hasta obtener resolución.

Esto obliga a formalizar:

```text
suspension
resume
```

sin necesitar snapshot completo del framework.

---

# 0.4.0 — Forking

Introducir forks de journal.

```ts
const fork = await runtime.fork({
  runId,
  at: "fx_12"
});
```

Soportar:

```text
replace effect result
resume execution
compare histories
```

Primer caso estrella:

> “¿Qué habría ocurrido si esta tool hubiese devuelto X?”

---

# 0.5.0 — Diff engine

Crear:

```text
@agent-effects/diff
```

Comparar dos runs:

```text
run A vs run B
```

Salida:

```text
shared effects
divergent effects
changed model outputs
changed tool results
new/removed effects
cost delta
```

No definir calidad de respuesta.

Solo diferencias estructurales.

---

# 0.6.0 — OpenTelemetry exporter

Crear:

```text
@agent-effects/otel
```

Mapear effects a semantic conventions existentes.

Ejemplos:

```text
model.invoke → GenAI inference span
tool.invoke  → execute_tool
agent.invoke → invoke_agent
```

Principio:

```text
OTel = projection
Journal = execution truth
```

No almacenar tracing-specific state en el core.

---

# 0.7.0 — Semantic checkpoints

Introducir:

```text
SemanticCheckpoint
```

Debe poder contener:

```text
conversation
portable state
journal cursor
pending effects
artifacts
adapter state
```

Compatibilidad declarada:

```text
exact
semantic
none
```

No prometer migración arbitraria entre frameworks.

---

# 0.8.0 — Capabilities

Introducir capability requirements sobre effects.

Ejemplo:

```ts
{
  type: "tool.invoke",
  requires: [
    {
      name: "github.issue",
      action: "create",
      resource: "org/repo"
    }
  ]
}
```

Implementar solo enforcement dentro del runtime.

Documentar claramente límites:

```text
Esto NO impide acceso alternativo por shell/network
si dichos canales no están también controlados.
```

---

# 0.9.0 — Hardening + ecosystem

## Objetivo

Preparar estabilidad.

Añadir adapters que la comunidad demande.

Posibles:

```text
Mastra
Vercel AI SDK
Pydantic AI bridge
Temporal executor
```

No añadirlos todos por obligación.

## Requisitos

- benchmark suite;
- fuzz testing del parser;
- crash recovery tests;
- schema compatibility tests;
- 100+ conformance cases;
- example applications;
- security model documentado.

---

# 0.10.0 — Spec split

Separar formalmente:

```text
implementation
```

de:

```text
specification
```

Crear:

```text
spec/
  effect.md
  journal.md
  replay.md
  adapter.md
```

Más schemas:

```text
schemas/
  journal-entry.schema.json
  effect.schema.json
  result.schema.json
```

Desde aquí otras implementaciones deberían poder existir en:

```text
Python
Rust
Go
```

sin importar TypeScript.

---

# 0.11.0 — Cross-language fixture suite

Publicar fixtures neutrales:

```text
fixtures/
  basic-tool-call/
  model-tool-model/
  parallel-tools/
  failed-tool/
  retry/
  human-approval/
  fork/
```

Cualquier implementación puede ejecutar:

```text
conformance fixtures
```

y declararse compatible.

---

# 0.12.0 — Security review

Antes de 1.0:

auditar:

- secrets leakage;
- journal PII;
- prompt content;
- tool arguments;
- artifact references;
- malicious journal inputs;
- replay of destructive effects;
- untrusted serialized errors;
- resource exhaustion.

Definir:

```text
redaction hooks
```

y:

```text
sensitive fields
```

Nunca asumir que journal puede almacenarse en plaintext sin consecuencias.

---

# 0.13.0 — Performance model

Benchmark:

```text
runtime.resolve
journal append
JSONL parser
replay lookup
policy evaluation
```

Objetivo conceptual:

El overhead del core debe ser insignificante frente a:

```text
LLM latency
network IO
tool execution
```

---

# 0.14.0 — Failure recovery semantics

Formalizar escenarios:

### A

```text
effect requested
process crashes
```

Resultado:

```text
pending
```

### B

```text
external effect executes
process crashes before result journal write
```

Este es el problema crítico de:

```text
at-least-once vs exactly-once
```

No prometer exactamente-once.

Introducir:

```text
idempotencyKey
```

donde tenga sentido.

Documentar:

```text
Effect runtime cannot guarantee exactly-once
for arbitrary external side effects.
```

---

# 0.15.0 — Stable adapter API candidate

Congelar candidato de:

```ts
interface AgentEffectsAdapter
```

Debe poder declarar:

```ts
interface AdapterCapabilities {
  modelEffects: boolean;
  toolEffects: boolean;
  humanEffects: boolean;
  nestedAgents: boolean;
  checkpoints: "exact" | "semantic" | "none";
}
```

Esto alimentará la matriz pública de compatibilidad.

---

# 0.16.0 — Public compatibility matrix

Ejemplo:

| Framework | Model | Tool | Human | Nested | Replay | Checkpoint |
|---|---:|---:|---:|---:|---:|---:|
| OpenAI Agents | ✓ | ✓ | ✓ | ~ | ✓ | semantic |
| LangGraph | ✓ | ✓ | ✓ | ✓ | ✓ | semantic |
| Mastra | ✓ | ✓ | ~ | ✓ | ✓ | none |

Los símbolos deben estar respaldados por conformance tests.

No por claims de marketing.

---

# 0.17.0 — CLI estable

CLI candidata:

```bash
agentfx record
agentfx inspect
agentfx replay
agentfx fork
agentfx diff
agentfx validate
```

Ejemplo:

```bash
agentfx inspect run.jsonl
```

Salida:

```text
run_01

00:00.000 run.started
00:00.013 model.invoke   gpt-x
00:01.827 tool.invoke    weather
00:02.102 model.invoke   gpt-x
00:03.110 run.completed

effects: 3
models: 2
tools: 1
```

---

# 0.18.0 — Plugin surface

Permitir extensiones sin ensuciar core.

Ejemplo:

```ts
registerEffectType({
  type: "browser.navigate",
  schema,
  executor
});
```

Effects custom deben conservar:

```text
namespace
```

Ejemplo:

```text
acme.browser.navigate
```

No reservar nombres arbitrariamente.

---

# 0.19.0 — Release candidate

Publicar:

```text
1.0.0-rc.1
```

Freeze de:

- Effect envelope;
- Result envelope;
- Journal format;
- Replay behavior;
- adapter interface;
- version negotiation.

Solo aceptar:

```text
bugfix
security
documentation
critical ergonomics
```

Evitar nuevas features.

---

# 1.0.0 — Stable Effect IR

## Contrato estable

1. `Effect` estable.
2. `EffectResult` estable.
3. Journal versionado.
4. Replay semánticamente definido.
5. Conformance suite pública.
6. Adapter API estable.
7. JSON schemas públicos.
8. ≥2 frameworks reales soportados.
9. OTel exporter.
10. Testing runtime.
11. Política de compatibilidad y deprecations.
12. Threat model documentado.

---

# 15. Lo que 1.0 NO promete

Incluso en `1.0.0`:

No promete:

```text
portable process snapshot
exactly-once external effects
deterministic LLM output
arbitrary cross-framework migration
sandbox isolation
tool authorization outside controlled channels
distributed scheduling
```

Sí promete:

```text
portable Effect semantics
portable Journal representation
effect-level replay
adapter conformance
testable execution boundary
```

---

# 16. Definition of Done para 1.0

## API

- sin breaking changes durante RC;
- documentación completa;
- TypeScript types considerados parte del API;
- JSON schema versionado.

## Compatibilidad

Mínimo dos adapters de frameworks distintos pasan:

```text
100% mandatory conformance tests
```

## Replay

Un run registrado debe poder reproducirse:

```text
offline
sin API keys
sin tool IO
```

cuando todos sus effects estén disponibles en el journal.

## Persistence

Debe existir al menos:

```text
memory
JSONL
```

como referencia.

No hace falta incluir Postgres en core.

## Observabilidad

OTel debe ser un exporter, nunca requisito.

## Security

Threat model y redaction definidos.

---

# 17. Métricas de éxito del proyecto

No medir únicamente stars.

Medir:

### Adopción técnica

```text
número de adapters externos
```

### Portabilidad

```text
mismo fixture ejecutado por múltiples runtimes
```

### Ecosistema

```text
número de Effect types externos
```

### Testing

```text
proyectos usando replay en CI
```

### Independencia

Una señal especialmente buena:

> Una tercera persona implementa un adapter sin tocar `core`.

La mejor señal:

> Alguien implementa la spec en otro lenguaje.

---

# 18. Riesgos

## Riesgo 1 — Abstracción demasiado genérica

Si `Effect` termina siendo:

```ts
{
  type: string;
  payload: any;
}
```

el proyecto no aporta semántica.

Mitigación:

- schemas concretos;
- core effect taxonomy muy pequeña;
- conformance tests.

---

## Riesgo 2 — Convertirse en framework

Síntomas:

```text
Agent class
Graph DSL
Prompt API
Memory API
Tool registry enorme
Deployment server
```

Mitigación:

Preguntar siempre:

> ¿Esto pertenece a la frontera de efectos?

Si no:

```text
fuera del core
```

---

## Riesgo 3 — Duplicar OpenTelemetry

Mitigación:

```text
Journal → OTel
```

No:

```text
Journal == tracing format
```

---

## Riesgo 4 — Duplicar Agent Protocol

Agent Protocol describe cómo interactuar con runs/threads y streams.

Agent Effects debe describir:

```text
qué efectos solicita una ejecución
```

Mantener esa frontera.

---

## Riesgo 5 — “Replay” engañoso

No utilizar wording como:

```text
perfect deterministic agent replay
```

Utilizar:

```text
effect-level deterministic replay
```

---

## Riesgo 6 — Exactly-once fantasy

Una API externa puede aceptar una transferencia bancaria y el proceso puede morir antes de persistir el resultado.

El proyecto debe reconocer explícitamente:

```text
unknown outcome
```

como estado posible.

---

# 19. Estados de resolución recomendados

En lugar de únicamente:

```text
ok
error
```

considerar antes de 1.0:

```ts
type EffectResolution =
  | "ok"
  | "error"
  | "cancelled"
  | "denied"
  | "pending"
  | "unknown";
```

`unknown` es importante para crash recovery.

Ejemplo:

```text
POST /payment → servidor respondió
             → proceso murió antes de persistir

¿se procesó el pago?

UNKNOWN
```

---

# 20. ADRs fundamentales

Crear desde el principio:

```text
docs/adr/
```

ADRs sugeridos:

```text
0001-effect-vs-event.md
0002-effect-identity.md
0003-journal-append-only.md
0004-replay-semantics.md
0005-errors-and-retries.md
0006-concurrency.md
0007-exactly-once.md
0008-adapter-metadata.md
0009-schema-versioning.md
0010-sensitive-data.md
```

---

# 21. Estrategia OSS

## Fase 1

No anunciar:

> nuevo estándar para agentes.

Anunciar:

> experimental effect runtime for recording and replaying agent side effects.

Mucho más creíble.

---

## Fase 2

Cuando existan dos adapters:

> framework-neutral effect IR.

---

## Fase 3

Solo si aparecen implementaciones independientes:

> specification.

El estándar debe aparecer por adopción.

No por declaración.

---

# 22. Primer README ideal

La propuesta de valor debería caber en algo parecido a:

```text
Agent Effects makes agent side effects explicit.

Record a real run once.
Replay it offline.
Mock tools and models in tests.
Inspect exactly what the agent attempted to do.

Works below your agent framework instead of replacing it.
```

---

# 23. Demo que debería vender el proyecto

No hacer inicialmente una demo multi-agent compleja.

Hacer:

```text
weather agent
```

### Primera ejecución

```text
User
 ↓
Model
 ↓
Weather Tool
 ↓
Model
 ↓
Answer
```

El journal registra:

```text
model.invoke
tool.invoke
model.invoke
```

### Segunda ejecución

Desconectar internet.

```bash
agentfx replay run.jsonl
```

Resultado:

```text
✓ model.invoke replayed
✓ tool.invoke replayed
✓ model.invoke replayed

external calls: 0
```

Después:

```bash
agentfx fork run.jsonl --effect fx_2 --result fixtures/rain.json
```

Y mostrar:

```text
original: "Hace sol."
fork:     "Está lloviendo."
```

Esa demo explica:

```text
record
replay
fork
```

en menos de dos minutos.

---

# 24. Preguntas de investigación abiertas

Antes de `0.1.0` deberían resolverse:

### Effect identity

¿ID asignado por agent adapter o runtime?

### Model calls

¿`model.invoke` representa:

```text
semantic inference
```

o request exacto del proveedor?

Recomendación:

```text
semantic core + provider metadata
```

### Streaming

¿Un stream de tokens es:

```text
un EffectResult streaming
```

o múltiples journal entries?

### Parallel tools

¿Cómo se representa causalidad?

### Retries

¿Cada attempt es:

```text
mismo Effect
```

o:

```text
nuevo Effect
```

### Cancellation

¿Cancelar implica una resolución del effect?

### Nested agents

¿`agent.invoke` debe tratarse como effect atómico o exponer effects hijos?

Probablemente ambos mediante:

```text
parentEffectId
```

### Secrets

¿Qué campos se redactan antes de persistir?

### Binary data

No incluir blobs directamente.

Utilizar:

```text
ArtifactRef
```

---

# 25. Posible estructura del repositorio

```text
agent-effects/
│
├── packages/
│   ├── core/
│   ├── journal-memory/
│   ├── journal-jsonl/
│   ├── replay/
│   ├── testing/
│   ├── adapter-openai/
│   ├── adapter-langgraph/
│   ├── otel/
│   └── cli/
│
├── spec/
│   ├── effects.md
│   ├── journal.md
│   ├── replay.md
│   └── adapters.md
│
├── schemas/
│
├── fixtures/
│
├── examples/
│   ├── weather-agent/
│   └── replay-weather-agent/
│
├── docs/
│   ├── concepts/
│   └── adr/
│
└── conformance/
```

---

# 26. Orden recomendado de implementación

```text
0.0.1
Effect + Executor

    ↓

0.0.2
Journal

    ↓

0.0.3
Replay

    ↓

0.0.4
Testing

    ↓

0.0.5
Adapter A

    ↓

0.0.6
Adapter B + Conformance

    ↓

0.0.7–0.0.9
semantics hardening

    ↓

0.1
usable experimental core

    ↓

Policy / human approval

    ↓

Fork / diff

    ↓

OTel

    ↓

Semantic checkpoints

    ↓

Capabilities

    ↓

Spec + cross-language conformance

    ↓

1.0
```

---

# 27. Criterio estratégico principal

Cada nueva feature debe pasar esta pregunta:

> **¿Hace más explícita, portable, controlable o reproducible la frontera de side effects de un agente?**

Si la respuesta es no:

```text
probablemente pertenece a otro proyecto.
```

---

# 28. Tesis final

El proyecto no necesita ganar la batalla por ser:

```text
"el framework donde escribes tu agente"
```

Puede ocupar una capa inferior:

```text
                LangGraph
                OpenAI
                Mastra
                custom
                   │
                   ▼
          ┌──────────────────┐
          │  Agent Effects   │
          │        IR        │
          └──────────────────┘
                   │
        ┌──────────┼───────────┐
        ▼          ▼           ▼
      real       replay       test
     executor    executor    executor
        │
        ▼
      policy
        │
        ▼
     journal
        │
    ┌───┼────┐
    ▼   ▼    ▼
   diff fork OTel
```

Si esta capa funciona bien, los frameworks pueden cambiar sin invalidar:

- fixtures;
- journals;
- policies;
- tests;
- tooling de debugging;
- conformance.

Ese es el valor central que debería protegerse desde `0.0.1` hasta `1.0.0`.

---

# 29. Referencias OSS a vigilar

Estas referencias no deben copiarse; sirven para comprobar constantemente que el proyecto mantiene una frontera diferenciada.

- LangChain Agent Protocol — runs, threads, streaming, checkpoints y lifecycle.
- OpenTelemetry GenAI Semantic Conventions — observabilidad de inference, agentes y tools.
- Pydantic AI StepPersistence — snapshots, event logs y tool-effect ledger.
- Temporal — durable execution y replay de histories.
- DBOS / Restate — ejecución durable y side-effect management.
- Effect — typed effects, dependency injection funcional y testabilidad.
- AG-UI — eventos y sincronización agent ↔ frontend.
- MCP — tools/resources/context y sus fronteras de autorización.
- WASI — inspiración para capability-based runtime design.

## URLs de referencia

- https://github.com/langchain-ai/agent-protocol
- https://github.com/open-telemetry/semantic-conventions-genai
- https://opentelemetry.io/blog/2026/genai-observability/
- https://github.com/pydantic/pydantic-ai
- https://temporal.io/
- https://www.dbos.dev/
- https://effect.website/
- https://github.com/ag-ui-protocol/ag-ui
- https://modelcontextprotocol.io/
- https://wasi.dev/
