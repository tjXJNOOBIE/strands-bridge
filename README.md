# Custom Strands Bridge

Shared TypeScript runtime integration for Tavall agent products built with the [Strands Agents SDK](https://strandsagents.com/).

The package exists so product repositories can stay focused on what their agent does while sharing one tested boundary for Strands startup, MCP composition, invocation, streaming, cancellation, agent-as-tool composition, and cleanup.

## Installation

Consumer agent packages depend on the bridge transitively. End users install or run the agent package, not the bridge separately.

For direct library development:

```bash
npm install @tjxjnoobie/custom-strands-bridge
```

Node.js 22 or newer is required.

## Runtime model

```text
agent product
    -> @tjxjnoobie/custom-strands-bridge
        -> @strands-agents/sdk
            -> model provider
            -> native/local tools
            -> MCP clients
                -> Tavall Java runtimes and other tool servers
```

Strands runs in the local Node.js process. Amazon Bedrock is the SDK default model provider, while the native `AgentConfig` accepted by the bridge preserves Strands' other providers and advanced features.

The TypeScript bridge does not recreate Tavall Java infrastructure. `tavall-di` and other Tavall Java tools remain authoritative inside their Java runtimes and are consumed over MCP where appropriate.

## Example

```ts
import { StrandsAgentRuntimeBootstrap } from '@tjxjnoobie/custom-strands-bridge'

const bootstrap = new StrandsAgentRuntimeBootstrap()

const runtime = await bootstrap.createAgentRuntime({
  agent: {
    id: 'recovery-agent',
    name: 'Recovery Agent',
    systemPrompt: 'Diagnose recoverable service failures and verify recovery.',
    printer: false,
    traceAttributes: {
      product: 'recovery-agent',
    },
  },
  mcpServers: {
    tavall: {
      url: '${env:TAVALL_MCP_URL}',
      headers: {
        Authorization: '${env:TAVALL_MCP_AUTHORIZATION}',
      },
      prefix: 'tavall',
      toolFilters: {
        allowed: ['service_.*', 'diagnostic_.*'],
      },
    },
  },
})

try {
  const result = await runtime.invokeAgent('Inspect the unhealthy target and recover it safely.')
  console.log(result.toString())
} finally {
  await runtime.close()
}
```

MCP environment interpolation, transport selection, OAuth client credentials, prefixes, filters, and `continueOnError` are provided by Strands itself. The bridge does not maintain a competing parser or auth system.

## Native Strands features

The `agent` field is a typed extension of Strands `AgentConfig` that requires a stable `id` and `name`. This means consumer products can use Strands features without waiting for this bridge to invent wrappers for them, including:

- model providers and model routers;
- native and MCP tools;
- plugins and hooks;
- context/conversation management;
- session and memory managers;
- retries and interventions;
- structured output;
- trace attributes and metrics;
- concurrent or sequential tool execution;
- sandbox/storage configuration;
- checkpointing and background tasks.

## Multi-agent composition

A runtime can expose its agent as a Strands tool without leaking the underlying `Agent` handle:

```ts
const specialistTool = specialistRuntime.createAgentTool({
  name: 'recovery_specialist',
  description: 'Diagnoses and verifies recoverable service failures.',
})
```

The returned tool can be supplied to another agent's native `AgentConfig.tools`.

## Development

Normal bridge checks:

```bash
npm install
npm run check
```

Promotion checks against the physically installed Strands SDK:

```bash
npm run check:real
```

`check:real` first verifies that `node_modules/@strands-agents/sdk` is the exact version pinned by this package. A contract shim, mismatched SDK, or missing install fails before the MCP integration is allowed to run. It then starts a disposable local MCP server, initializes a native Strands agent through that server, verifies MCP initialization/tool discovery, and closes the runtime.

An authorized model invocation is a separate credential-gated check:

```bash
STRANDS_BRIDGE_MODEL_ID=global.anthropic.claude-sonnet-4-6 npm run test:integ:model
```

The model smoke intentionally fails when `STRANDS_BRIDGE_MODEL_ID` is absent. Provider credentials and region configuration remain environment-owned and are never committed.

The package pins `@strands-agents/sdk` so all consuming agents share one validated SDK baseline. Dependency upgrades should be deliberate bridge changes with matching validation. `prepack` rebuilds `dist` before publication so an npm release cannot quietly contain stale compiled output.

See [`docs/strands-bridge/STRANDS_BRIDGE_FINAL_DRAFT.md`](docs/strands-bridge/STRANDS_BRIDGE_FINAL_DRAFT.md) for the current design contract.
