import assert from 'node:assert/strict'
import test from 'node:test'
import { Agent } from '@strands-agents/sdk'

import { StrandsRuntimePlatform } from '../../../src/strands/platform/StrandsRuntimePlatform.js'

test('createsNativeStrandsAgentFromTypedConfiguration', () => {
  const strandsRuntimePlatform = new StrandsRuntimePlatform()

  const agent = strandsRuntimePlatform.createAgent({
    id: 'life-agent',
    name: 'Life Agent',
    printer: false,
  })

  assert.ok(agent instanceof Agent)
})

test('loadsDeclarativeMcpServerConfigurationThroughNativeStrandsLoader', async () => {
  const strandsRuntimePlatform = new StrandsRuntimePlatform()

  const mcpClients = await strandsRuntimePlatform.loadMcpClients({})

  assert.deepEqual(mcpClients, [])
})
