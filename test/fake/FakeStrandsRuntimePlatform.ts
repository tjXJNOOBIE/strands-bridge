import type {
  Agent,
  AgentConfig,
  McpClient,
  McpClientOptions,
  McpServerConfig,
} from '@strands-agents/sdk'

import type { IStrandsRuntimePlatform } from '../../src/strands/platform/IStrandsRuntimePlatform.js'

export class FakeStrandsRuntimePlatform implements IStrandsRuntimePlatform {
  public createAgentCalls = 0
  public loadMcpClientCalls = 0
  public createdAgentConfig: AgentConfig | undefined
  public loadedMcpServers: string | Record<string, McpServerConfig> | undefined
  public loadedMcpDefaults: McpClientOptions | undefined
  public agent: Agent
  public mcpClients: McpClient[] = []
  public loadMcpClientsError: unknown | undefined

  public constructor(agent: Agent) {
    this.agent = agent
  }

  public createAgent(agentConfig: AgentConfig): Agent {
    this.createAgentCalls += 1
    this.createdAgentConfig = agentConfig

    return this.agent
  }

  public async loadMcpClients(
    mcpServers: string | Record<string, McpServerConfig>,
    mcpDefaults?: McpClientOptions,
  ): Promise<McpClient[]> {
    this.loadMcpClientCalls += 1
    this.loadedMcpServers = mcpServers
    this.loadedMcpDefaults = mcpDefaults

    if (this.loadMcpClientsError !== undefined) {
      throw this.loadMcpClientsError
    }

    return this.mcpClients
  }
}
