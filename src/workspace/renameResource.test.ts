import { beforeEach, describe, expect, it, vi } from 'vitest'

const applyEdit = vi.fn()
const renameFile = vi.fn()

vi.mock('vscode', () => ({
  Uri: {
    file: vi.fn((value: string) => createUri(`file://${value}`)),
    parse: vi.fn((value: string) => createUri(value)),
  },
  WorkspaceEdit: class {
    renameFile = renameFile
  },
  workspace: {
    applyEdit,
  },
}))

vi.mock('../utils/logger', () => ({
  logger: {
    info: vi.fn(),
  },
}))

describe('renameResource', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    applyEdit.mockResolvedValue(true)
  })

  it('renames a local file or directory through a workspace edit', async () => {
    const { renameResource } = await import('./renameResource')

    const result = await renameResource('/workspace/keyboard', '/workspace/shortcuts')

    expect(renameFile).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'file:///workspace/keyboard' }),
      expect.objectContaining({ value: 'file:///workspace/shortcuts' }),
      { overwrite: false },
    )
    expect(applyEdit).toHaveBeenCalledOnce()
    expect(result).toEqual({
      applied: true,
      oldUri: 'file:///workspace/keyboard',
      newUri: 'file:///workspace/shortcuts',
    })
  })

  it('preserves remote URI schemes and forwards overwrite', async () => {
    const { renameResource } = await import('./renameResource')

    await renameResource(
      'vscode-remote://ssh-remote+dev/workspace/keyboard',
      'vscode-remote://ssh-remote+dev/workspace/shortcuts',
      true,
    )

    expect(renameFile).toHaveBeenCalledWith(
      expect.objectContaining({ value: 'vscode-remote://ssh-remote+dev/workspace/keyboard' }),
      expect.objectContaining({ value: 'vscode-remote://ssh-remote+dev/workspace/shortcuts' }),
      { overwrite: true },
    )
  })

  it('rejects when VS Code cannot apply the workspace edit', async () => {
    const { renameResource } = await import('./renameResource')
    applyEdit.mockResolvedValue(false)

    await expect(renameResource('/workspace/a.ts', '/workspace/b.ts'))
      .rejects
      .toThrow('Resource rename could not be applied')
  })

  it('rejects identical source and destination URIs', async () => {
    const { renameResource } = await import('./renameResource')

    await expect(renameResource('/workspace/a.ts', '/workspace/a.ts'))
      .rejects
      .toThrow('Source and destination must be different')

    expect(renameFile).not.toHaveBeenCalled()
    expect(applyEdit).not.toHaveBeenCalled()
  })
})

function createUri(value: string) {
  return {
    value,
    toString: () => value,
  }
}
