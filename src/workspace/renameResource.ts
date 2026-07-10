import * as vscode from 'vscode'
import { logger } from '../utils/logger'

/**
 * Rename a file or directory through VS Code's workspace edit pipeline.
 * Language extensions can participate in this operation to update references.
 *
 * @param oldUri - Existing absolute path or URI
 * @param newUri - Destination absolute path or URI
 * @param overwrite - Whether an existing destination may be replaced
 * @returns Applied resource rename details
 */
export async function renameResource(
  oldUri: string,
  newUri: string,
  overwrite = false,
): Promise<ResourceRenameResult> {
  const source = resolveResourceUri(oldUri)
  const destination = resolveResourceUri(newUri)

  if (source.toString() === destination.toString()) {
    throw new Error('Source and destination must be different')
  }

  const edit = new vscode.WorkspaceEdit()
  edit.renameFile(source, destination, { overwrite })

  logger.info(`Renaming resource: ${source.toString()} -> ${destination.toString()}`)

  const applied = await vscode.workspace.applyEdit(edit)
  if (!applied) {
    throw new Error('Resource rename could not be applied')
  }

  return {
    applied,
    oldUri: source.toString(),
    newUri: destination.toString(),
  }
}

function resolveResourceUri(input: string): vscode.Uri {
  return /^[a-z][a-z\d+.-]*:\/\//i.test(input)
    ? vscode.Uri.parse(input)
    : vscode.Uri.file(input)
}

/** Result returned after VS Code applies a resource rename. */
export interface ResourceRenameResult {
  /** Whether VS Code applied the workspace edit. */
  applied: true

  /** Normalized destination URI. */
  newUri: string

  /** Normalized source URI. */
  oldUri: string
}
