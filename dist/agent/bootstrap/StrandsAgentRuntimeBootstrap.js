import { StrandsAgentRuntimeConfigError } from '../error/StrandsAgentRuntimeConfigError.js';
import { StrandsAgentRuntime } from '../runtime/StrandsAgentRuntime.js';
import { StrandsRuntimePlatform } from '../../strands/platform/StrandsRuntimePlatform.js';
export class StrandsAgentRuntimeBootstrap {
    strandsRuntimePlatform;
    constructor(strandsRuntimePlatform = new StrandsRuntimePlatform()) {
        this.strandsRuntimePlatform = strandsRuntimePlatform;
    }
    async createAgentRuntime(runtimeConfig) {
        this.validateRuntimeConfig(runtimeConfig);
        const mcpClients = await this.loadMcpClients(runtimeConfig);
        try {
            const agentConfig = this.buildAgentConfig(runtimeConfig, mcpClients);
            const agent = this.strandsRuntimePlatform.createAgent(agentConfig);
            await agent.initialize();
            const agentRuntime = new StrandsAgentRuntime(agent, mcpClients);
            return agentRuntime;
        }
        catch (startupError) {
            await this.cleanupFailedStartup(mcpClients, startupError);
            throw startupError;
        }
    }
    validateRuntimeConfig(runtimeConfig) {
        const agentId = runtimeConfig.agent.id.trim();
        const agentName = runtimeConfig.agent.name.trim();
        if (agentId.length === 0) {
            throw new StrandsAgentRuntimeConfigError('Strands agent configuration requires a non-blank id.');
        }
        if (agentName.length === 0) {
            throw new StrandsAgentRuntimeConfigError('Strands agent configuration requires a non-blank name.');
        }
    }
    async loadMcpClients(runtimeConfig) {
        const mcpServers = runtimeConfig.mcpServers;
        if (mcpServers === undefined) {
            return [];
        }
        const mcpClients = await this.strandsRuntimePlatform.loadMcpClients(mcpServers, runtimeConfig.mcpDefaults);
        return mcpClients;
    }
    buildAgentConfig(runtimeConfig, mcpClients) {
        const configuredTools = runtimeConfig.agent.tools;
        const tools = [
            configuredTools ?? [],
            mcpClients,
        ];
        const agentConfig = {
            ...runtimeConfig.agent,
            tools,
        };
        return agentConfig;
    }
    async cleanupFailedStartup(mcpClients, startupError) {
        const cleanupErrors = [];
        for (let index = mcpClients.length - 1; index >= 0; index -= 1) {
            const mcpClient = mcpClients[index];
            if (mcpClient === undefined || mcpClient.connectionState === 'disconnected') {
                continue;
            }
            try {
                await mcpClient.disconnect();
            }
            catch (cleanupError) {
                cleanupErrors.push(cleanupError);
            }
        }
        if (cleanupErrors.length > 0) {
            throw new AggregateError([startupError, ...cleanupErrors], 'Strands agent startup failed and one or more MCP clients also failed cleanup.');
        }
    }
}
//# sourceMappingURL=StrandsAgentRuntimeBootstrap.js.map