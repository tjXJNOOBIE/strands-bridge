import type { StrandsAgentRuntimeConfig } from '../config/StrandsAgentRuntimeConfig.js'
import type { IStrandsAgentRuntime } from '../runtime/IStrandsAgentRuntime.js'

export interface IStrandsAgentRuntimeBootstrap {
  createAgentRuntime(
    runtimeConfig: StrandsAgentRuntimeConfig,
  ): Promise<IStrandsAgentRuntime>
}
