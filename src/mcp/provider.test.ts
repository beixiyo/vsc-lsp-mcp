import type { ExtensionContext } from 'vscode'
import { describe, expect, it, vi } from 'vitest'

describe('registerMcpServerProvider', () => {
  it('registers a VS Code MCP provider with the expected id', async () => {
    const vscode = await loadProviderWithVscodeMock({ enabled: true })
    const { registerMcpServerProvider, MCP_SERVER_PROVIDER_ID } = await import('./provider')

    const context = createContext()
    registerMcpServerProvider(context, () => 9527)

    expect(vscode.lm.registerMcpServerDefinitionProvider).toHaveBeenCalledWith(
      MCP_SERVER_PROVIDER_ID,
      expect.objectContaining({
        onDidChangeMcpServerDefinitions: expect.any(Function),
        provideMcpServerDefinitions: expect.any(Function),
        resolveMcpServerDefinition: expect.any(Function),
      }),
    )
    expect(context.subscriptions).toHaveLength(2)
  })

  it('returns the active HTTP endpoint when enabled and started', async () => {
    const vscode = await loadProviderWithVscodeMock({ enabled: true })
    const { registerMcpServerProvider } = await import('./provider')

    registerMcpServerProvider(createContext(), () => 9530)

    const provider = getRegisteredProvider(vscode)
    const definitions = provider.provideMcpServerDefinitions()

    expect(definitions).toHaveLength(1)
    expect(definitions.at(0)).toMatchObject({
      label: 'LSP MCP',
      uri: { value: 'http://127.0.0.1:9530/mcp' },
    })
  })

  it('returns no definitions before startup or when disabled', async () => {
    const disabledVscode = await loadProviderWithVscodeMock({ enabled: false })
    const { registerMcpServerProvider } = await import('./provider')

    registerMcpServerProvider(createContext(), () => 9527)
    expect(getRegisteredProvider(disabledVscode).provideMcpServerDefinitions()).toEqual([])

    const enabledVscode = await loadProviderWithVscodeMock({ enabled: true })
    const { registerMcpServerProvider: registerEnabledProvider } = await import('./provider')

    registerEnabledProvider(createContext(), () => undefined)
    expect(getRegisteredProvider(enabledVscode).provideMcpServerDefinitions()).toEqual([])
  })
})

async function loadProviderWithVscodeMock(options: { enabled: boolean }) {
  vi.resetModules()

  const vscode = {
    EventEmitter: class {
      event = vi.fn()
      fire = vi.fn()
      dispose = vi.fn()
    },
    lm: {
      registerMcpServerDefinitionProvider: vi.fn(() => ({ dispose: vi.fn() })),
    },
    McpHttpServerDefinition: class {
      constructor(
        public label: string,
        public uri: unknown,
      ) {}
    },
    Uri: {
      parse: vi.fn((value: string) => ({ value })),
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, fallback: unknown) => key === 'enabled' ? options.enabled : fallback),
      })),
    },
  }

  vi.doMock('vscode', () => vscode)

  return vscode
}

function createContext() {
  return {
    subscriptions: [],
  } as unknown as ExtensionContext
}

function getRegisteredProvider(vscode: Awaited<ReturnType<typeof loadProviderWithVscodeMock>>) {
  const register = vscode.lm.registerMcpServerDefinitionProvider as unknown as {
    mock: {
      calls: unknown[][]
    }
  }
  const call = register.mock.calls.at(-1)

  if (!call) {
    throw new Error('MCP server provider was not registered')
  }

  return call[1] as unknown as {
    provideMcpServerDefinitions: () => unknown[]
  }
}
