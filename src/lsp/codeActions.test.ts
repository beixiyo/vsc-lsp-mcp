import { beforeEach, describe, expect, it, vi } from 'vitest'

const executeCommand = vi.fn()
const applyEdit = vi.fn()
const save = vi.fn()
const uri = { toString: () => 'file:///code/main.ts', fsPath: '/code/main.ts' }
let documentVersion = 1
const range = { start: { line: 0, character: 0 }, end: { line: 0, character: 4 } }
const document = {
  uri,
  get version() {
    return documentVersion
  },
  isDirty: false,
  lineCount: 1,
  lineAt: vi.fn(() => ({ range: { end: { line: 0, character: 4 } } })),
  save,
}

class WorkspaceEdit {
  private readonly values: [typeof uri, { range: typeof range, newText: string }[]][] = []

  replace(target: typeof uri, editRange: typeof range, newText: string) {
    const entry = this.values.find(([entryUri]) => entryUri.toString() === target.toString())
    if (entry)
      entry[1].push({ range: editRange, newText })
    else
      this.values.push([target, [{ range: editRange, newText }]])
  }

  entries() {
    return this.values
  }

  get size() {
    return this.values.length
  }
}

vi.mock('vscode', () => ({
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  Range: class {
    start: unknown
    end: unknown

    constructor(...args: unknown[]) {
      if (args.length === 2) {
        this.start = args[0]
        this.end = args[1]
      }
      else {
        this.start = { line: args[0], character: args[1] }
        this.end = { line: args[2], character: args[3] }
      }
    }
  },
  WorkspaceEdit,
  CodeActionKind: {
    QuickFix: { value: 'quickfix' },
    SourceFixAll: { value: 'source.fixAll' },
  },
  SymbolKind: { Function: 11, Constructor: 8, Method: 5 },
  commands: { executeCommand },
  languages: { getDiagnostics: vi.fn(() => []) },
  workspace: {
    applyEdit,
    fs: { stat: vi.fn(async () => ({ mtime: 1, size: 1 })) },
    openTextDocument: vi.fn(async () => document),
    textDocuments: [document],
  },
}))

vi.mock('./tools', () => ({ getDocument: vi.fn(async () => document) }))

describe('code action transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    save.mockResolvedValue(true)
    applyEdit.mockResolvedValue(true)
    documentVersion = 1
  })

  it('lists only editable actions and never executes command-only actions', async () => {
    const edit = new WorkspaceEdit()
    edit.replace(uri, range, 'fixed')
    executeCommand.mockResolvedValue([
      { title: 'Fix typo', kind: { value: 'quickfix' }, edit },
      { title: 'Run arbitrary command', command: 'dangerous.command' },
    ])
    const { getCodeActions } = await import('./codeActions')

    const actions = await getCodeActions('/code/main.ts', 0, 0, 'quickfix')

    expect(actions).toHaveLength(1)
    expect(actions[0]).toMatchObject({ title: 'Fix typo', kind: 'quickfix' })
    expect(executeCommand).toHaveBeenCalledOnce()
    expect(applyEdit).not.toHaveBeenCalled()
  })

  it('requires preview, then applies, saves, and rejects reuse', async () => {
    const edit = new WorkspaceEdit()
    edit.replace(uri, range, 'fixed')
    executeCommand.mockResolvedValue([{ title: 'Fix typo', edit }])
    const { applyCodeAction, getCodeActions, previewCodeAction } = await import('./codeActions')
    const [action] = await getCodeActions('/code/main.ts', 0, 0)

    await expect(applyCodeAction(action.actionId)).rejects.toThrow('previewed')
    const preview = await previewCodeAction(action.actionId)
    expect(preview).toMatchObject({ filesChanged: 1, title: 'Fix typo' })
    expect(applyEdit).not.toHaveBeenCalled()

    await expect(applyCodeAction(action.actionId)).resolves.toMatchObject({
      editsCount: 1,
      savedToDisk: true,
    })
    expect(save).toHaveBeenCalledOnce()
    await expect(applyCodeAction(action.actionId)).rejects.toThrow('not found')
  })

  it('does not expose actions containing unpreviewable file operations', async () => {
    const edit = new WorkspaceEdit()
    edit.replace(uri, range, 'fixed')
    Object.defineProperty(edit, 'size', { value: 2 })
    executeCommand.mockResolvedValue([{ title: 'Move to a new file', edit }])
    const { getCodeActions } = await import('./codeActions')

    await expect(getCodeActions('/code/main.ts', 0, 0)).resolves.toEqual([])
    expect(applyEdit).not.toHaveBeenCalled()
  })

  it('rejects a preview when a target changed after actions were listed', async () => {
    const edit = new WorkspaceEdit()
    edit.replace(uri, range, 'fixed')
    executeCommand.mockResolvedValue([{ title: 'Fix typo', edit }])
    const { getCodeActions, previewCodeAction } = await import('./codeActions')
    const [action] = await getCodeActions('/code/main.ts', 0, 0)

    documentVersion = 2

    await expect(previewCodeAction(action.actionId)).rejects.toThrow('stale')
    expect(applyEdit).not.toHaveBeenCalled()
  })
})
