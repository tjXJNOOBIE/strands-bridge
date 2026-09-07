# Strands Bridge Final Draft

> **Status:** Working design  
> **Authority:** Proposed bridge behavior still open to material design changes  
> **Owns:** Shared Strands runtime integration used by Tavall agent products  
> **Must not define:** Product-specific agent behavior, Tavall Java DI internals, product persistence, UI rules, or deployment policy

## About

`custom-strands-bridge` provides one reusable Node.js/TypeScript boundary between Tavall agent products and the Strands Agents SDK.

Its purpose is to keep the four Agents for Humans products from copying the same Strands bootstrap, MCP composition, lifecycle, and shutdown behavior while preserving direct access to native Strands capabilities.

The bridge is a library, not an agent product and not a second agent framework.

## Ownership Rules

The bridge owns:

- a stable npm package boundary;
- required runtime identity (`id` and `name`);
- composition of native Strands `AgentConfig` with declarative MCP servers;
- Strands agent initialization;
- cleanup after partial startup;
- invocation and streaming through a lifecycle-owned runtime;
- cooperative cancellation;
- agent-as-tool composition without exposing the underlying mutable `Agent` handle;
- reverse-order MCP teardown and cleanup retry after a failed disconnect.

The bridge does not own:

- model-provider implementations;
- MCP transport/auth parsing already provided by Strands;
- Tavall Java dependency injection;
- Tavall cache, registry, database, event, scheduling, or concurrency implementations;
- product prompts, workflows, permissions, policies, or user-facing messages;
- consumer application persistence;
- AgentCore deployment configuration.

## Tavall Infrastructure Boundary

`tavall-di` is a Java runtime composition system. It remains authoritative inside Tavall Java runtimes.

The bridge must not create a TypeScript clone of `DependencyMap`, `DependencyAccess`, `@DelegatesTo`, or any other Tavall DI mechanism. When a TypeScript agent needs a Tavall capability, the owning Java runtime resolves its real Tavall-managed dependencies and exposes a typed operation through MCP.

The same rule applies to Tavall Cache, Registry, Database, Concurrency, EventBus, Scheduler, and other Java tools. Their presence elsewhere in Tavall does not justify recreating them in this package.

```text
Strands TypeScript agent
    -> MCP tool
        -> Tavall Java runtime
            -> tavall-di-owned handler/service/repository/etc.
```

## Technical Structure

```text
src/
├── agent/
│   ├── bootstrap/
│   │   └── StrandsAgentRuntimeBootstrap.ts
│   ├── config/
│   │   └── StrandsAgentRuntimeConfig.ts
│   ├── error/
│   │   ├── StrandsAgentRuntimeClosedError.ts
│   │   └── StrandsAgentRuntimeConfigError.ts
│   └── runtime/
│       ├── IStrandsAgentRuntime.ts
│       └── StrandsAgentRuntime.ts
├── strands/
│   └── platform/
│       ├── IStrandsRuntimePlatform.ts
│       └── StrandsRuntimePlatform.ts
└── index.ts
```

There are intentionally no `service`, `manager`, `registry`, `cache`, `repository`, or generic `util` packages. No current bridge behavior requires those ownership roles.

### `StrandsAgentRuntimeBootstrap`

Owns startup composition. It validates bridge-required identity before external mutation, loads declarative MCP clients through the Strands SDK, composes them with any native configured tools, creates the native `Agent`, initializes it, and returns the lifecycle owner.

If initialization fails after MCP clients were created, bootstrap closes those clients in reverse order before reporting failure. Cleanup failure is reported together with the startup failure instead of hiding either one.

### `StrandsAgentRuntime`

Owns the live agent generation returned to a consumer. It invokes and streams through the native Strands agent, exposes cooperative cancellation, creates agent-as-tool views, and closes MCP resources in reverse order.

Once close begins, the runtime rejects new work. If a client disconnect fails, a later `close()` call retries only resources that still report non-disconnected state.

### `StrandsRuntimePlatform`

A narrow external-platform substitution boundary over Strands construction and declarative MCP loading. It exists so bridge tests can replace the actual SDK/network boundary while exercising real bridge bootstrap and runtime behavior.

It must not grow product logic or become a second framework API.

## Configuration Contract

`StrandsAgentRuntimeConfig` contains:

- `agent`: native Strands `AgentConfig` with required non-blank `id` and `name`;
- `mcpServers`: optional native declarative `McpServerConfig` map or supported config-file path;
- `mcpDefaults`: optional native Strands MCP client defaults.

The bridge intentionally preserves native `AgentConfig` instead of creating mirror types for model providers, plugins, session managers, memory managers, retries, structured output, tracing, tool execution, storage, sandboxing, or checkpointing.

That keeps Strands visibly and materially responsible for the agent loop, which is both the correct dependency boundary and important hackathon evidence.

## MCP Rules

Use Strands' native declarative MCP loader.

The bridge does not duplicate:

- environment interpolation;
- stdio/HTTP/SSE transport selection;
- OAuth client-credentials handling;
- headers;
- tool prefixes;
- allowed/rejected tool filters;
- experimental MCP task configuration;
- `continueOnError` behavior.

Product repositories decide which MCP servers and tools their agent may use. Recovery-specific machine operations, web-design tools, community integrations, and life-admin integrations remain product-owned configuration/behavior.

Secrets must be supplied through environment/configuration facilities and never committed to repository source.

## Runtime Flows

### Startup

```text
validate bridge identity
    -> load native Strands MCP clients
    -> compose native tools + MCP clients
    -> create native Strands Agent
    -> initialize Agent
    -> publish StrandsAgentRuntime
```

No runtime is published before initialization succeeds.

### Invocation

```text
consumer request
    -> StrandsAgentRuntime
    -> native Agent.invoke()/Agent.stream()
    -> Strands model/tool loop
    -> native AgentResult / stream events
```

The bridge returns native Strands results so traces, metrics, interrupts, structured output, and invocation state remain available.

### Shutdown

```text
mark runtime closed
    -> cooperatively cancel active invocation
    -> disconnect MCP clients in reverse order
    -> report aggregate cleanup failure, if any
```

A runtime marked closed never accepts a new invocation or creates a new agent tool view.

## Multi-Agent Rules

`createAgentTool(...)` delegates to Strands' native agent-as-tool support. This enables specialist compositions without leaking the underlying `Agent` object and inviting callers to bypass runtime ownership.

Complex graph/swarm/workflow behavior remains in the agent product that owns the workflow unless multiple products later prove a genuinely reusable bridge-level policy.

## Persistence, Cache, and Registry Rules

The bridge currently owns no durable or keyed runtime data requiring a repository, cache, or registry.

Do not introduce one until its authority, lifetime, miss/stale policy, replacement behavior, and cleanup owner are explicit. Session and memory facilities supplied through native Strands configuration remain external Strands/application boundaries, not bridge-owned Tavall state.

## AgentCore Integration

Strands runs locally inside the Node.js process. The same package may run in an AgentCore-hosted process later.

AgentCore deployment is a deployment/infrastructure concern and is intentionally not embedded into the bridge runtime. A consumer deployment may configure AgentCore without changing the agent's bridge contract.

## npm Consumer Contract

Agent products depend on this package transitively:

```text
npx <agent-package>
    -> installs agent package
        -> installs @tjxjnoobie/custom-strands-bridge
            -> installs @strands-agents/sdk
```

End users should not need a separate bridge installation step.

The bridge pins its Strands dependency to one validated version. Consumers should not independently pin conflicting Strands versions unless a deliberate compatibility boundary is documented.

## Validation Requirements

Before the bridge foundation is promoted from draft:

- compile with Node.js 22+ and the real installed `@strands-agents/sdk` version declared in `package.json`;
- run delegate-style bridge tests;
- verify identity validation occurs before MCP loading;
- verify native tools and MCP clients are both supplied to the agent;
- verify agent initialization happens before publication;
- verify partial-startup cleanup and aggregate failure reporting;
- verify invocation and streaming preserve native Strands results;
- verify cancellation;
- verify reverse-order shutdown;
- verify failed cleanup can be retried;
- verify new work is rejected after close;
- run an MCP integration smoke test against a disposable/local server;
- run a model invocation smoke test using an authorized provider when credentials are available;
- run `npm pack --dry-run` and inspect the package contents;
- generate and commit the dependency lock from the real npm install.

Contract-shim tests may be used when a restricted execution environment cannot reach npm, but they are not a substitute for the real installed-SDK checks above and must be reported as such.

## Final Rules Summary

- Strands owns the agent loop and its native features.
- The bridge owns reusable composition and lifecycle, not product behavior.
- Tavall Java tools stay in Java and are consumed over MCP rather than recreated.
- Validation happens before external runtime mutation.
- Partial startup never publishes a runtime and cleans already-created resources.
- Shutdown is explicit, reverse ordered, retryable for failed disconnects, and honest about cleanup failure.
- Native `AgentConfig` and `AgentResult` remain visible so the bridge does not become an unnecessary parallel SDK.
- Agent packages install the bridge transitively so users keep a one-command install/run experience.
