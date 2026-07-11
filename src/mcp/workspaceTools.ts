import type { RenameResourceInput } from '../protocol'
import { realpath } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative } from 'node:path'
import { workspace } from 'vscode'
import { validateRenameResourceInput } from '../protocol'
import { transform } from '../transform'
import { renameResource, resolveResourceUri } from '../workspace'

/** 在当前 VS Code 窗口中执行经过 Broker 路由的资源重命名 */
export async function executeResourceRename(input: RenameResourceInput): Promise<string> {
  validateRenameResourceInput(input)

  const source = resolveResourceUri(input.oldUri)
  const destination = resolveResourceUri(input.newUri)
  const sourceFolder = workspace.getWorkspaceFolder(source)
  const destinationFolder = workspace.getWorkspaceFolder(destination)
  if (!sourceFolder || !destinationFolder)
    throw new Error('Resource rename source and destination must be inside the selected VS Code workspace')

  const sourcePath = await realpath(source.fsPath)
  const destinationPath = await canonicalDestination(destination.fsPath)
  const sourceRoot = await realpath(sourceFolder.uri.fsPath)
  const destinationRoot = await realpath(destinationFolder.uri.fsPath)
  if (!isPathInside(sourcePath, sourceRoot) || !isPathInside(destinationPath, destinationRoot))
    throw new Error('Resource rename cannot cross a workspace root through path traversal or symbolic links')

  const result = await renameResource(input.oldUri, input.newUri, input.overwrite ?? false)
  return transform.formatResourceRename(result)
}

async function canonicalDestination(path: string): Promise<string> {
  try {
    return await realpath(path)
  }
  catch {
    return join(await realpath(dirname(path)), basename(path))
  }
}

function isPathInside(path: string, root: string): boolean {
  const child = relative(root, path)
  return child === '' || (!child.startsWith('..') && !isAbsolute(child))
}
