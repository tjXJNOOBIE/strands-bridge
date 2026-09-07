import type {
  AgentConfig,
  McpClient,
  ToolList,
} from '@strands-agents/sdk'

import type { StrandsAgentRuntimeConfig } from '../config/StrandsAgentRuntimeConfig.js'
import type { IStrandsAgentRuntimeBootstrap } from './IStrandsAgentRuntimeBootstrap.js'
import { StrandsAgentRuntimeConfigError } from '../error/StrandsAgentRuntimeConfigError.js'
import type { IStrandsAgentRuntime } from '../runtime/IStrandsAgentRuntime.js'
import { StrandsAgentRuntime } from '../runtime/StrandsAgentRuntime.js'
import type { IStrandsRuntimePlatform } from '../../strands/platform/IStrandsRuntimePlatform.js'
import { StrandsRuntimePlatform } from '../../strands/platform/StrandsRuntimePlatform.js'

export class StrandsAgentRuntimeBootstrap implements IStrandsAgentRuntimeBootstrap {
  private readonly strandsRuntimePlatform: IStrandsRuntimePlatform

  public constructor(
    strandsRuntimePlatform: IStrandsRuntimePlatform = new StrandsRuntimePlatform(),
  ) {
    this.strandsRuntimePlatform = strandsRuntimePlatform
  }

  public async createAgentRuntime(
    runtimeConfig: StrandsAgentRuntimeConfig,
  ): Promise<IStrandsAgentRuntime> {
    this.validateRuntimeConfig(runtimeConfig)

    const mcpClients = await this.loadMcpClients(runtimeConfig)

    try {
      const agentConfig = this.buildAgentConfig(
        runtimeConfig,
        mcpClients,
      )
      const agent = this.strandsRuntimePlatform.createAgent(agentConfig)

      await agent.initialize()

      const agentRuntime = new StrandsAgentRuntime(
        agent,
        mcpClients,
      )

      return agentRuntime
    } catch (startupError) {
      await this.cleanupFailedStartup(
        mcpClients,
        startupError,
      )

      throw startupError
    }
  }

  private validateRuntimeConfig(runtimeConfig: StrandsAgentRuntimeConfig): void {
    const agentId = runtimeConfig.agent.id.trim()
    const agentName = runtimeConfig.agent.name.trim()

    if (agentId.length === 0) {
      throw new StrandsAgentRuntimeConfigError(
        'Strands agent configuration requires a non-blank id.',
      )
    }

    if (agentName.length === 0) {
      throw new StrandsAgentRuntimeConfigError(
        'Strands agent configuration requires a non-blank name.',
      )
    }
  }

  private async loadMcpClients(
    runtimeConfig: StrandsAgentRuntimeConfig,
  ): Promise<McpClient[]> {
    const mcpServers = runtimeConfig.mcpServers

    if (mcpServers === undefined) {
      return []
    }

    const mcpClients = await this.strandsRuntimePlatform.loadMcpClients(
      mcpServers,
      runtimeConfig.mcpDefaults,
    )

    return mcpClients
  }

  private buildAgentConfig(
    runtimeConfig: StrandsAgentRuntimeConfig,
    mcpClients: McpClient[],
  ): AgentConfig {
    const configuredTools = runtimeConfig.agent.tools
    const tools: ToolList = [
      configuredTools ?? [],
      mcpClients,
    ]

    const agentConfig: AgentConfig = {
      ...runtimeConfig.agent,
      tools,
    }

    return agentConfig
  }

  private async cleanupFailedStartup(
    mcpClients: McpClient[],
    startupError: unknown,
  ): Promise<void> {
    const cleanupErrors: unknown[] = []

    for (let index = mcpClients.length - 1; index >= 0; index -= 1) {
      const mcpClient = mcpClients[index]

      if (mcpClient === undefined || mcpClient.connectionState === 'disconnected') {
        continue
      }

      try {
        await mcpClient.disconnect()
      } catch (cleanupError) {
        cleanupErrors.push(cleanupError)
      }
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [startupError, ...cleanupErrors],
        'Strands agent startup failed and one or more MCP clients also failed cleanup.',
      )
    }
  }
}
