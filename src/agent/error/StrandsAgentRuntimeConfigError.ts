export class StrandsAgentRuntimeConfigError extends Error {
  public constructor(message: string) {
    super(message)
    this.name = 'StrandsAgentRuntimeConfigError'
  }
}
