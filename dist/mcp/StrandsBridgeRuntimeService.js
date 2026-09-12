import { StrandsAgentRuntimeBootstrap } from '../agent/bootstrap/StrandsAgentRuntimeBootstrap.js';
/**
 * Owns the process-local Strands runtime handles exposed through MCP.
 * Product state and product capabilities remain Java-owned.
 */
export class StrandsBridgeRuntimeService {
    runtimeBootstrap;
    runtimes = new Map();
    runtimeReferences = new Map();
    constructor(runtimeBootstrap = new StrandsAgentRuntimeBootstrap()) {
        this.runtimeBootstrap = runtimeBootstrap;
    }
    async createAgent(runtimeConfig, agentTools = []) {
        const agentId = this.requireAgentId(runtimeConfig);
        if (this.runtimes.has(agentId)) {
            throw new Error(`Strands agent runtime already exists: ${agentId}`);
        }
        const resolved = this.resolveAgentTools(agentId, agentTools);
        const composedConfig = this.withAgentTools(runtimeConfig, resolved.tools);
        const runtime = await this.runtimeBootstrap.createAgentRuntime(composedConfig);
        this.runtimes.set(agentId, runtime);
        this.runtimeReferences.set(agentId, resolved.referencedAgentIds);
    }
    async invokeAgent(agentId, input) {
        const runtime = this.requireRuntime(agentId);
        const result = await runtime.invokeAgent(input);
        return {
            agentId,
            text: result.toString(),
        };
    }
    async invokeAgentObserved(agentId, input, limits) {
        const safeAgentId = this.requireText(agentId, 'agentId');
        const runtime = this.requireRuntime(safeAgentId);
        const toolEvents = [];
        const stream = runtime.streamAgent(input, this.invokeOptions(limits));
        while (true) {
            const next = await stream.next();
            if (next.done) {
                const result = next.value;
                const stopReason = this.stopReason(result);
                return {
                    agentId: safeAgentId,
                    text: result.toString(),
                    ...(stopReason === undefined ? {} : { stopReason }),
                    toolEvents,
                };
            }
            this.collectToolEvents(next.value, toolEvents);
        }
    }
    cancelAgent(agentId) {
        this.requireRuntime(agentId).cancelInvocation();
    }
    async closeAgent(agentId) {
        const safeAgentId = this.requireText(agentId, 'agentId');
        const runtime = this.requireRuntime(safeAgentId);
        const dependents = this.liveDependentsOf(safeAgentId);
        if (dependents.length > 0) {
            throw new Error(`Cannot close Strands agent runtime ${safeAgentId}; referenced by live runtime(s): ${dependents.join(', ')}`);
        }
        try {
            await runtime.close();
        }
        finally {
            this.runtimes.delete(safeAgentId);
            this.runtimeReferences.delete(safeAgentId);
        }
    }
    async invokeOnce(runtimeConfig, input) {
        const agentId = this.requireAgentId(runtimeConfig);
        const runtime = await this.runtimeBootstrap.createAgentRuntime(runtimeConfig);
        try {
            const result = await runtime.invokeAgent(input);
            return {
                agentId,
                text: result.toString(),
            };
        }
        finally {
            await runtime.close();
        }
    }
    async closeAll() {
        const runtimes = Array.from(this.runtimes.entries());
        const failures = [];
        for (const [agentId, runtime] of runtimes.reverse()) {
            try {
                await runtime.close();
            }
            catch (error) {
                failures.push(error);
            }
            finally {
                this.runtimes.delete(agentId);
                this.runtimeReferences.delete(agentId);
            }
        }
        if (failures.length > 0) {
            throw new AggregateError(failures, 'One or more Strands runtimes failed to close.');
        }
    }
    invokeOptions(limits) {
        if (limits === undefined)
            return undefined;
        return {
            limits: {
                ...(limits.turns === undefined ? {} : { turns: limits.turns }),
                ...(limits.outputTokens === undefined ? {} : { outputTokens: limits.outputTokens }),
                ...(limits.totalTokens === undefined ? {} : { totalTokens: limits.totalTokens }),
            },
        };
    }
    collectToolEvents(value, collected) {
        if (!this.isRecord(value))
            return;
        if (value['type'] === 'toolStreamUpdateEvent') {
            const event = value['event'];
            if (this.isRecord(event)) {
                this.collectToolEvents(event['data'], collected);
            }
            return;
        }
        if (value['type'] !== 'afterToolCallEvent')
            return;
        const agent = value['agent'];
        const toolUse = value['toolUse'];
        if (!this.isRecord(agent) || !this.isRecord(toolUse))
            return;
        const eventAgentId = agent['id'];
        const toolName = toolUse['name'];
        if (typeof eventAgentId !== 'string' || typeof toolName !== 'string')
            return;
        const result = value['result'];
        const status = this.isRecord(result) && typeof result['status'] === 'string'
            ? result['status']
            : undefined;
        const error = value['error'];
        collected.push({
            agentId: eventAgentId,
            toolName,
            ...(toolUse['input'] === undefined ? {} : { input: toolUse['input'] }),
            ...(status === undefined ? {} : { status }),
            ...(error === undefined ? {} : { error: error instanceof Error ? error.message : String(error) }),
        });
    }
    stopReason(result) {
        const candidate = result;
        return typeof candidate.stopReason === 'string' ? candidate.stopReason : undefined;
    }
    isRecord(value) {
        return typeof value === 'object' && value !== null;
    }
    resolveAgentTools(targetAgentId, references) {
        const tools = [];
        const referencedAgentIds = new Set();
        const toolNames = new Set();
        for (const [index, reference] of references.entries()) {
            const sourceAgentId = this.requireText(reference.agentId, `agentTools[${index}].agentId`);
            const toolName = this.requireText(reference.name, `agentTools[${index}].name`);
            if (sourceAgentId === targetAgentId) {
                throw new Error(`Strands runtime ${targetAgentId} cannot reference itself as an agent tool`);
            }
            if (toolNames.has(toolName)) {
                throw new Error(`Duplicate Strands agent tool name: ${toolName}`);
            }
            toolNames.add(toolName);
            const sourceRuntime = this.requireRuntime(sourceAgentId);
            const options = {
                name: toolName,
                ...(reference.description === undefined
                    ? {}
                    : { description: this.requireText(reference.description, `agentTools[${index}].description`) }),
            };
            tools.push(sourceRuntime.createAgentTool(options));
            referencedAgentIds.add(sourceAgentId);
        }
        return {
            tools,
            referencedAgentIds,
        };
    }
    withAgentTools(runtimeConfig, tools) {
        if (tools.length === 0) {
            return runtimeConfig;
        }
        return {
            ...runtimeConfig,
            agent: {
                ...runtimeConfig.agent,
                tools: [runtimeConfig.agent.tools ?? [], [...tools]],
            },
        };
    }
    liveDependentsOf(agentId) {
        const dependents = [];
        for (const [candidateId, references] of this.runtimeReferences.entries()) {
            if (this.runtimes.has(candidateId) && references.has(agentId)) {
                dependents.push(candidateId);
            }
        }
        return dependents.sort();
    }
    requireRuntime(agentId) {
        const safeAgentId = this.requireText(agentId, 'agentId');
        const runtime = this.runtimes.get(safeAgentId);
        if (runtime === undefined) {
            throw new Error(`Unknown Strands agent runtime: ${safeAgentId}`);
        }
        return runtime;
    }
    requireAgentId(runtimeConfig) {
        if (runtimeConfig === null || runtimeConfig === undefined) {
            throw new Error('runtimeConfig is required');
        }
        return this.requireText(runtimeConfig.agent.id, 'runtimeConfig.agent.id');
    }
    requireText(value, fieldName) {
        const safeValue = value.trim();
        if (safeValue.length === 0) {
            throw new Error(`${fieldName} must not be blank`);
        }
        return safeValue;
    }
}
//# sourceMappingURL=StrandsBridgeRuntimeService.js.map