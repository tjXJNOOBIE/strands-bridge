import assert from 'node:assert/strict'
import test from 'node:test'

import type { AgentAsToolOptions, AgentResult, Tool } from '@strands-agents/sdk'

import type { IStrandsAgentRuntimeBootstrap } from '../../src/agent/bootstrap/IStrandsAgentRuntimeBootstrap.js'
import type { StrandsAgentRuntimeConfig } from '../../src/agent/config/StrandsAgentRuntimeConfig.js'
import type { IStrandsAgentRuntime } from '../../src/agent/runtime/IStrandsAgentRuntime.js'
import { StrandsBridgeRuntimeService } from '../../src/mcp/StrandsBridgeRuntimeService.js'

function runtimeReturning(
  text: string,
  closeCalls: { count: number },
  agentToolCalls: AgentAsToolOptions[] = [],
): IStrandsAgentRuntime {
  return {
    invokeAgent: async () => ({ toString: () => text }) as unknown as AgentResult,
    cancelInvocation: () => undefined,
    createAgentTool: (options?: AgentAsToolOptions) => {
      agentToolCalls.push(options ?? {})
      return { name: options?.name ?? 'agent-tool' } as unknown as Tool
    },
    close: async () => {
      closeCalls.count += 1
    },
  } as unknown as IStrandsAgentRuntime
}

function bootstrapReturning(
  runtimes: IStrandsAgentRuntime[],
  createdConfigs: StrandsAgentRuntimeConfig[] = [],
): IStrandsAgentRuntimeBootstrap {
  let index = 0

  return {
    createAgentRuntime: async (runtimeConfig) => {
      createdConfigs.push(runtimeConfig)
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

test('composed runtime receives native agent tools from existing specialist sessions', async () => {
  const candidateCloseCalls = { count: 0 }
  const directorCloseCalls = { count: 0 }
  const agentToolCalls: AgentAsToolOptions[] = []
  const createdConfigs: StrandsAgentRuntimeConfig[] = []
  const candidate = runtimeReturning('candidate', candidateCloseCalls, agentToolCalls)
  const director = runtimeReturning('director', directorCloseCalls)
  const service = new StrandsBridgeRuntimeService(
    bootstrapReturning([candidate, director], createdConfigs),
  )

  await service.createAgent(config('candidate-a'))
  await service.createAgent(config('director'), [
    {
      agentId: 'candidate-a',
      name: 'candidate_a',
      description: 'Build and refine candidate A.',
    },
  ])

  assert.deepEqual(agentToolCalls, [{
    name: 'candidate_a',
    description: 'Build and refine candidate A.',
  }])
  assert.equal(createdConfigs.length, 2)
  const directorTools = createdConfigs[1]?.agent.tools
  assert.ok(Array.isArray(directorTools))
  assert.equal(directorCloseCalls.count, 0)
  assert.equal(candidateCloseCalls.count, 0)

  await service.closeAgent('director')
  await service.closeAgent('candidate-a')
  assert.equal(directorCloseCalls.count, 1)
  assert.equal(candidateCloseCalls.count, 1)
})

test('specialist cannot close while a live composed runtime references it', async () => {
  const candidateCloseCalls = { count: 0 }
  const directorCloseCalls = { count: 0 }
  const service = new StrandsBridgeRuntimeService(bootstrapReturning([
    runtimeReturning('candidate', candidateCloseCalls),
    runtimeReturning('director', directorCloseCalls),
  ]))

  await service.createAgent(config('candidate-a'))
  await service.createAgent(config('director'), [{ agentId: 'candidate-a', name: 'candidate_a' }])

  await assert.rejects(
    service.closeAgent('candidate-a'),
    /referenced by live runtime\(s\): director/,
  )
  assert.equal(candidateCloseCalls.count, 0)

  await service.closeAgent('director')
  await service.closeAgent('candidate-a')
  assert.equal(directorCloseCalls.count, 1)
  assert.equal(candidateCloseCalls.count, 1)
})

test('unknown self and duplicate agent-tool references fail before target runtime creation', async () => {
  const candidateCloseCalls = { count: 0 }
  const directorCloseCalls = { count: 0 }
  const createdConfigs: StrandsAgentRuntimeConfig[] = []
  const service = new StrandsBridgeRuntimeService(bootstrapReturning([
    runtimeReturning('candidate', candidateCloseCalls),
    runtimeReturning('director', directorCloseCalls),
  ], createdConfigs))

  await service.createAgent(config('candidate-a'))

  await assert.rejects(
    service.createAgent(config('director'), [{ agentId: 'missing', name: 'missing' }]),
    /Unknown Strands agent runtime: missing/,
  )
  await assert.rejects(
    service.createAgent(config('director'), [{ agentId: 'director', name: 'self' }]),
    /cannot reference itself/,
  )
  await assert.rejects(
    service.createAgent(config('director'), [
      { agentId: 'candidate-a', name: 'candidate' },
      { agentId: 'candidate-a', name: 'candidate' },
    ]),
    /Duplicate Strands agent tool name: candidate/,
  )

  assert.equal(createdConfigs.length, 1)
  await service.closeAll()
  assert.equal(candidateCloseCalls.count, 1)
  assert.equal(directorCloseCalls.count, 0)
})
