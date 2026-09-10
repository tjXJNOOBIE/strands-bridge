import type {
  Agent,
  AgentAsToolOptions,
  AgentResult,
  AgentStreamEvent,
  InvokeArgs,
  InvokeOptions,
  McpClient,
  Tool,
} from '@strands-agents/sdk'

import { StrandsAgentRuntimeClosedError } from '../error/StrandsAgentRuntimeClosedError.js'
import type { IStrandsAgentRuntime } from './IStrandsAgentRuntime.js'

export class StrandsAgentRuntime implements IStrandsAgentRuntime {
  private readonly agent: Agent
  private readonly mcpClients: McpClient[]
  private closed = false
  private closeOperation: Promise<void> | undefined

  public constructor(agent: Agent, mcpClients: McpClient[]) {
    this.agent = agent
    this.mcpClients = [...mcpClients]
  }

  public async invokeAgent(
    invokeArgs: InvokeArgs,
    invokeOptions?: InvokeOptions,
  ): Promise<AgentResult> {
    this.requireOpenRuntime()

    const agentResult = await this.agent.invoke(
      invokeArgs,
      invokeOptions,
    )

    return agentResult
  }

  public async *streamAgent(
    invokeArgs: InvokeArgs,
    invokeOptions?: InvokeOptions,
  ): AsyncGenerator<AgentStreamEvent, AgentResult, undefined> {
    this.requireOpenRuntime()

    const agentStream = this.agent.stream(
      invokeArgs,
      invokeOptions,
    )

    return yield* agentStream
  }

  public cancelInvocation(): void {
    if (this.closed) {
      return
    }

    this.agent.cancel()
  }

  public createAgentTool(agentAsToolOptions?: AgentAsToolOptions): Tool {
    this.requireOpenRuntime()

    const agentTool = this.agent.asTool(agentAsToolOptions)

    return agentTool
  }

  public isClosed(): boolean {
    return this.closed
  }

  public async close(): Promise<void> {
    this.closed = true

    if (this.closeOperation !== undefined) {
      return this.closeOperation
    }

    const closeOperation = this.closeRuntimeResources()
    this.closeOperation = closeOperation

    try {
      await closeOperation
    } finally {
      this.closeOperation = undefined
    }
  }

  private async closeRuntimeResources(): Promise<void> {
    if (this.agent.isInvoking) {
      this.agent.cancel()
    }

    const cleanupErrors: unknown[] = []

    for (let index = this.mcpClients.length - 1; index >= 0; index -= 1) {
      const mcpClient = this.mcpClients[index]

      if (mcpClient === undefined || mcpClient.connectionState === 'disconnected') {
        continue
      }

      try {
        await mcpClient.disconnect()
      } catch (error) {
        cleanupErrors.push(error)
      }
    }

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        cleanupErrors,
        'One or more Strands MCP clients failed to disconnect cleanly.',
      )
    }
  }

  private requireOpenRuntime(): void {
    if (this.closed) {
      throw new StrandsAgentRuntimeClosedError()
    }
  }
}
