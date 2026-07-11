import type { ExecuteLspInput } from '../protocol'
import {
  getClassFileContents,
  getCompletions,
  getDeclarations,
  getDefinition,
  getDocumentSymbols,
  getHover,
  getImplementations,
  getIncomingCalls,
  getOutgoingCalls,
  getReferences,
  getSignatureHelp,
  getTypeDefinition,
  getWorkspaceSymbols,
  prepareCallHierarchy,
  rename,
} from '../lsp'
import { validateExecuteLspInput } from '../protocol'
import { transform } from '../transform'

/** 在当前 VS Code 窗口中执行经过 Broker 路由的 LSP 操作 */
export async function executeLspOperation(input: ExecuteLspInput): Promise<string> {
  validateExecuteLspInput(input)

  const { operation, uri, newName, query } = input
  const line = (input.line ?? 1) - 1
  const character = (input.character ?? 1) - 1

  switch (operation) {
    case 'completions':
      return transform.formatCompletions(await getCompletions(uri, line, character))
    case 'signature_help':
      return transform.formatSignatureHelp(await getSignatureHelp(uri, line, character))
    case 'definition':
      return transform.formatLocationsOrLinks(await getDefinition(uri, line, character), 'Definition')
    case 'declaration':
      return transform.formatLocationsOrLinks(await getDeclarations(uri, line, character), 'Declaration')
    case 'type_definition':
      return transform.formatLocationsOrLinks(await getTypeDefinition(uri, line, character), 'Type Definition')
    case 'implementation':
      return transform.formatLocationsOrLinks(await getImplementations(uri, line, character), 'Implementation')
    case 'hover':
      return transform.formatHover(await getHover(uri, line, character))
    case 'references':
      return transform.formatLocations(await getReferences(uri, line, character), 'References')
    case 'document_symbols':
      return transform.formatDocumentSymbols(await getDocumentSymbols(uri))
    case 'workspace_symbols':
      return transform.formatWorkspaceSymbols(await getWorkspaceSymbols(query!))
    case 'class_file_contents':
      return transform.formatClassFile(await getClassFileContents(uri))
    case 'rename': {
      const edit = await rename(uri, line, character, newName!)
      return transform.formatRename(edit, newName!)
    }
    case 'symbol_at_position': {
      const rawItems = await prepareCallHierarchy(uri, line, character)
      const items = !rawItems ? [] : (Array.isArray(rawItems) ? rawItems : [rawItems])
      return transform.formatCallHierarchyItems(items)
    }
    case 'incoming_calls':
      return transform.formatIncomingCalls(await getIncomingCalls(uri, line, character))
    case 'outgoing_calls':
      return transform.formatOutgoingCalls(await getOutgoingCalls(uri, line, character))
  }
}
