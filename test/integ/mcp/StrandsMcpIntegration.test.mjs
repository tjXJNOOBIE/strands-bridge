import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { StrandsAgentRuntimeBootstrap } from '../../../dist/index.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const disposableServerPath = path.join(
  currentDirectory,
  'disposable-mcp-server.mjs',
)

test('initializesNativeAgentThroughDisposableMcpServerAndCleansUp', async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'custom-strands-bridge-mcp-'),
  )
  const logPath = path.join(temporaryDirectory, 'mcp-methods.log')
  const bootstrap = new StrandsAgentRuntimeBootstrap()

  try {
    const runtime = await bootstrap.createAgentRuntime({
      agent: {
        id: 'bridge-mcp-integration',
        name: 'Bridge MCP Integration',
        printer: false,
      },
      mcpServers: {
        disposable: {
          command: process.execPath,
          args: [disposableServerPath],
          env: {
            STRANDS_BRIDGE_MCP_LOG: logPath,
          },
          prefix: 'bridge',
          toolFilters: {
            allowed: ['echo_text'],
          },
        },
      },
      mcpDefaults: {
        applicationName: 'custom-strands-bridge-integration',
        applicationVersion: '0.1.0',
      },
    })

    assert.equal(runtime.isClosed(), false)

    await runtime.close()

    assert.equal(runtime.isClosed(), true)

    const methods = await readFile(logPath, 'utf8')

    assert.match(methods, /^initialize$/m)
    assert.match(methods, /^notifications\/initialized$/m)
    assert.match(methods, /^tools\/list$/m)
  } finally {
    await rm(temporaryDirectory, {
      recursive: true,
      force: true,
    })
  }
})
