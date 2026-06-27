import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vscode', () => ({
  l10n: {
    t: vi.fn((message: string, args?: Record<string, unknown>) => (
      args
        ? message.replace(/\{(\w+)\}/g, (_, key) => String(args[key]))
        : message
    )),
  },
  window: {
    showErrorMessage: vi.fn(),
    showInformationMessage: vi.fn(),
  },
}))

describe('startServer', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports the actual port after retrying occupied ports', async () => {
    const { startServer } = await import('./startServer')
    const app = createListenStub([
      { type: 'error', code: 'EADDRINUSE' },
      { type: 'success' },
    ])
    const onStarted = vi.fn()

    startServer(app, 9527, 3, { onStarted })
    await waitForAsyncErrors()

    expect(app.listen).toHaveBeenCalledTimes(2)
    expect(app.listen.mock.calls.map((call: unknown[]) => call[0])).toEqual([9527, 9528])
    expect(onStarted).toHaveBeenCalledWith(9528)
  })

  it('does not retry after maxRetries is reached', async () => {
    const vscode = await import('vscode')
    const { startServer } = await import('./startServer')
    const app = createListenStub([
      { type: 'error', code: 'EADDRINUSE' },
      { type: 'error', code: 'EADDRINUSE' },
    ])
    const onStarted = vi.fn()

    startServer(app, 9527, 1, { onStarted })
    await waitForAsyncErrors()

    expect(app.listen).toHaveBeenCalledTimes(2)
    expect(onStarted).not.toHaveBeenCalled()
    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith('Failed to start LSP MCP server: listen failed')
  })
})

function createListenStub(results: ListenResult[]) {
  let index = 0

  return {
    listen: vi.fn((_port: number, callback: (error?: Error) => void) => {
      const server = new EventEmitter()
      const result = results[index++] ?? { type: 'success' }

      if (result.type === 'success') {
        callback()
      }
      else {
        process.nextTick(() => {
          server.emit('error', Object.assign(new Error('listen failed'), { code: result.code }))
        })
      }

      return server
    }),
  } as any
}

async function waitForAsyncErrors() {
  await new Promise(resolve => setImmediate(resolve))
}

type ListenResult =
  | { type: 'success' }
  | { type: 'error', code: string }
