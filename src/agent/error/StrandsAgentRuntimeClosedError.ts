export class StrandsAgentRuntimeClosedError extends Error {
  public constructor() {
    super('The Strands agent runtime is closed and cannot accept new work.')
    this.name = 'StrandsAgentRuntimeClosedError'
  }
}
