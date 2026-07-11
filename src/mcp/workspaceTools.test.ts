import { beforeEach, describe, expect, it, vi } from 'vitest'

const getWorkspaceFolder = vi.fn()
const renameResource = vi.fn()
const realpath = vi.fn(async (value: string) => value)

vi.mock('node:fs/promises', () => ({
  realpath,
}))

vi.mock('vscode', () => ({
  workspace: { getWorkspaceFolder },
}))

vi.mock('../transform', () => ({
  transform: { formatResourceRename: vi.fn(() => 'formatted') },
}))

vi.mock('../workspace', () => ({
  resolveResourceUri: vi.fn((value: string) => ({ value, fsPath: value })),
  renameResource,
}))

describe('executeResourceRename', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    realpath.mockImplementation(async value => value)
    renameResource.mockResolvedValue({ applied: true })
  })

  it('rejects a destination outside the selected workspace', async () => {
    getWorkspaceFolder.mockImplementation((uri: { value: string }) =>
      uri.value.startsWith('/code/') ? { uri: { fsPath: '/code' } } : undefined)
    const { executeResourceRename } = await import('./workspaceTools')

    await expect(executeResourceRename({
      oldUri: '/code/a.ts',
      newUri: '/outside/a.ts',
    })).rejects.toThrow('must be inside')
    expect(renameResource).not.toHaveBeenCalled()
  })

  it('renames when both paths belong to a workspace root', async () => {
    getWorkspaceFolder.mockReturnValue({ uri: { fsPath: '/code' } })
    const { executeResourceRename } = await import('./workspaceTools')

    await expect(executeResourceRename({
      oldUri: '/code/a.ts',
      newUri: '/code/b.ts',
    })).resolves.toBe('formatted')
    expect(renameResource).toHaveBeenCalledWith('/code/a.ts', '/code/b.ts', false)
  })

  it('rejects a workspace symlink that resolves outside its root', async () => {
    getWorkspaceFolder.mockReturnValue({ uri: { fsPath: '/code' } })
    realpath.mockImplementation(async value => value === '/code/link.ts' ? '/outside/file.ts' : value)
    const { executeResourceRename } = await import('./workspaceTools')

    await expect(executeResourceRename({
      oldUri: '/code/link.ts',
      newUri: '/code/renamed.ts',
    })).rejects.toThrow('symbolic links')
    expect(renameResource).not.toHaveBeenCalled()
  })
})
