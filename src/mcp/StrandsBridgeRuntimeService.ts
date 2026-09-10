import type { IStrandsAgentRuntimeBootstrap } from '../agent/bootstrap/IStrandsAgentRuntimeBootstrap.js'
import { StrandsAgentRuntimeBootstrap } from '../agent/bootstrap/StrandsAgentRuntimeBootstrap.js'
import type { StrandsAgentRuntimeConfig } from '../agent/config/StrandsAgentRuntimeConfig.js'
import type { IStrandsAgentRuntime } from '../agent/runtime/IStrandsAgentRuntime.js'

export interface StrandsBridgeInvocationResult {
  readonly agentId: string
  readonly text: string
}

/**
 * Owns the process-local Strands runtime handles exposed through MCP.
 * Product state and product capabilities remain Java-owned.
 */
export class StrandsBridgeRuntimeService {
  private readonly runtimeBootstrap: IStrandsAgentRuntimeBootstrap
  private readonly runtimes = new Map<string, IStrandsAgentRuntime>()

  public constructor(
    runtimeBootstrap: IStrandsAgentRuntimeBootstrap = new StrandsAgentRuntimeBootstrap(),
  ) {
    this.runtimeBootstrap = runtimeBootstrap
  }

  public async createAgent(runtimeConfig: StrandsAgentRuntimeConfig): Promise<void> {
    const agentId = this.requireAgentId(runtimeConfig)

    if (this.runtimes.has(agentId)) {
      throw new Error(`Strands agent runtime already exists: ${agentId}`)
    }

    const runtime = await this.runtimeBootstrap.createAgentRuntime(runtimeConfig)
    this.runtimes.set(agentId, runtime)
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

  public cancelAgent(agentId: string): void {
    this.requireRuntime(agentId).cancelInvocation()
  }

  public async closeAgent(agentId: string): Promise<void> {
    const runtime = this.requireRuntime(agentId)

    try {
      await runtime.close()
    } finally {
      this.runtimes.delete(agentId)
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
      }
    }

    if (failures.length > 0) {
      throw new AggregateError(
        failures,
        'One or more Strands runtimes failed to close.',
      )
    }
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
