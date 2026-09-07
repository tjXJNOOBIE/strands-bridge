import assert from 'node:assert/strict'

import { StrandsAgentRuntimeBootstrap } from '../../../dist/index.js'

const modelId = process.env.STRANDS_BRIDGE_MODEL_ID

assert.ok(
  modelId && modelId.trim().length > 0,
  'STRANDS_BRIDGE_MODEL_ID is required for the authorized model smoke test.',
)

const bootstrap = new StrandsAgentRuntimeBootstrap()
const runtime = await bootstrap.createAgentRuntime({
  agent: {
    id: 'bridge-model-integration',
    name: 'Bridge Model Integration',
    model: modelId,
    printer: false,
    systemPrompt: 'Respond briefly and directly.',
  },
})

try {
  const result = await runtime.invokeAgent(
    'Return a short confirmation that the Strands model invocation succeeded.',
  )
  const responseText = result.toString().trim()

  assert.ok(
    responseText.length > 0,
    'The authorized Strands model invocation returned an empty response.',
  )

  console.log(`Model smoke succeeded with ${modelId}.`)
} finally {
  await runtime.close()
}
