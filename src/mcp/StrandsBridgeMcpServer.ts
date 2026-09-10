import { McpServer } from '@modelcontextprotocol/server'
import * as z from 'zod/v4'

import type { StrandsAgentRuntimeConfig } from '../agent/config/StrandsAgentRuntimeConfig.js'
import { StrandsBridgeRuntimeService } from './StrandsBridgeRuntimeService.js'

const runtimeConfigSchema = z.object({
  agent: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }).passthrough(),
  mcpServers: z.union([
    z.string().min(1),
    z.record(z.string(), z.unknown()),
  ]).optional(),
  mcpDefaults: z.record(z.string(), z.unknown()).optional(),
}).passthrough()

const invokeInputSchema = z.object({
  agentId: z.string().min(1),
  input: z.string(),
})

function runtimeConfig(value: unknown): StrandsAgentRuntimeConfig {
  return value as StrandsAgentRuntimeConfig
}

function errorResult(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)

  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  }
}

/** Builds the MCP projection over the shared Strands runtime lifecycle. */
export function createStrandsBridgeMcpServer(
  runtimeService: StrandsBridgeRuntimeService = new StrandsBridgeRuntimeService(),
): McpServer {
  const server = new McpServer({
    name: 'tavall-strands-runtime',
    version: '0.1.0',
  })

  server.registerTool(
    'strands_agent_create',
    {
      description: 'Create a sessionful Strands runtime. Product behavior and tools remain Java-owned.',
      inputSchema: z.object({ config: runtimeConfigSchema }),
    },
    async ({ config }) => {
      try {
        const safeConfig = runtimeConfig(config)
        await runtimeService.createAgent(safeConfig)
        const output = {
          agentId: safeConfig.agent.id,
          status: 'created',
        }

        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'strands_agent_invoke',
    {
      description: 'Invoke an existing Strands runtime and return its final native result as text.',
      inputSchema: invokeInputSchema,
    },
    async ({ agentId, input }) => {
      try {
        const output = await runtimeService.invokeAgent(agentId, input)
        return {
          content: [{ type: 'text', text: output.text }],
          structuredContent: { ...output },
        }
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'strands_agent_cancel',
    {
      description: 'Cooperatively cancel the active invocation for an existing Strands runtime.',
      inputSchema: z.object({ agentId: z.string().min(1) }),
    },
    async ({ agentId }) => {
      try {
        runtimeService.cancelAgent(agentId)
        const output = { agentId, status: 'cancelled' }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'strands_agent_close',
    {
      description: 'Close an existing Strands runtime and its Strands-owned MCP clients.',
      inputSchema: z.object({ agentId: z.string().min(1) }),
    },
    async ({ agentId }) => {
      try {
        await runtimeService.closeAgent(agentId)
        const output = { agentId, status: 'closed' }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  server.registerTool(
    'strands_agent_invoke_once',
    {
      description: 'Create, invoke, and close one Strands runtime for a Java AIAgentProvider execution.',
      inputSchema: z.object({
        config: runtimeConfigSchema,
        input: z.string(),
      }),
    },
    async ({ config, input }) => {
      try {
        const output = await runtimeService.invokeOnce(runtimeConfig(config), input)
        return {
          content: [{ type: 'text', text: output.text }],
          structuredContent: { ...output },
        }
      } catch (error) {
        return errorResult(error)
      }
    },
  )

  return server
}
