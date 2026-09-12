import { McpServer } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import { StrandsBridgeRuntimeService, } from './StrandsBridgeRuntimeService.js';
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
}).passthrough();
const agentToolReferenceSchema = z.object({
    agentId: z.string().trim().min(1),
    name: z.string().trim().min(1),
    description: z.string().trim().min(1).optional(),
}).strict();
const invocationLimitsSchema = z.object({
    turns: z.number().int().positive().optional(),
    outputTokens: z.number().int().positive().optional(),
    totalTokens: z.number().int().positive().optional(),
}).strict();
const invokeInputSchema = z.object({
    agentId: z.string().min(1),
    input: z.string(),
});
function runtimeConfig(value) {
    return value;
}
function agentToolReferences(value) {
    return value;
}
function invocationLimits(value) {
    if (value === undefined)
        return undefined;
    return {
        ...(value.turns === undefined ? {} : { turns: value.turns }),
        ...(value.outputTokens === undefined ? {} : { outputTokens: value.outputTokens }),
        ...(value.totalTokens === undefined ? {} : { totalTokens: value.totalTokens }),
    };
}
function errorResult(error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
        content: [{ type: 'text', text: message }],
        isError: true,
    };
}
/** Builds the MCP projection over the shared Strands runtime lifecycle. */
export function createStrandsBridgeMcpServer(runtimeService = new StrandsBridgeRuntimeService()) {
    const server = new McpServer({
        name: 'tavall-strands-runtime',
        version: '0.1.0',
    });
    server.registerTool('strands_agent_create', {
        description: 'Create a sessionful Strands runtime. Existing Strands sessions may be attached as native agent-as-tool capabilities while product policy remains Java-owned.',
        inputSchema: z.object({
            config: runtimeConfigSchema,
            agentTools: z.array(agentToolReferenceSchema).optional(),
        }),
    }, async ({ config, agentTools }) => {
        try {
            const safeConfig = runtimeConfig(config);
            const safeAgentTools = agentTools === undefined ? [] : agentToolReferences(agentTools);
            await runtimeService.createAgent(safeConfig, safeAgentTools);
            const output = {
                agentId: safeConfig.agent.id,
                status: 'created',
                agentToolCount: safeAgentTools.length,
            };
            return {
                content: [{ type: 'text', text: JSON.stringify(output) }],
                structuredContent: output,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    server.registerTool('strands_agent_invoke', {
        description: 'Invoke an existing Strands runtime and return its final native result as text.',
        inputSchema: invokeInputSchema,
    }, async ({ agentId, input }) => {
        try {
            const output = await runtimeService.invokeAgent(agentId, input);
            return {
                content: [{ type: 'text', text: output.text }],
                structuredContent: { ...output },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    server.registerTool('strands_agent_invoke_observed', {
        description: 'Invoke an existing Strands runtime while returning normalized native tool lifecycle evidence and the final result. Product-specific trust decisions remain Java-owned.',
        inputSchema: z.object({
            agentId: z.string().min(1),
            input: z.string(),
            limits: invocationLimitsSchema.optional(),
        }),
    }, async ({ agentId, input, limits }) => {
        try {
            const output = await runtimeService.invokeAgentObserved(agentId, input, invocationLimits(limits));
            return {
                content: [{ type: 'text', text: output.text }],
                structuredContent: { ...output },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    server.registerTool('strands_agent_cancel', {
        description: 'Cooperatively cancel the active invocation for an existing Strands runtime.',
        inputSchema: z.object({ agentId: z.string().min(1) }),
    }, async ({ agentId }) => {
        try {
            runtimeService.cancelAgent(agentId);
            const output = { agentId, status: 'cancelled' };
            return {
                content: [{ type: 'text', text: JSON.stringify(output) }],
                structuredContent: output,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    server.registerTool('strands_agent_close', {
        description: 'Close an existing Strands runtime and its Strands-owned MCP clients. Referenced specialist sessions must remain live until their dependent composed runtime is closed.',
        inputSchema: z.object({ agentId: z.string().min(1) }),
    }, async ({ agentId }) => {
        try {
            await runtimeService.closeAgent(agentId);
            const output = { agentId, status: 'closed' };
            return {
                content: [{ type: 'text', text: JSON.stringify(output) }],
                structuredContent: output,
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    server.registerTool('strands_agent_invoke_once', {
        description: 'Create, invoke, and close one independent Strands runtime for a Java AIAgentProvider execution.',
        inputSchema: z.object({
            config: runtimeConfigSchema,
            input: z.string(),
        }),
    }, async ({ config, input }) => {
        try {
            const output = await runtimeService.invokeOnce(runtimeConfig(config), input);
            return {
                content: [{ type: 'text', text: output.text }],
                structuredContent: { ...output },
            };
        }
        catch (error) {
            return errorResult(error);
        }
    });
    return server;
}
//# sourceMappingURL=StrandsBridgeMcpServer.js.map