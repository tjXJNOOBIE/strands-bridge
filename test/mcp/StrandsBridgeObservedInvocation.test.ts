import assert from 'node:assert/strict'
import test from 'node:test'

import type { AgentResult, Tool } from '@strands-agents/sdk'

import type { IStrandsAgentRuntimeBootstrap } from '../../src/agent/bootstrap/IStrandsAgentRuntimeBootstrap.js'
import type { IStrandsAgentRuntime } from '../../src/agent/runtime/IStrandsAgentRuntime.js'
import { StrandsBridgeRuntimeService } from '../../src/mcp/StrandsBridgeRuntimeService.js'

function observedRuntime(): IStrandsAgentRuntime {
  return {
    invokeAgent: async () => ({ toString: () => 'unused' }) as unknown as AgentResult,
    streamAgent: async function* () {
      yield {
        type: 'afterToolCallEvent',
        agent: { id: 'web-design-agent-candidate-a' },
        toolUse: {
          name: 'browser_navigate',
          input: { url: 'https://example.com/' },
        },
        result: { status: 'success' },
      } as never
      yield {
        type: 'toolStreamUpdateEvent',
        event: {
          data: {
            type: 'afterToolCallEvent',
            agent: { id: 'web-design-agent-candidate-a' },
            toolUse: { name: 'browser_snapshot', input: {} },
            result: { status: 'success' },
          },
        },
      } as never
      yield {
        type: 'afterToolCallEvent',
        agent: { id: 'web-design-agent-candidate-b' },
        toolUse: { name: 'components_search', input: { query: 'pricing' } },
        result: { status: 'error' },
        error: new Error('provider failed'),
      } as never
      return {
        toString: () => '{"ok":true}',
        stopReason: 'endTurn',
      } as unknown as AgentResult
    },
    cancelInvocation: () => undefined,
    createAgentTool: () => ({ name: 'unused' }) as unknown as Tool,
    isClosed: () => false,
    close: async () => undefined,
  }
}

const bootstrap: IStrandsAgentRuntimeBootstrap = {
  createAgentRuntime: async () => observedRuntime(),
}

test('observed invocation returns normalized native tool events and stop reason', async () => {
  const service = new StrandsBridgeRuntimeService(bootstrap)
  await service.createAgent({
    agent: {
      id: 'director',
      name: 'Director',
      systemPrompt: 'test',
      printer: false,
    },
  })

  const result = await service.invokeAgentObserved('director', 'design', {
    turns: 16,
    outputTokens: 60_000,
    totalTokens: 200_000,
  })

  assert.equal(result.agentId, 'director')
  assert.equal(result.text, '{"ok":true}')
  assert.equal(result.stopReason, 'endTurn')
  assert.deepEqual(result.toolEvents, [
    {
      agentId: 'web-design-agent-candidate-a',
      toolName: 'browser_navigate',
      input: { url: 'https://example.com/' },
      status: 'success',
    },
    {
      agentId: 'web-design-agent-candidate-a',
      toolName: 'browser_snapshot',
      input: {},
      status: 'success',
    },
    {
      agentId: 'web-design-agent-candidate-b',
      toolName: 'components_search',
      input: { query: 'pricing' },
      status: 'error',
      error: 'provider failed',
    },
  ])

  await service.closeAll()
})
