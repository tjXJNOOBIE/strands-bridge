import type { Agent, AgentConfig, McpClient, McpClientOptions, McpServerConfig } from '@strands-agents/sdk';
export interface IStrandsRuntimePlatform {
    createAgent(agentConfig: AgentConfig): Agent;
    loadMcpClients(mcpServers: string | Record<string, McpServerConfig>, mcpDefaults?: McpClientOptions): Promise<McpClient[]>;
}
//# sourceMappingURL=IStrandsRuntimePlatform.d.ts.map