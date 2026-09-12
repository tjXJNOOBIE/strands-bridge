import { StrandsAgentRuntimeClosedError } from '../error/StrandsAgentRuntimeClosedError.js';
export class StrandsAgentRuntime {
    agent;
    mcpClients;
    closed = false;
    closeOperation;
    constructor(agent, mcpClients) {
        this.agent = agent;
        this.mcpClients = [...mcpClients];
    }
    async invokeAgent(invokeArgs, invokeOptions) {
        this.requireOpenRuntime();
        const agentResult = await this.agent.invoke(invokeArgs, invokeOptions);
        return agentResult;
    }
    async *streamAgent(invokeArgs, invokeOptions) {
        this.requireOpenRuntime();
        const agentStream = this.agent.stream(invokeArgs, invokeOptions);
        return yield* agentStream;
    }
    cancelInvocation() {
        if (this.closed) {
            return;
        }
        this.agent.cancel();
    }
    createAgentTool(agentAsToolOptions) {
        this.requireOpenRuntime();
        const agentTool = this.agent.asTool(agentAsToolOptions);
        return agentTool;
    }
    isClosed() {
        return this.closed;
    }
    async close() {
        this.closed = true;
        if (this.closeOperation !== undefined) {
            return this.closeOperation;
        }
        const closeOperation = this.closeRuntimeResources();
        this.closeOperation = closeOperation;
        try {
            await closeOperation;
        }
        finally {
            this.closeOperation = undefined;
        }
    }
    async closeRuntimeResources() {
        if (this.agent.isInvoking) {
            this.agent.cancel();
        }
        const cleanupErrors = [];
        for (let index = this.mcpClients.length - 1; index >= 0; index -= 1) {
            const mcpClient = this.mcpClients[index];
            if (mcpClient === undefined || mcpClient.connectionState === 'disconnected') {
                continue;
            }
            try {
                await mcpClient.disconnect();
            }
            catch (error) {
                cleanupErrors.push(error);
            }
        }
        if (cleanupErrors.length > 0) {
            throw new AggregateError(cleanupErrors, 'One or more Strands MCP clients failed to disconnect cleanly.');
        }
    }
    requireOpenRuntime() {
        if (this.closed) {
            throw new StrandsAgentRuntimeClosedError();
        }
    }
}
//# sourceMappingURL=StrandsAgentRuntime.js.map