import type { IStrandsAgentRuntimeBootstrap } from '../agent/bootstrap/IStrandsAgentRuntimeBootstrap.js';
import type { StrandsAgentRuntimeConfig } from '../agent/config/StrandsAgentRuntimeConfig.js';
export interface StrandsBridgeInvocationResult {
    readonly agentId: string;
    readonly text: string;
}
export interface StrandsBridgeObservedToolEvent {
    readonly agentId: string;
    readonly toolName: string;
    readonly input?: unknown;
    readonly status?: string;
    readonly error?: string;
}
export interface StrandsBridgeObservedInvocationResult extends StrandsBridgeInvocationResult {
    readonly stopReason?: string;
    readonly toolEvents: readonly StrandsBridgeObservedToolEvent[];
}
export interface StrandsBridgeInvocationLimits {
    readonly turns?: number;
    readonly outputTokens?: number;
    readonly totalTokens?: number;
}
export interface StrandsAgentToolReference {
    readonly agentId: string;
    readonly name: string;
    readonly description?: string;
}
/**
 * Owns the process-local Strands runtime handles exposed through MCP.
 * Product state and product capabilities remain Java-owned.
 */
export declare class StrandsBridgeRuntimeService {
    private readonly runtimeBootstrap;
    private readonly runtimes;
    private readonly runtimeReferences;
    constructor(runtimeBootstrap?: IStrandsAgentRuntimeBootstrap);
    createAgent(runtimeConfig: StrandsAgentRuntimeConfig, agentTools?: readonly StrandsAgentToolReference[]): Promise<void>;
    invokeAgent(agentId: string, input: string): Promise<StrandsBridgeInvocationResult>;
    invokeAgentObserved(agentId: string, input: string, limits?: StrandsBridgeInvocationLimits): Promise<StrandsBridgeObservedInvocationResult>;
    cancelAgent(agentId: string): void;
    closeAgent(agentId: string): Promise<void>;
    invokeOnce(runtimeConfig: StrandsAgentRuntimeConfig, input: string): Promise<StrandsBridgeInvocationResult>;
    closeAll(): Promise<void>;
    private invokeOptions;
    private collectToolEvents;
    private stopReason;
    private isRecord;
    private resolveAgentTools;
    private withAgentTools;
    private liveDependentsOf;
    private requireRuntime;
    private requireAgentId;
    private requireText;
}
//# sourceMappingURL=StrandsBridgeRuntimeService.d.ts.map