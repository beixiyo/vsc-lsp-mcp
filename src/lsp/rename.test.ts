import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyEdit = vi.fn()
const executeCommand = vi.fn()

vi.mock('vscode', () => ({
  Position: class {
    constructor(public line: number, public character: number) {}
  },
  commands: { executeCommand },
  workspace: { applyEdit },
}))

vi.mock('../utils/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}))

vi.mock('./tools', () => ({
  getDocument: vi.fn(async () => ({ uri: { toString: () => 'file:///code/main.ts' } })),
}))

describe('rename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    executeCommand
      .mockResolvedValueOnce({ range: {} })
      .mockResolvedValueOnce({ entries: () => [] })
  })

  it('rejects a WorkspaceEdit that VS Code could not apply', async () => {
    applyEdit.mockResolvedValue(false)
    const { rename } = await import('./rename')

    await expect(rename('/code/main.ts', 0, 0, 'nextName'))
      .rejects
      .toThrow('Rename edit could not be applied')
  })
})
