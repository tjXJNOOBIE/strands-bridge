import {
  Agent,
  McpClient,
  type AgentConfig,
  type McpClientOptions,
  type McpServerConfig,
} from '@strands-agents/sdk'

import type { IStrandsRuntimePlatform } from './IStrandsRuntimePlatform.js'
import {CodexCliModel} from '../../model/CodexCliModel.js'

export class StrandsRuntimePlatform implements IStrandsRuntimePlatform {
  public createAgent(agentConfig: AgentConfig): Agent {
    const model = agentConfig.model
    const resolvedAgentConfig: AgentConfig = model === 'codex-cli'
      ? {...agentConfig, model: new CodexCliModel()}
      : agentConfig
    const agent = new Agent(resolvedAgentConfig)

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
