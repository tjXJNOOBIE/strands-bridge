import { Agent, McpClient, type AgentConfig, type McpClientOptions, type McpServerConfig } from '@strands-agents/sdk';
import type { IStrandsRuntimePlatform } from './IStrandsRuntimePlatform.js';
export declare class StrandsRuntimePlatform implements IStrandsRuntimePlatform {
    createAgent(agentConfig: AgentConfig): Agent;
    loadMcpClients(mcpServers: string | Record<string, McpServerConfig>, mcpDefaults?: McpClientOptions): Promise<McpClient[]>;
}
//# sourceMappingURL=StrandsRuntimePlatform.d.ts.map