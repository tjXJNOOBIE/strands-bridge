import type {
  AgentAsToolOptions,
  AgentResult,
  AgentStreamEvent,
  InvokeArgs,
  InvokeOptions,
  Tool,
} from '@strands-agents/sdk'

export interface IStrandsAgentRuntime {
  invokeAgent(
    invokeArgs: InvokeArgs,
    invokeOptions?: InvokeOptions,
  ): Promise<AgentResult>

  streamAgent(
    invokeArgs: InvokeArgs,
    invokeOptions?: InvokeOptions,
  ): AsyncGenerator<AgentStreamEvent, AgentResult, undefined>

  cancelInvocation(): void

  createAgentTool(agentAsToolOptions?: AgentAsToolOptions): Tool

  isClosed(): boolean

  close(): Promise<void>
}
