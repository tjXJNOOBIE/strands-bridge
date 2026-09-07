# Repository instructions

`custom-strands-bridge` is the shared TypeScript/Node integration boundary between Tavall agent products and the Strands Agents SDK.

## Authoritative engineering guidance

Before changing code, architecture, tests, packaging, lifecycle, or documentation, read the current versions of **all** shared Tavall quality documents in `TavallStudios/tavall-docs`:

- [`CODE_ARCHITECTURE.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/CODE_ARCHITECTURE.md)
- [`DOCUMENTATION_STANDARDS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/DOCUMENTATION_STANDARDS.md)
- [`GIT_WORKFLOW.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/GIT_WORKFLOW.md)
- [`BUILDERS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/BUILDERS.md)
- [`CLASSES.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/CLASSES.md)
- [`DEPENDENCY_INJECTION_AND_ORCHESTRATION.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/DEPENDENCY_INJECTION_AND_ORCHESTRATION.md)
- [`EFFECT_SEQUENCES.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/EFFECT_SEQUENCES.md)
- [`ENTITY_PERSISTENCE.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/ENTITY_PERSISTENCE.md)
- [`HANDLERS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/HANDLERS.md)
- [`INTERFACES_AND_ABSTRACTIONS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/INTERFACES_AND_ABSTRACTIONS.md)
- [`METHODS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/METHODS.md)
- [`NAMESPACES_VARIABLES_AND_OOP.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/NAMESPACES_VARIABLES_AND_OOP.md)
- [`REGISTRIES_CACHES_AND_REPOSITORIES.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/REGISTRIES_CACHES_AND_REPOSITORIES.md)
- [`REQUESTS_RESULTS_RESOLVERS_AND_FORMATTERS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/REQUESTS_RESULTS_RESOLVERS_AND_FORMATTERS.md)
- [`ROUTERS_AND_DELEGATION.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/ROUTERS_AND_DELEGATION.md)
- [`TESTING_AND_GIT.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/TESTING_AND_GIT.md)
- [`UTILITIES.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/UTILITIES.md)
- [`VALIDATION_FALLBACKS_AND_ANTI_PATTERNS.md`](https://github.com/TavallStudios/tavall-docs/blob/main/docs/quality/code-architecture/VALIDATION_FALLBACKS_AND_ANTI_PATTERNS.md)

The primary `CODE_ARCHITECTURE.md` wins if a detailed chapter conflicts with it. Repository-local rules may strengthen those documents but must not silently weaken them.

## Tavall tool ownership

- Do **not** recreate `tavall-di`, Tavall Cache, Tavall Registry, Tavall Database, Tavall Concurrency, Tavall EventBus, Tavall Scheduler, or other Java-owned Tavall systems in TypeScript.
- Tavall Java runtimes remain composed with the real Tavall Java tools. This bridge reaches those capabilities through typed MCP boundaries when an agent needs them.
- Do not add cache, registry, repository, database, scheduler, or durable state merely because another Tavall project uses those tools. First classify the state and authority according to the shared architecture.
- Do not add a TypeScript service locator or static dependency container as a substitute for `tavall-di`.
- Externally owned Strands objects, MCP clients, configuration values, and platform adapters may be composed at the bootstrap/runtime boundary because they are not Tavall-managed Java dependencies.

## Bridge ownership

The bridge owns reusable Strands integration behavior shared by multiple agents:

- typed runtime identity and configuration;
- native Strands `AgentConfig` preservation;
- declarative MCP composition through Strands' own MCP loader;
- startup initialization and partial-startup cleanup;
- invocation, streaming, cooperative cancellation, agent-as-tool composition, and deterministic teardown;
- npm package boundaries required for transitive installation by consumer agent packages.

The bridge does not own product prompts, product-specific tools, user data, business rules, persistence, deployment policy, or an agent product's UI.

Prefer native Strands capability over a bridge wrapper when the bridge would add no policy, lifecycle, validation, or stable Tavall boundary.

## Tests

- Use delegate-style tests against real bridge classes.
- Fake only true external boundaries such as the Strands SDK, MCP network endpoints, model providers, or cloud services when a real boundary is unavailable or unsafe.
- Do not mock the class under test.
- Cover success, validation rejection, startup failure, cleanup failure, cancellation, shutdown, and retry behavior when those paths exist.
- Test class/file names mirror the production class they cover.
- Record exactly what ran. A contract shim is not a real installed-SDK integration test and must never be reported as one.

## Git

Follow the shared Tavall PR-first workflow. Use `working/*` branches, structured Tavall commit messages, truthful validation, linked issues for architecture-crossing changes, and accountable review before production promotion.
