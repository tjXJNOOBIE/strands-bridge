import assert from 'node:assert/strict'
import test from 'node:test'
import type {
  AgentResult,
  McpServerConfig,
  Tool,
} from '@strands-agents/sdk'

import { StrandsAgentRuntimeBootstrap } from '../../../src/agent/bootstrap/StrandsAgentRuntimeBootstrap.js'
import type { StrandsAgentRuntimeConfig } from '../../../src/agent/config/StrandsAgentRuntimeConfig.js'
import { StrandsAgentRuntimeConfigError } from '../../../src/agent/error/StrandsAgentRuntimeConfigError.js'
import { FakeAgent } from '../../fake/FakeAgent.js'
import { FakeMcpClient } from '../../fake/FakeMcpClient.js'
import { FakeStrandsRuntimePlatform } from '../../fake/FakeStrandsRuntimePlatform.js'

const agentResult = {
  type: 'agentResult',
  stopReason: 'endTurn',
  toString: () => 'done',
} as unknown as AgentResult

const agentTool = {
  name: 'agent-tool',
} as unknown as Tool

test('rejectsBlankAgentIdentityBeforeLoadingExternalRuntimeState', async () => {
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const strandsRuntimePlatform = new FakeStrandsRuntimePlatform(
    fakeAgent.asStrandsAgent(),
  )
  const bootstrap = new StrandsAgentRuntimeBootstrap(strandsRuntimePlatform)
  const runtimeConfig: StrandsAgentRuntimeConfig = {
    agent: {
      id: '   ',
      name: 'Recovery Agent',
    },
    mcpServers: {
      tavall: {
        url: 'https://example.invalid/mcp',
      },
    },
  }

  await assert.rejects(
    bootstrap.createAgentRuntime(runtimeConfig),
    StrandsAgentRuntimeConfigError,
  )
  assert.equal(strandsRuntimePlatform.loadMcpClientCalls, 0)
  assert.equal(strandsRuntimePlatform.createAgentCalls, 0)
})

test('composesConfiguredToolsWithLoadedMcpClientsAndInitializesAgent', async () => {
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const strandsRuntimePlatform = new FakeStrandsRuntimePlatform(
    fakeAgent.asStrandsAgent(),
  )
  const mcpClient = new FakeMcpClient('tavall')
  strandsRuntimePlatform.mcpClients = [mcpClient.asStrandsMcpClient()]

  const configuredTool = {
    name: 'local-tool',
  } as unknown as Tool
  const mcpServers: Record<string, McpServerConfig> = {
    tavall: {
      url: 'https://example.invalid/mcp',
      headers: {
        Authorization: '${env:TAVALL_MCP_AUTHORIZATION}',
      },
      prefix: 'tavall',
      toolFilters: {
        allowed: ['github_.*', 'cloud_.*'],
      },
    },
  }
  const runtimeConfig: StrandsAgentRuntimeConfig = {
    agent: {
      id: 'recovery-agent',
      name: 'Recovery Agent',
      tools: [configuredTool],
      printer: false,
      appState: {
        workflow: 'recovery',
      },
      backgroundTasks: true,
      checkpointing: true,
      contextManager: false,
      toolExecutor: 'sequential',
      traceAttributes: {
        product: 'recovery-agent',
      },
    },
    mcpServers,
    mcpDefaults: {
      applicationName: 'recovery-agent',
      applicationVersion: '0.1.0',
    },
  }
  const bootstrap = new StrandsAgentRuntimeBootstrap(strandsRuntimePlatform)

  const runtime = await bootstrap.createAgentRuntime(runtimeConfig)

  assert.equal(fakeAgent.initializeCalls, 1)
  assert.equal(strandsRuntimePlatform.loadMcpClientCalls, 1)
  assert.equal(strandsRuntimePlatform.loadedMcpServers, mcpServers)
  assert.deepEqual(strandsRuntimePlatform.loadedMcpDefaults, {
    applicationName: 'recovery-agent',
    applicationVersion: '0.1.0',
  })
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.id, 'recovery-agent')
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.name, 'Recovery Agent')
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.printer, false)
  assert.deepEqual(strandsRuntimePlatform.createdAgentConfig?.appState, {
    workflow: 'recovery',
  })
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.backgroundTasks, true)
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.checkpointing, true)
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.contextManager, false)
  assert.equal(strandsRuntimePlatform.createdAgentConfig?.toolExecutor, 'sequential')
  assert.deepEqual(strandsRuntimePlatform.createdAgentConfig?.traceAttributes, {
    product: 'recovery-agent',
  })

  const createdTools = strandsRuntimePlatform.createdAgentConfig?.tools
  assert.ok(createdTools)
  assert.equal(createdTools.length, 2)
  assert.deepEqual(createdTools[0], [configuredTool])
  assert.deepEqual(createdTools[1], [mcpClient.asStrandsMcpClient()])

  await runtime.close()
})

test('cleansLoadedMcpClientsInReverseOrderWhenAgentInitializationFails', async () => {
  const disconnectOrder: string[] = []
  const firstMcpClient = new FakeMcpClient('first', disconnectOrder)
  const secondMcpClient = new FakeMcpClient('second', disconnectOrder)
  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const startupError = new Error('initialize failed')
  fakeAgent.initializeError = startupError

  const strandsRuntimePlatform = new FakeStrandsRuntimePlatform(
    fakeAgent.asStrandsAgent(),
  )
  strandsRuntimePlatform.mcpClients = [
    firstMcpClient.asStrandsMcpClient(),
    secondMcpClient.asStrandsMcpClient(),
  ]
  const bootstrap = new StrandsAgentRuntimeBootstrap(strandsRuntimePlatform)

  await assert.rejects(
    bootstrap.createAgentRuntime({
      agent: {
        id: 'web-design-agent',
        name: 'Web Design Agent',
      },
      mcpServers: {
        tavall: {
          url: 'https://example.invalid/mcp',
        },
      },
    }),
    startupError,
  )

  assert.deepEqual(disconnectOrder, ['second', 'first'])
})

test('reportsStartupAndCleanupFailuresTogether', async () => {
  const mcpClient = new FakeMcpClient('broken')
  const cleanupError = new Error('disconnect failed')
  mcpClient.disconnectError = cleanupError

  const fakeAgent = new FakeAgent(agentResult, agentTool)
  const startupError = new Error('initialize failed')
  fakeAgent.initializeError = startupError

  const strandsRuntimePlatform = new FakeStrandsRuntimePlatform(
    fakeAgent.asStrandsAgent(),
  )
  strandsRuntimePlatform.mcpClients = [mcpClient.asStrandsMcpClient()]
  const bootstrap = new StrandsAgentRuntimeBootstrap(strandsRuntimePlatform)

  await assert.rejects(
    bootstrap.createAgentRuntime({
      agent: {
        id: 'community-agent',
        name: 'Community Agent',
      },
      mcpServers: {
        tavall: {
          url: 'https://example.invalid/mcp',
        },
      },
    }),
    (error: unknown) => {
      assert.ok(error instanceof AggregateError)
      assert.deepEqual(error.errors, [startupError, cleanupError])

      return true
    },
  )
})
