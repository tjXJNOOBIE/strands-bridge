import type { McpClient } from '@strands-agents/sdk'

export class FakeMcpClient {
  public connectionState: 'disconnected' | 'connected' | 'failed' = 'connected'
  public disconnectCalls = 0
  public disconnectError: unknown | undefined
  private readonly disconnectOrder: string[]
  private readonly clientId: string

  public constructor(clientId: string, disconnectOrder: string[] = []) {
    this.clientId = clientId
    this.disconnectOrder = disconnectOrder
  }

  public async disconnect(): Promise<void> {
    this.disconnectCalls += 1
    this.disconnectOrder.push(this.clientId)

    if (this.disconnectError !== undefined) {
      throw this.disconnectError
    }

    this.connectionState = 'disconnected'
  }

  public asStrandsMcpClient(): McpClient {
    return this as unknown as McpClient
  }
}
