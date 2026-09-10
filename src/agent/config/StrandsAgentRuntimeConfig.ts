import type {
  AgentConfig,
  McpClientOptions,
  McpServerConfig,
} from '@strands-agents/sdk'

export type StrandsBridgeAgentConfig = Omit<AgentConfig, 'id' | 'name'> & {
  id: string
  name: string
}

export interface StrandsAgentRuntimeConfig {
  agent: StrandsBridgeAgentConfig
  mcpServers?: string | Record<string, McpServerConfig>
  mcpDefaults?: McpClientOptions
}
