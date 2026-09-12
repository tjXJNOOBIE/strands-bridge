import type { AgentAsToolOptions, AgentResult, InvokeOptions, Tool } from '@strands-agents/sdk'

import type { IStrandsAgentRuntimeBootstrap } from '../agent/bootstrap/IStrandsAgentRuntimeBootstrap.js'
import { StrandsAgentRuntimeBootstrap } from '../agent/bootstrap/StrandsAgentRuntimeBootstrap.js'
import type { StrandsAgentRuntimeConfig } from '../agent/config/StrandsAgentRuntimeConfig.js'
import type { IStrandsAgentRuntime } from '../agent/runtime/IStrandsAgentRuntime.js'

export interface StrandsBridgeInvocationResult {
  readonly agentId: string
  readonly text: string
}

export interface StrandsBridgeObservedToolEvent {
  readonly agentId: string
  readonly toolName: string
  readonly input?: unknown
  readonly status?: string
  readonly error?: string
}

export interface StrandsBridgeObservedInvocationResult extends StrandsBridgeInvocationResult {
  readonly stopReason?: string
  readonly toolEvents: readonly StrandsBridgeObservedToolEvent[]
}

export interface StrandsBridgeInvocationLimits {
  readonly turns?: number
  readonly outputTokens?: number
  readonly totalTokens?: number
}

export interface StrandsAgentToolReference {
  readonly agentId: string
  readonly name: string
  readonly description?: string
}

/**
 * Owns the process-local Strands runtime handles exposed through MCP.
 * Product state and product capabilities remain Java-owned.
 */
export class StrandsBridgeRuntimeService {
  private readonly runtimeBootstrap: IStrandsAgentRuntimeBootstrap
  private readonly runtimes = new Map<string, IStrandsAgentRuntime>()
  private readonly runtimeReferences = new Map<string, ReadonlySet<string>>()

  public constructor(
    runtimeBootstrap: IStrandsAgentRuntimeBootstrap = new StrandsAgentRuntimeBootstrap(),
  ) {
    this.runtimeBootstrap = runtimeBootstrap
  }

  public async createAgent(
    runtimeConfig: StrandsAgentRuntimeConfig,
    agentTools: readonly StrandsAgentToolReference[] = [],
  ): Promise<void> {
    const agentId = this.requireAgentId(runtimeConfig)

    if (this.runtimes.has(agentId)) {
      throw new Error(`Strands agent runtime already exists: ${agentId}`)
    }

    const resolved = this.resolveAgentTools(agentId, agentTools)
    const composedConfig = this.withAgentTools(runtimeConfig, resolved.tools)
    const runtime = await this.runtimeBootstrap.createAgentRuntime(composedConfig)
    this.runtimes.set(agentId, runtime)
    this.runtimeReferences.set(agentId, resolved.referencedAgentIds)
  }

  public async invokeAgent(
    agentId: string,
    input: string,
  ): Promise<StrandsBridgeInvocationResult> {
    const runtime = this.requireRuntime(agentId)
    const result = await runtime.invokeAgent(input)

    return {
      agentId,
      text: result.toString(),
    }
  }

  public async invokeAgentObserved(
    agentId: string,
    input: string,
    limits?: StrandsBridgeInvocationLimits,
  ): Promise<StrandsBridgeObservedInvocationResult> {
    const safeAgentId = this.requireText(agentId, 'agentId')
    const runtime = this.requireRuntime(safeAgentId)
    const toolEvents: StrandsBridgeObservedToolEvent[] = []
    const stream = runtime.streamAgent(input, this.invokeOptions(limits))

    while (true) {
      const next = await stream.next()
      if (next.done) {
        const result = next.value
        const stopReason = this.stopReason(result)
        return {
          agentId: safeAgentId,
          text: result.toString(),
          ...(stopReason === undefined ? {} : { stopReason }),
          toolEvents,
        }
      }
      this.collectToolEvents(next.value, toolEvents)
    }
  }

  public cancelAgent(agentId: string): void {
    this.requireRuntime(agentId).cancelInvocation()
  }

  public async closeAgent(agentId: string): Promise<void> {
    const safeAgentId = this.requireText(agentId, 'agentId')
    const runtime = this.requireRuntime(safeAgentId)
    const dependents = this.liveDependentsOf(safeAgentId)
    if (dependents.length > 0) {
      throw new Error(
        `Cannot close Strands agent runtime ${safeAgentId}; referenced by live runtime(s): ${dependents.join(', ')}`,
      )
    }

    try {
      await runtime.close()
    } finally {
      this.runtimes.delete(safeAgentId)
      this.runtimeReferences.delete(safeAgentId)
    }
  }

  public async invokeOnce(
    runtimeConfig: StrandsAgentRuntimeConfig,
    input: string,
  ): Promise<StrandsBridgeInvocationResult> {
    const agentId = this.requireAgentId(runtimeConfig)
    const runtime = await this.runtimeBootstrap.createAgentRuntime(runtimeConfig)

    try {
      const result = await runtime.invokeAgent(input)
      return {
        agentId,
        text: result.toString(),
      }
    } finally {
      await runtime.close()
    }
  }

  public async closeAll(): Promise<void> {
    const runtimes = Array.from(this.runtimes.entries())
    const failures: unknown[] = []

    for (const [agentId, runtime] of runtimes.reverse()) {
      try {
        await runtime.close()
      } catch (error) {
        failures.push(error)
      } finally {
        this.runtimes.delete(agentId)
        this.runtimeReferences.delete(agentId)
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        'One or more Strands runtimes failed to close.',
      )
    }
  }

  private invokeOptions(limits: StrandsBridgeInvocationLimits | undefined): InvokeOptions | undefined {
    if (limits === undefined) return undefined
    return {
      limits: {
        ...(limits.turns === undefined ? {} : { turns: limits.turns }),
        ...(limits.outputTokens === undefined ? {} : { outputTokens: limits.outputTokens }),
        ...(limits.totalTokens === undefined ? {} : { totalTokens: limits.totalTokens }),
      },
    }
  }

  private collectToolEvents(
    value: unknown,
    collected: StrandsBridgeObservedToolEvent[],
  ): void {
    if (!this.isRecord(value)) return
    if (value['type'] === 'toolStreamUpdateEvent') {
      const event = value['event']
      if (this.isRecord(event)) {
        this.collectToolEvents(event['data'], collected)
      }
      return
    }
    if (value['type'] !== 'afterToolCallEvent') return

    const agent = value['agent']
    const toolUse = value['toolUse']
    if (!this.isRecord(agent) || !this.isRecord(toolUse)) return
    const eventAgentId = agent['id']
    const toolName = toolUse['name']
    if (typeof eventAgentId !== 'string' || typeof toolName !== 'string') return

    const result = value['result']
    const status = this.isRecord(result) && typeof result['status'] === 'string'
      ? result['status']
      : undefined
    const error = value['error']
    collected.push({
      agentId: eventAgentId,
      toolName,
      ...(toolUse['input'] === undefined ? {} : { input: toolUse['input'] }),
      ...(status === undefined ? {} : { status }),
      ...(error === undefined ? {} : { error: error instanceof Error ? error.message : String(error) }),
    })
  }

  private stopReason(result: AgentResult): string | undefined {
    const candidate = result as AgentResult & { readonly stopReason?: unknown }
    return typeof candidate.stopReason === 'string' ? candidate.stopReason : undefined
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
  }

  private resolveAgentTools(
    targetAgentId: string,
    references: readonly StrandsAgentToolReference[],
  ): { readonly tools: readonly Tool[]; readonly referencedAgentIds: ReadonlySet<string> } {
    const tools: Tool[] = []
    const referencedAgentIds = new Set<string>()
    const toolNames = new Set<string>()

    for (const [index, reference] of references.entries()) {
      const sourceAgentId = this.requireText(reference.agentId, `agentTools[${index}].agentId`)
      const toolName = this.requireText(reference.name, `agentTools[${index}].name`)
      if (sourceAgentId === targetAgentId) {
        throw new Error(`Strands runtime ${targetAgentId} cannot reference itself as an agent tool`)
      }
      if (toolNames.has(toolName)) {
        throw new Error(`Duplicate Strands agent tool name: ${toolName}`)
      }
      toolNames.add(toolName)

      const sourceRuntime = this.requireRuntime(sourceAgentId)
      const options: AgentAsToolOptions = {
        name: toolName,
        ...(reference.description === undefined
          ? {}
          : { description: this.requireText(reference.description, `agentTools[${index}].description`) }),
      }
      tools.push(sourceRuntime.createAgentTool(options))
      referencedAgentIds.add(sourceAgentId)
    }

    return {
      tools,
      referencedAgentIds,
    }
  }

  private withAgentTools(
    runtimeConfig: StrandsAgentRuntimeConfig,
    tools: readonly Tool[],
  ): StrandsAgentRuntimeConfig {
    if (tools.length === 0) {
      return runtimeConfig
    }

    return {
      ...runtimeConfig,
      agent: {
        ...runtimeConfig.agent,
        tools: [runtimeConfig.agent.tools ?? [], [...tools]],
      },
    }
  }

  private liveDependentsOf(agentId: string): string[] {
    const dependents: string[] = []
    for (const [candidateId, references] of this.runtimeReferences.entries()) {
      if (this.runtimes.has(candidateId) && references.has(agentId)) {
        dependents.push(candidateId)
      }
    }
    return dependents.sort()
  }

  private requireRuntime(agentId: string): IStrandsAgentRuntime {
    const safeAgentId = this.requireText(agentId, 'agentId')
    const runtime = this.runtimes.get(safeAgentId)

    if (runtime === undefined) {
      throw new Error(`Unknown Strands agent runtime: ${safeAgentId}`)
    }

    return runtime
  }

  private requireAgentId(runtimeConfig: StrandsAgentRuntimeConfig): string {
    if (runtimeConfig === null || runtimeConfig === undefined) {
      throw new Error('runtimeConfig is required')
    }

    return this.requireText(runtimeConfig.agent.id, 'runtimeConfig.agent.id')
  }

  private requireText(value: string, fieldName: string): string {
    const safeValue = value.trim()

    if (safeValue.length === 0) {
      throw new Error(`${fieldName} must not be blank`)
    }

    return safeValue
  }
}
