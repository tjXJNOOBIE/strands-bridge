import { appendFile } from 'node:fs/promises'
import readline from 'node:readline'

const logPath = process.env.STRANDS_BRIDGE_MCP_LOG

async function recordMethod(method) {
  if (!logPath) {
    return
  }

  await appendFile(logPath, `${method}\n`, 'utf8')
}

function sendResponse(response) {
  process.stdout.write(`${JSON.stringify(response)}\n`)
}

function sendMethodNotFound(request) {
  if (request.id === undefined) {
    return
  }

  sendResponse({
    jsonrpc: '2.0',
    id: request.id,
    error: {
      code: -32601,
      message: `Method not found: ${request.method}`,
    },
  })
}

const input = readline.createInterface({
  input: process.stdin,
  crlfDelay: Infinity,
})

for await (const line of input) {
  if (line.trim().length === 0) {
    continue
  }

  const request = JSON.parse(line)
  const method = request.method

  if (typeof method !== 'string') {
    continue
  }

  await recordMethod(method)

  if (method === 'initialize') {
    sendResponse({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: request.params?.protocolVersion ?? '2025-06-18',
        capabilities: {
          tools: {
            listChanged: false,
          },
        },
        serverInfo: {
          name: 'strands-bridge-disposable-mcp',
          version: '1.0.0',
        },
      },
    })
    continue
  }

  if (method === 'notifications/initialized') {
    continue
  }

  if (method === 'tools/list') {
    sendResponse({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: [
          {
            name: 'echo_text',
            description: 'Echo text for bridge integration validation.',
            inputSchema: {
              type: 'object',
              properties: {
                text: {
                  type: 'string',
                },
              },
              required: ['text'],
              additionalProperties: false,
            },
          },
        ],
      },
    })
    continue
  }

  if (method === 'tools/call') {
    const text = request.params?.arguments?.text

    sendResponse({
      jsonrpc: '2.0',
      id: request.id,
      result: {
        content: [
          {
            type: 'text',
            text: typeof text === 'string' ? text : '',
          },
        ],
        isError: false,
      },
    })
    continue
  }

  if (method === 'ping') {
    sendResponse({
      jsonrpc: '2.0',
      id: request.id,
      result: {},
    })
    continue
  }

  sendMethodNotFound(request)
}
