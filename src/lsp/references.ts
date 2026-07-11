import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDefinition } from './definition'
import { classifyUri, pathMatches } from './pathOrigin'
import { getDocument } from './tools'

/**
 * Find all references to a symbol.
 *
 * @param uri - The document URI
 * @param line - Line number (0-based)
 * @param character - Character offset (0-based)
 * @returns Raw VSCode Location array
 */
export async function getReferences(
  uri: string,
  line: number,
  character: number,
  options: ReferenceOptions = {},
): Promise<vscode.Location[]> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`Failed to find document: ${uri}`)
    }

    const position = new vscode.Position(line, character)

    logger.info(`Getting references: ${uri} line:${line} col:${character}`)

    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      document.uri,
      position,
    )

    let result = references || []
    if (options.includeDeclaration === false) {
      const definitions = await getDefinition(uri, line, character)
      const declarationKeys = new Set(toLocations(definitions).map(locationKey))
      result = result.filter(location => !declarationKeys.has(locationKey(location)))
    }
    if (options.includeExternal === false)
      result = result.filter(location => classifyUri(location.uri) === 'workspace')
    if (options.pathPattern)
      result = result.filter(location => pathMatches(location.uri, options.pathPattern!))
    return result
  }
  catch (error) {
    logger.error('Failed to get references', error)
    throw error
  }
}

function toLocations(
  value: vscode.Location | vscode.Location[] | vscode.LocationLink[] | undefined,
): vscode.Location[] {
  if (!value)
    return []
  if (!Array.isArray(value))
    return [value]
  return value.flatMap((item) => {
    if ('targetUri' in item)
      return [new vscode.Location(item.targetUri, item.targetSelectionRange ?? item.targetRange)]
    return [item]
  })
}

function locationKey(location: vscode.Location): string {
  return `${location.uri.toString()}\0${location.range.start.line}:${location.range.start.character}-${location.range.end.line}:${location.range.end.character}`
}

export interface ReferenceOptions {
  includeDeclaration?: boolean
  includeExternal?: boolean
  pathPattern?: string
}
