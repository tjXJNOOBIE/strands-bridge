# Strands Bridge Runtime Service

> **Status:** Active replacement design
> **Authority:** Canonical bridge direction for Agents for Humans products
> **Owns:** A standalone Strands runtime service exposed over MCP
> **Must not define:** Product-specific behavior, Tavall Java DI internals, product persistence, approval policy, UI rules, authentication policy, or deterministic tool implementations

## About

`strands-bridge` is a standalone Node.js/TypeScript runtime service that hosts the Strands Agents SDK behind an MCP boundary. Tavall agent products do not embed this package as their application runtime.

The product application remains Java-first and uses the existing Tavall Java MCP and Function Catalog stack for its external and internal MCP surfaces. Java asks the bridge to perform agent reasoning. Strands asks Java-owned MCP capability servers to perform deterministic side effects.

```text
client / ChatGPT / plugin
    -> Tavall product Java MCP/runtime
        -> AIAgentRuntime
            -> Strands AIAgentProvider
                -> Strands runtime service over MCP
                    -> Strands model/tool loop
                        -> Java Function Catalog MCP tools
                            -> Tavall DI / registry / cache / database / scheduler / browser / GitHub / Discord / cloud / product tools
```

The bridge exists because Strands is a Node/TypeScript SDK. That implementation detail must not force Tavall products to become Node applications.

## Ownership Rules

### Java owns

- product application lifecycle;
- public MCP transport and product tool schemas;
- Tavall dependency injection and `DependencyAccess` integration;
- deterministic product capabilities;
- authorization, policy, approvals, audit, and human-in-the-loop boundaries;
- Tavall Registry, Cache, Database, EventBus, Scheduler, Concurrency, and other Java infrastructure;
- product persistence and state authority;
- external integrations when an existing Tavall Java provider exists;
- product orchestration before and after an agent invocation;
- policy-filtered Function Catalog views exposed to agents.

### Strands runtime service owns

- native Strands `Agent` construction;
- model/provider selection supplied by runtime configuration;
- the model/tool reasoning loop;
- conversation/session context delegated to native Strands facilities;
- streaming and cancellation;
- agent-as-tool composition;
- lifecycle and cleanup of Strands-owned MCP clients;
- translation between the service MCP contract and native Strands invocation/result primitives.

### The bridge must not own

- product-specific workflows or policy;
- Tavall infrastructure clones in TypeScript;
- public product MCP schemas;
- product databases or caches;
- Discord, browser, cloud, GitHub, or other integrations when Java already owns them;
- a second generalized application framework.

## Existing Java MCP Reuse

The hackathon agents must not introduce another Java MCP framework. Reuse `TavallStudios/function-catalog`:

- `agent-runtime` remains the provider-neutral Java agent execution boundary;
- the Strands integration is implemented as an `AIAgentProvider`;
- `mcp-server` remains the canonical Java projection of `@AIFunction` capabilities to MCP;
- product applications register their real Java capabilities into Function Catalog and give Strands only the policy-filtered tool surface it is allowed to call.

Product MCP handlers are projections over Java-owned operations. They do not contain a second copy of product behavior.

## Bidirectional MCP Boundary

There are two intentionally separate MCP directions.

### Java -> Strands

The Java `AIAgentProvider` connects to this service as an MCP client. The bridge exposes a compact runtime surface:

- `strands_agent_create`
- `strands_agent_invoke`
- `strands_agent_cancel`
- `strands_agent_close`
- `strands_agent_invoke_once`

The persistent operations exist for sessionful agents. `strands_agent_invoke_once` is the stateless provider path for ordinary `AIAgentRuntime` execution and guarantees runtime cleanup after the invocation.

Agent creation receives native Strands-compatible runtime configuration plus Java-owned MCP server descriptors that Strands may use as tools.

### Strands -> Java

The Strands runtime loads Java-owned Function Catalog MCP servers as tool sources. Those servers expose deterministic capabilities backed by Tavall Java infrastructure.

Examples include Tavall Cloud, Git/GitHub, Discord, browser/web-design, product persistence/state, scheduling/events, and authentication/approval-aware life-admin operations.

The bridge never reimplements those capabilities in TypeScript.

## Runtime Flow

```text
client calls product Java MCP tool
    -> Java validates auth/policy/input
    -> Java AIAgentRuntime invokes Strands AIAgentProvider
    -> provider calls strands-bridge MCP
    -> Strands reasons
    -> Strands calls Java Function Catalog MCP tools as needed
    -> Java executes deterministic Tavall behavior
    -> Strands returns final result
    -> Java validates/post-processes/audits result
    -> Java returns product MCP response
```

## Migration Rules

Community-Agent, Recovery-Agent, Web-Design-Agent, and Life-Agent currently contain useful TypeScript behavior, tests, prompts, schemas, demo assets, and Strands integration. Those are migration inputs, not discarded work.

For each product:

1. Port deterministic product behavior to the Java product runtime behind canonical Function Catalog operations.
2. Move product policy, approvals, audit, state authority, and orchestration to Java.
3. Preserve prompts and Strands-specific configuration as agent definitions consumed by the Java agent runtime/provider.
4. Replace embedded `@tjxjnoobie/strands-bridge` ownership with the Java `AIAgentRuntime` plus Strands MCP provider.
5. Expose product capabilities using the existing Tavall Java MCP implementation.
6. Keep TypeScript only for this standalone Strands service or genuinely browser-only UI assets.
7. Validate Java -> bridge -> Strands -> Java tool round trips before deleting superseded TypeScript runtime paths.

Recovery-Agent's Java state-authority is a migration seed, not the final split. Product orchestration and state coordination belong in the Java application runtime rather than leaving Java as a persistence sidecar to a TypeScript control plane.

## Packaging

The Strands bridge is installed/deployed once as a runtime service. Product Java applications do not depend on its npm package transitively. Local deployments may launch it over stdio; durable/hosted deployments may expose it through a private MCP transport. Transport choice does not change ownership.

## Validation Requirements

Before this replacement architecture is complete:

- the bridge runs as an MCP server independent of any product package;
- a Java Function Catalog provider initializes and calls the bridge;
- the bridge creates/invokes a native Strands agent;
- a Strands agent discovers and calls a Java-owned Function Catalog MCP capability;
- cancellation and cleanup work across the process boundary;
- no product requires direct `@strands-agents/sdk` or embedded `@tjxjnoobie/strands-bridge` runtime ownership;
- each product's public MCP entrypoint is Java-owned;
- product policy/approval/audit/state ownership is Java-owned;
- architecture tests reject reintroduction of TypeScript-owned Tavall infrastructure or embedded Strands ownership in product backends.

## Final Rules Summary

- Java owns the products.
- Strands owns reasoning.
- MCP joins them.
- TypeScript is an implementation detail of the standalone Strands service, not Tavall product architecture.
- Existing Tavall Java MCP, Function Catalog, agent runtime, and Tavall Java infrastructure are reused rather than recreated.
- Product capabilities remain deterministic and Java-owned; Strands may call them as MCP tools.
- Existing TypeScript work is ported and validated before deletion, not thrown away.
