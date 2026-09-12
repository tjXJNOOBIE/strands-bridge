import { Model, type BaseModelConfig, type CountTokensOptions, type Message, type ModelStreamEvent, type StreamOptions } from '@strands-agents/sdk';
export interface CodexCliModelConfig extends BaseModelConfig {
    readonly command?: string;
    readonly workingDirectory?: string;
    readonly timeoutMs?: number;
}
/**
 * Model provider backed by the locally authenticated Codex CLI subscription.
 *
 * Codex is intentionally used only as a model process. The parent Strands
 * runtime retains ownership of tools, MCP clients, policy, and side effects.
 * The child runs with the read-only sandbox and is told not to use its own
 * shell/browser/file tools. Tool requests are returned to Strands as native
 * tool-use events and are executed by the normal Strands loop.
 */
export declare class CodexCliModel extends Model<CodexCliModelConfig> {
    private config;
    constructor(config?: CodexCliModelConfig);
    updateConfig(modelConfig: CodexCliModelConfig): void;
    getConfig(): CodexCliModelConfig;
    stream(messages: Message[], options?: StreamOptions): AsyncIterable<ModelStreamEvent>;
    countTokens(messages: Message[], _options?: CountTokensOptions): Promise<number>;
    private buildPrompt;
    private systemPromptData;
    private invoke;
    private parseOutput;
    private parseInvocation;
    private content;
    private toolCall;
    private extractJson;
    private parseInput;
    private isRecord;
    private positiveEnvironment;
    private nonnegativeEnvironment;
    private reasoningEffort;
}
//# sourceMappingURL=CodexCliModel.d.ts.map