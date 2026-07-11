import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/**
 * Get document symbols (outline) for a file.
 *
 * @param uri - The document URI
 * @returns Raw VSCode SymbolInformation[] or DocumentSymbol[]
 */
export async function getDocumentSymbols(
  uri: string,
  query?: string,
  symbolKinds?: readonly string[],
): Promise<(vscode.SymbolInformation | vscode.DocumentSymbol)[]> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`Failed to find document: ${uri}`)
    }

    logger.info(`Getting document symbols: ${uri}`)

    const symbols = await vscode.commands.executeCommand<(
      vscode.SymbolInformation[] | vscode.DocumentSymbol[]
    )>(
      'vscode.executeDocumentSymbolProvider',
      document.uri,
      )

    return filterSymbols(symbols || [], query, symbolKinds)
  }
  catch (error) {
    logger.error('Failed to get document symbols', error)
    throw error
  }
}

function filterSymbols(
  symbols: (vscode.SymbolInformation | vscode.DocumentSymbol)[],
  query?: string,
  symbolKinds?: readonly string[],
): (vscode.SymbolInformation | vscode.DocumentSymbol)[] {
  const normalizedQuery = query?.toLowerCase()
  const allowedKinds = symbolKinds?.length
    ? new Set(symbolKinds.map(kind => kind.replaceAll('_', '')))
    : undefined
  const filtered: (vscode.SymbolInformation | vscode.DocumentSymbol)[] = []

  for (const symbol of symbols) {
    const children = 'children' in symbol
      ? filterSymbols([...symbol.children], query, symbolKinds) as vscode.DocumentSymbol[]
      : []
    const kind = vscode.SymbolKind[symbol.kind]?.toLowerCase()
    const nameMatches = !normalizedQuery || symbol.name.toLowerCase().includes(normalizedQuery)
    const kindMatches = !allowedKinds || (kind != null && allowedKinds.has(kind))

    if (nameMatches && kindMatches) {
      if ('children' in symbol) {
        filtered.push({
          name: symbol.name,
          detail: symbol.detail,
          kind: symbol.kind,
          tags: symbol.tags,
          range: symbol.range,
          selectionRange: symbol.selectionRange,
          children,
        } as vscode.DocumentSymbol)
      }
      else {
        filtered.push(symbol)
      }
    }
    else {
      filtered.push(...children)
    }
  }

  return filtered
}
