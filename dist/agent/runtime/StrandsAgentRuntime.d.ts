import type { Agent, AgentAsToolOptions, AgentResult, AgentStreamEvent, InvokeArgs, InvokeOptions, McpClient, Tool } from '@strands-agents/sdk';
import type { IStrandsAgentRuntime } from './IStrandsAgentRuntime.js';
export declare class StrandsAgentRuntime implements IStrandsAgentRuntime {
    private readonly agent;
    private readonly mcpClients;
    private closed;
    private closeOperation;
    constructor(agent: Agent, mcpClients: McpClient[]);
    invokeAgent(invokeArgs: InvokeArgs, invokeOptions?: InvokeOptions): Promise<AgentResult>;
    streamAgent(invokeArgs: InvokeArgs, invokeOptions?: InvokeOptions): AsyncGenerator<AgentStreamEvent, AgentResult, undefined>;
    cancelInvocation(): void;
    createAgentTool(agentAsToolOptions?: AgentAsToolOptions): Tool;
    isClosed(): boolean;
    close(): Promise<void>;
    private closeRuntimeResources;
    private requireOpenRuntime;
}
//# sourceMappingURL=StrandsAgentRuntime.d.ts.map