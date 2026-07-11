import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyEdit = vi.fn()
const executeCommand = vi.fn()
const save = vi.fn()
const openTextDocument = vi.fn(async () => document)
const uri = { toString: () => 'file:///code/main.ts', fsPath: '/code/main.ts' }
const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } }
const document = {
  uri,
  version: 1,
  getWordRangeAtPosition: vi.fn(() => range),
  getText: vi.fn(() => 'name'),
  save,
}

vi.mock('vscode', () => ({
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Uri: { parse: vi.fn(() => uri) },
  SymbolKind: { Function: 11, Constructor: 8, Method: 5 },
  commands: { executeCommand },
  workspace: {
    applyEdit,
    openTextDocument,
    textDocuments: [document],
    getConfiguration: () => ({ get: (_key: string, fallback: unknown) => fallback }),
    getWorkspaceFolder: () => ({ uri: { fsPath: '/code' } }),
  },
}))

vi.mock('./tools', () => ({ getDocument: vi.fn(async () => document) }))

describe('rename transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    save.mockResolvedValue(true)
  })

  it('falls back to the current word when prepareRename is unsupported', async () => {
    executeCommand.mockResolvedValue(undefined)
    const { prepareRename } = await import('./rename')

    await expect(prepareRename('/code/main.ts', 0, 0)).resolves.toEqual({
      range: '1:1-1:5',
      placeholder: 'name',
    })
  })

  it('previews without applying, then applies and saves exactly once', async () => {
    const edit = {
      size: 1,
      entries: () => [[uri, [{ range, newText: 'nextName' }]]],
    }
    executeCommand.mockResolvedValue(edit)
    applyEdit.mockResolvedValue(true)
    const { applyRename, previewRename } = await import('./rename')

    const preview = await previewRename('/code/main.ts', 0, 0, 'nextName')
    expect(applyEdit).not.toHaveBeenCalled()

    await expect(applyRename(preview.renameId)).resolves.toMatchObject({
      editsCount: 1,
      savedToDisk: true,
    })
    expect(applyEdit).toHaveBeenCalledWith(edit)
    expect(save).toHaveBeenCalledOnce()
    await expect(applyRename(preview.renameId)).rejects.toThrow('previewed')
  })

  it('rejects file operations that the VS Code API cannot enumerate for preview', async () => {
    executeCommand.mockResolvedValue({
      size: 2,
      entries: () => [[uri, [{ range, newText: 'nextName' }]]],
    })
    const { previewRename } = await import('./rename')

    await expect(previewRename('/code/main.ts', 0, 0, 'nextName'))
      .rejects
      .toThrow('file operations')
    expect(applyEdit).not.toHaveBeenCalled()
  })
})
