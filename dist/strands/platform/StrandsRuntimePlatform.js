import { Agent, McpClient, } from '@strands-agents/sdk';
import { CodexCliModel } from '../../model/CodexCliModel.js';
export class StrandsRuntimePlatform {
    createAgent(agentConfig) {
        const model = agentConfig.model;
        const resolvedAgentConfig = model === 'codex-cli'
            ? { ...agentConfig, model: new CodexCliModel() }
            : agentConfig;
        const agent = new Agent(resolvedAgentConfig);
        return agent;
    }
    async loadMcpClients(mcpServers, mcpDefaults) {
        const mcpClients = await McpClient.loadServers(mcpServers, mcpDefaults);
        return mcpClients;
    }
}
//# sourceMappingURL=StrandsRuntimePlatform.js.map