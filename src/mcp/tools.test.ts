import { describe, expect, it, vi } from 'vitest'

const getHover = vi.fn(async () => [])
const formatHover = vi.fn(() => 'hover')

vi.mock('../lsp', () => ({
  getClassFileContents: vi.fn(),
  getCompletions: vi.fn(),
  getDeclarations: vi.fn(),
  getDefinition: vi.fn(),
  getDocumentSymbols: vi.fn(),
  getHover,
  getImplementations: vi.fn(),
  getIncomingCalls: vi.fn(),
  getOutgoingCalls: vi.fn(),
  getReferences: vi.fn(),
  getSignatureHelp: vi.fn(),
  getTypeDefinition: vi.fn(),
  getWorkspaceSymbols: vi.fn(),
  prepareCallHierarchy: vi.fn(),
  rename: vi.fn(),
}))

vi.mock('../transform', () => ({
  transform: { formatHover },
}))

describe('executeLspOperation', () => {
  it('converts 1-based protocol positions to 0-based VS Code positions', async () => {
    const { executeLspOperation } = await import('./tools')

    await expect(executeLspOperation({
      operation: 'hover',
      uri: '/code/main.ts',
      line: 1,
      character: 1,
    })).resolves.toBe('hover')
    expect(getHover).toHaveBeenCalledWith('/code/main.ts', 0, 0)
  })
})
