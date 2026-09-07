import {
  Agent,
  McpClient,
  type AgentConfig,
  type McpClientOptions,
  type McpServerConfig,
} from '@strands-agents/sdk'

import type { IStrandsRuntimePlatform } from './IStrandsRuntimePlatform.js'

export class StrandsRuntimePlatform implements IStrandsRuntimePlatform {
  public createAgent(agentConfig: AgentConfig): Agent {
    const agent = new Agent(agentConfig)

    return agent
  }

  public async loadMcpClients(
    mcpServers: string | Record<string, McpServerConfig>,
    mcpDefaults?: McpClientOptions,
  ): Promise<McpClient[]> {
    const mcpClients = await McpClient.loadServers(
      mcpServers,
      mcpDefaults,
    )

    return mcpClients
  }
}
