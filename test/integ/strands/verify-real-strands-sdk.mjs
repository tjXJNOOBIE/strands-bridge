import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const bridgePackageUrl = new URL('../../../package.json', import.meta.url)
const strandsPackageUrl = new URL(
  '../../../node_modules/@strands-agents/sdk/package.json',
  import.meta.url,
)

const bridgePackage = JSON.parse(await readFile(bridgePackageUrl, 'utf8'))
const strandsPackage = JSON.parse(await readFile(strandsPackageUrl, 'utf8'))
const expectedVersion = bridgePackage.dependencies?.['@strands-agents/sdk']

assert.equal(
  typeof expectedVersion,
  'string',
  'package.json must declare an exact @strands-agents/sdk dependency.',
)
assert.match(
  expectedVersion,
  /^\d+\.\d+\.\d+$/,
  'The Strands dependency must be an exact semantic version for validated bridge releases.',
)
assert.equal(
  strandsPackage.version,
  expectedVersion,
  `Real Strands SDK ${expectedVersion} is required; found ${strandsPackage.version ?? 'unknown'}.`,
)

console.log(`Verified real @strands-agents/sdk@${strandsPackage.version}.`)
