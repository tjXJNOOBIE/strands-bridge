import { serveStdio } from '@modelcontextprotocol/server/stdio'

import { createStrandsBridgeMcpServer } from './StrandsBridgeMcpServer.js'
import { StrandsBridgeRuntimeService } from './StrandsBridgeRuntimeService.js'

const runtimeService = new StrandsBridgeRuntimeService()

async function main(): Promise<void> {
  try {
    await serveStdio(() => createStrandsBridgeMcpServer(runtimeService))
  } finally {
    await runtimeService.closeAll()
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error)
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})
