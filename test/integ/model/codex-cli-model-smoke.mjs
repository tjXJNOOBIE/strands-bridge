import assert from 'node:assert/strict'

import {StrandsAgentRuntimeBootstrap} from '../../../dist/index.js'

assert.equal(
  process.env.STRANDS_BRIDGE_USE_CODEX_SUBSCRIPTION,
  '1',
  'Set STRANDS_BRIDGE_USE_CODEX_SUBSCRIPTION=1 to run the subscription-backed model smoke.',
)

const runtime = await new StrandsAgentRuntimeBootstrap().createAgentRuntime({
  agent: {
    id: 'bridge-codex-cli-model',
    name: 'Bridge Codex CLI Model',
    model: 'codex-cli',
    printer: false,
    systemPrompt: 'Return exactly CODEX_STRANDS_OK and no other text.',
  },
})

try {
  const result = await runtime.invokeAgent('Confirm the subscription-backed Strands model is working.')
  assert.equal(result.toString().trim(), 'CODEX_STRANDS_OK')
  console.log('Codex subscription model smoke succeeded through native Strands.')
} finally {
  await runtime.close()
}
