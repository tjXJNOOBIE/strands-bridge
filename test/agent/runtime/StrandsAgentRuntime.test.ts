import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  AgentResult,
  AgentStreamEvent,
  Tool,
} from '@strands-agents/sdk'

import { StrandsAgentRuntimeClosedError } from '../../../src/agent/error/StrandsAgentRuntimeClosedError.js'
import { StrandsAgentRuntime } from '../../../src/agent/runtime/StrandsAgentRuntime.js'
import { FakeAgent } from '../../fake/FakeAgent.js'
import { FakeMcpClient } from '../../fake/FakeMcpClient.js'

const agentResult = {
  type: 'agentResult',
  stopReason: 'endTurn',
  toString: () => 'completed',
} as unknown as AgentResult

const agentTool = {
  name: 'specialist-agent',
} as unknown as Tool

test('invokesRealRuntimeBoundaryAndReturnsNativeAgentResult', async () => {
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const runtime = new StrandsAgentRuntime(
    fakeAgent.asStrandsAgent(),
    [],
  )

  const result = await runtime.invokeAgent('inspect the service')

  assert.equal(result, agentResult)
  assert.equal(fakeAgent.invokeCalls, 1)
})

test('streamsAgentEventsAndPreservesFinalNativeResult', async () => {
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const streamEvent = {
    type: 'modelStreamUpdateEvent',
  } as unknown as AgentStreamEvent
  fakeAgent.streamEvents = [streamEvent]
  fakeAgent.streamResult = agentResult

  const runtime = new StrandsAgentRuntime(
    fakeAgent.asStrandsAgent(),
    [],
  )
  const stream = runtime.streamAgent('design three candidates')

  const first = await stream.next()
  const last = await stream.next()

  assert.equal(first.done, false)
  assert.equal(first.value, streamEvent)
  assert.equal(last.done, true)
  assert.equal(last.value, agentResult)
})

test('createsAgentToolWithoutExposingUnderlyingAgentHandle', () => {
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const runtime = new StrandsAgentRuntime(
    fakeAgent.asStrandsAgent(),
    [],
  )

  const tool = runtime.createAgentTool({
    name: 'recovery-specialist',
    description: 'Diagnoses and verifies service recovery.',
  })

  assert.equal(tool, agentTool)
  assert.equal(fakeAgent.agentToolCalls, 1)
})

test('closesMcpClientsInReverseOrderAndCancelsActiveInvocation', async () => {
  const disconnectOrder: string[] = []
  const firstMcpClient = new FakeMcpClient('first', disconnectOrder)
  const secondMcpClient = new FakeMcpClient('second', disconnectOrder)
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  fakeAgent.isInvoking = true

  const runtime = new StrandsAgentRuntime(
    fakeAgent.asStrandsAgent(),
    [
      firstMcpClient.asStrandsMcpClient(),
      secondMcpClient.asStrandsMcpClient(),
    ],
  )

  await runtime.close()

  assert.equal(runtime.isClosed(), true)
  assert.equal(fakeAgent.cancelCalls, 1)
  assert.deepEqual(disconnectOrder, ['second', 'first'])
})

test('retriesOnlyResourcesThatRemainUnclosedAfterCleanupFailure', async () => {
  const disconnectOrder: string[] = []
  const firstMcpClient = new FakeMcpClient('first', disconnectOrder)
  const secondMcpClient = new FakeMcpClient('second', disconnectOrder)
  const disconnectError = new Error('temporary disconnect failure')
  secondMcpClient.disconnectError = disconnectError

  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const runtime = new StrandsAgentRuntime(
    fakeAgent.asStrandsAgent(),
    [
      firstMcpClient.asStrandsMcpClient(),
      secondMcpClient.asStrandsMcpClient(),
    ],
  )

  await assert.rejects(runtime.close(), AggregateError)
  assert.deepEqual(disconnectOrder, ['second', 'first'])
  assert.equal(firstMcpClient.connectionState, 'disconnected')

  secondMcpClient.disconnectError = undefined
  await runtime.close()

  assert.deepEqual(disconnectOrder, ['second', 'first', 'second'])
  assert.equal(secondMcpClient.connectionState, 'disconnected')
})

test('rejectsNewInvocationStreamingAndAgentToolCreationAfterClose', async () => {
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const runtime = new StrandsAgentRuntime(
    fakeAgent.asStrandsAgent(),
    [],
  )

  await runtime.close()

  await assert.rejects(
    runtime.invokeAgent('should not run'),
    StrandsAgentRuntimeClosedError,
  )

  const stream = runtime.streamAgent('should not stream')
  await assert.rejects(
    stream.next(),
    StrandsAgentRuntimeClosedError,
  )

  assert.throws(
    () => runtime.createAgentTool(),
    StrandsAgentRuntimeClosedError,
  )
})
