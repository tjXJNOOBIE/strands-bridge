import type { StrandsAgentRuntimeConfig } from '../config/StrandsAgentRuntimeConfig.js';
import type { IStrandsAgentRuntimeBootstrap } from './IStrandsAgentRuntimeBootstrap.js';
import type { IStrandsAgentRuntime } from '../runtime/IStrandsAgentRuntime.js';
import type { IStrandsRuntimePlatform } from '../../strands/platform/IStrandsRuntimePlatform.js';
export declare class StrandsAgentRuntimeBootstrap implements IStrandsAgentRuntimeBootstrap {
    private readonly strandsRuntimePlatform;
    constructor(strandsRuntimePlatform?: IStrandsRuntimePlatform);
    createAgentRuntime(runtimeConfig: StrandsAgentRuntimeConfig): Promise<IStrandsAgentRuntime>;
    private validateRuntimeConfig;
    private loadMcpClients;
    private buildAgentConfig;
    private cleanupFailedStartup;
}
//# sourceMappingURL=StrandsAgentRuntimeBootstrap.d.ts.map