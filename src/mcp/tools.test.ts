import { describe, expect, it, vi } from 'vitest'

const getHover = vi.fn(async () => [])
const formatHover = vi.fn(() => 'hover')
const getDiagnostics = vi.fn(() => [])
const previewDocumentFix = vi.fn(async () => ({ actionId: 'action-1' }))
const applyCodeAction = vi.fn(async () => ({ actionId: 'action-1' }))
const previewRename = vi.fn(async () => ({ renameId: 'rename-1' }))
const applyRename = vi.fn(async () => ({ renameId: 'rename-1' }))
const getIncomingCalls = vi.fn(async () => [])

vi.mock('../lsp', () => ({
  getClassFileContents: vi.fn(),
  getDeclarations: vi.fn(),
  getDefinition: vi.fn(),
  getDocumentSymbols: vi.fn(),
  getDocumentHighlights: vi.fn(),
  getDocumentLinks: vi.fn(),
  getInlayHints: vi.fn(),
  getDiagnostics,
  getCodeActions: vi.fn(),
  previewCodeAction: vi.fn(),
  previewDocumentFix,
  applyCodeAction,
  getHover,
  getImplementations: vi.fn(),
  getIncomingCalls,
  getOutgoingCalls: vi.fn(),
  getReferences: vi.fn(),
  getSignatureHelp: vi.fn(),
  getTypeDefinition: vi.fn(),
  getWorkspaceSymbols: vi.fn(),
  prepareCallHierarchy: vi.fn(),
  prepareRename: vi.fn(),
  previewRename,
  applyRename,
}))

vi.mock('../transform', () => ({
  transform: {
    formatHover,
    formatDiagnostics: vi.fn(() => 'diagnostics'),
    formatCodeActionPreview: vi.fn(() => 'action-preview'),
    formatCodeActionApplied: vi.fn(() => 'action-applied'),
    formatRenamePreview: vi.fn(() => 'rename-preview'),
    formatRenameApplied: vi.fn(() => 'rename-applied'),
    formatIncomingCalls: vi.fn(() => 'incoming-calls'),
  },
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

  it('dispatches diagnostics filters and transactional operations', async () => {
    const { executeLspOperation } = await import('./tools')

    await expect(executeLspOperation({
      operation: 'workspace_diagnostics',
      uri: '/code',
      severities: ['error'],
      sources: ['ts'],
      codes: ['5102'],
    })).resolves.toBe('diagnostics')
    expect(getDiagnostics).toHaveBeenCalledWith('/code', true, {
      severities: ['error'],
      sources: ['ts'],
      codes: ['5102'],
    })

    await expect(executeLspOperation({
      operation: 'fix_document_preview',
      uri: '/code/main.ts',
    })).resolves.toBe('action-preview')
    expect(previewDocumentFix).toHaveBeenCalledWith('/code/main.ts')

    await expect(executeLspOperation({
      operation: 'code_action_apply',
      uri: '/code/main.ts',
      actionId: 'action-1',
    })).resolves.toBe('action-applied')
    expect(applyCodeAction).toHaveBeenCalledWith('action-1')

    await expect(executeLspOperation({
      operation: 'rename_preview',
      uri: '/code/main.ts',
      line: 2,
      character: 3,
      newName: 'nextName',
    })).resolves.toBe('rename-preview')
    expect(previewRename).toHaveBeenCalledWith('/code/main.ts', 1, 2, 'nextName')

    await expect(executeLspOperation({
      operation: 'rename_apply',
      uri: '/code/main.ts',
      renameId: 'rename-1',
    })).resolves.toBe('rename-applied')
    expect(applyRename).toHaveBeenCalledWith('rename-1')

    await expect(executeLspOperation({
      operation: 'incoming_calls',
      uri: '/code/main.ts',
      callId: 'call-1',
      includeExternal: false,
    })).resolves.toBe('incoming-calls')
    expect(getIncomingCalls).toHaveBeenCalledWith('call-1', false)
  })
})
