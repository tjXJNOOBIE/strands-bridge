import type {
  Agent,
  AgentAsToolOptions,
  AgentResult,
  AgentStreamEvent,
  InvokeArgs,
  InvokeOptions,
  Tool,
} from '@strands-agents/sdk'

export class FakeAgent {
  public initializeCalls = 0
  public cancelCalls = 0
  public invokeCalls = 0
  public streamCalls = 0
  public agentToolCalls = 0
  public isInvoking = false
  public initializeError: unknown | undefined
  public invokeResult: AgentResult
  public streamResult: AgentResult
  public streamEvents: AgentStreamEvent[] = []
  public agentTool: Tool

  public constructor(
    invokeResult: AgentResult,
    agentTool: Tool,
  ) {
    this.invokeResult = invokeResult
    this.streamResult = invokeResult
    this.agentTool = agentTool
  }

  public async initialize(): Promise<void> {
    this.initializeCalls += 1

    if (this.initializeError !== undefined) {
      throw this.initializeError
    }
  }

  public async invoke(
    _invokeArgs: InvokeArgs,
    _invokeOptions?: InvokeOptions,
  ): Promise<AgentResult> {
    this.invokeCalls += 1

    return this.invokeResult
  }

  public async *stream(
    _invokeArgs: InvokeArgs,
    _invokeOptions?: InvokeOptions,
  ): AsyncGenerator<AgentStreamEvent, AgentResult, undefined> {
    this.streamCalls += 1

    for (const streamEvent of this.streamEvents) {
      yield streamEvent
    }

    return this.streamResult
  }

  public cancel(): void {
    this.cancelCalls += 1
  }

  public asTool(_agentAsToolOptions?: AgentAsToolOptions): Tool {
    this.agentToolCalls += 1

    return this.agentTool
  }

  public asStrandsAgent(): Agent {
    return this as unknown as Agent
  }
}
