import assert from 'node:assert/strict'
import test from 'node:test'

import type { AgentResult } from '@strands-agents/sdk'

import type { IStrandsAgentRuntimeBootstrap } from '../../src/agent/bootstrap/IStrandsAgentRuntimeBootstrap.js'
import type { StrandsAgentRuntimeConfig } from '../../src/agent/config/StrandsAgentRuntimeConfig.js'
import type { IStrandsAgentRuntime } from '../../src/agent/runtime/IStrandsAgentRuntime.js'
import { StrandsBridgeRuntimeService } from '../../src/mcp/StrandsBridgeRuntimeService.js'

function runtimeReturning(text: string, closeCalls: { count: number }): IStrandsAgentRuntime {
  return {
    invokeAgent: async () => ({ toString: () => text }) as unknown as AgentResult,
    cancelInvocation: () => undefined,
    close: async () => {
      closeCalls.count += 1
    },
  } as unknown as IStrandsAgentRuntime
}

function bootstrapReturning(runtimes: IStrandsAgentRuntime[]): IStrandsAgentRuntimeBootstrap {
  let index = 0

  return {
    createAgentRuntime: async () => {
      const runtime = runtimes[index]
      index += 1
      if (runtime === undefined) {
        throw new Error('No fake runtime configured')
      }
      return runtime
    },
  }
}

function config(id: string): StrandsAgentRuntimeConfig {
  return {
    agent: {
      id,
      name: id,
      systemPrompt: 'test prompt',
      printer: false,
    },
  }
}

test('sessionful runtime remains available until Java closes it', async () => {
  const closeCalls = { count: 0 }
  const runtime = runtimeReturning('session result', closeCalls)
  const service = new StrandsBridgeRuntimeService(bootstrapReturning([runtime]))

  await service.createAgent(config('community-agent'))
  const result = await service.invokeAgent('community-agent', 'operate community')

  assert.equal(result.agentId, 'community-agent')
  assert.equal(result.text, 'session result')
  assert.equal(closeCalls.count, 0)

  await service.closeAgent('community-agent')
  assert.equal(closeCalls.count, 1)
  await assert.rejects(
    service.invokeAgent('community-agent', 'should fail'),
    /Unknown Strands agent runtime/,
  )
})

test('invokeOnce always closes the Strands runtime', async () => {
  const closeCalls = { count: 0 }
  const runtime = runtimeReturning('one shot result', closeCalls)
  const service = new StrandsBridgeRuntimeService(bootstrapReturning([runtime]))

  const result = await service.invokeOnce(config('recovery-agent'), 'recover target')

  assert.equal(result.text, 'one shot result')
  assert.equal(closeCalls.count, 1)
})

test('duplicate sessionful agent ids are rejected instead of replacing live runtimes', async () => {
  const firstCloseCalls = { count: 0 }
  const secondCloseCalls = { count: 0 }
  const service = new StrandsBridgeRuntimeService(bootstrapReturning([
    runtimeReturning('first', firstCloseCalls),
    runtimeReturning('second', secondCloseCalls),
  ]))

  await service.createAgent(config('life-agent'))
  await assert.rejects(
    service.createAgent(config('life-agent')),
    /already exists/,
  )

  assert.equal(firstCloseCalls.count, 0)
  assert.equal(secondCloseCalls.count, 0)
  await service.closeAll()
  assert.equal(firstCloseCalls.count, 1)
})
