#!/usr/bin/env node
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { createStrandsBridgeMcpServer } from './StrandsBridgeMcpServer.js';
import { StrandsBridgeRuntimeService } from './StrandsBridgeRuntimeService.js';
const runtimeService = new StrandsBridgeRuntimeService();
async function main() {
    try {
        await serveStdio(() => createStrandsBridgeMcpServer(runtimeService));
    }
    finally {
        await runtimeService.closeAll();
    }
}
main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
});
//# sourceMappingURL=main.js.map