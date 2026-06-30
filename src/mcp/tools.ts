import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { tMcp } from '../i18n'
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
  getWorkspaceSymbols,
  prepareCallHierarchy,
  rename,
} from '../lsp'
import { transform } from '../transform'

const ops = [
  'completions',
  'definition',
  'declaration',
  'implementation',
  'hover',
  'references',
  'document_symbols',
  'workspace_symbols',
  'class_file_contents',
  'rename',
  'symbol_at_position',
  'incoming_calls',
  'outgoing_calls',
] as const

const uriDesc = `URI or absolute file path.
- Plain path (no scheme): treated as absolute file path on disk, e.g. "/home/user/file.ts" or "C:/path/to/file.ts". Recommended for all file operations.
- URI with scheme (e.g. file://, jdt://): parsed directly. Scheme part is case-insensitive, path requires proper percent-encoding. Do NOT construct file:// URIs manually.
- For "class_file_contents": must be a jdt:// URI (scheme "jdt:").`

const positionOps = new Set([
  'completions',
  'definition',
  'declaration',
  'implementation',
  'hover',
  'references',
  'rename',
  'symbol_at_position',
  'incoming_calls',
  'outgoing_calls',
])

const toolDesc = `Execute an LSP operation.

IMPORTANT — All positions are 1-based:
- Input: line & character use 1-based indexing (matching editor display). VS Code shows "Ln 9, Col 16" → pass line=9, character=16.
- Output: all line/character values in results are also 1-based. You can directly use output positions (e.g. namePosition "9:16") as input for the next call (line=9, character=16) — no conversion needed.

Operations requiring line & character:
- hover: Get hover documentation (signature, JSDoc) at position. Returns: formatted documentation text.
- definition: Jump to symbol definition. Returns: file path + line range.
- declaration: Jump to symbol declaration (e.g. TypeScript .d.ts). Returns: file path + line range.
- implementation: Jump to implementation (for interfaces/abstract classes). Returns: file path + line range.
- references: Find all references of symbol. Returns: list of file paths + line ranges.
- completions: Code completions at position. Returns: up to 50 completion items with kind and detail.
- rename: Rename symbol across workspace. Requires newName. Returns: summary of files and edits changed.
- symbol_at_position: Get symbol metadata (name, kind, range, namePosition). Returns: call hierarchy item.
- incoming_calls: Find all callers of the function at position. Returns: caller list with namePosition for chaining.
- outgoing_calls: Find all callees of the function at position. Returns: callee list with namePosition for chaining.

Operations that do NOT need line/character:
- document_symbols: Get symbol outline of the file (only needs uri). Returns: hierarchical symbol tree.
- workspace_symbols: Search symbols across workspace by query (empty query returns all symbols, truncated by maxResults setting). Returns: matching symbols grouped by file.
- class_file_contents: Get decompiled Java class source via jdt:// URI (only needs uri). Returns: Java source code.`

export function addLspTools(server: McpServer) {
  server.registerTool(
    'execute_lsp',
    {
      title: tMcp('Execute LSP Operation'),
      description: tMcp(toolDesc),
      inputSchema: {
        operation: z.enum(ops).describe(tMcp('Which LSP operation to execute.')),
        uri: z.string().describe(tMcp(uriDesc)),
        line: z.number().int().min(1).optional().describe(tMcp('Line number (1-based, as shown in editor). Required for position-dependent operations.')),
        character: z.number().int().min(1).optional().describe(tMcp('Character offset (1-based, as shown in editor). Required for position-dependent operations.')),
        newName: z.string().optional().describe(tMcp('New symbol name. Required only for "rename".')),
        query: z.string().optional().describe(tMcp('Search query. Required only for "workspace_symbols".')),
      },
    },
    async ({ operation, uri, line: rawLine, character: rawChar, newName, query }) => {
      let line = 0
      let character = 0

      if (positionOps.has(operation)) {
        if (rawLine == null || rawChar == null) {
          throw new Error(`"${operation}" requires "line" and "character" parameters (1-based)`)
        }
        line = rawLine - 1
        character = rawChar - 1
      }

      let result: string

      switch (operation) {
        case 'completions':
          result = transform.formatCompletions(await getCompletions(uri, line, character))
          break
        case 'definition':
          result = transform.formatLocationsOrLinks(await getDefinition(uri, line, character), 'Definition')
          break
        case 'declaration':
          result = transform.formatLocationsOrLinks(await getDeclarations(uri, line, character), 'Declaration')
          break
        case 'implementation':
          result = transform.formatLocationsOrLinks(await getImplementations(uri, line, character), 'Implementation')
          break
        case 'hover':
          result = transform.formatHover(await getHover(uri, line, character))
          break
        case 'references':
          result = transform.formatLocations(await getReferences(uri, line, character), 'References')
          break
        case 'document_symbols':
          result = transform.formatDocumentSymbols(await getDocumentSymbols(uri))
          break
        case 'workspace_symbols':
          result = await transform.formatWorkspaceSymbols(await getWorkspaceSymbols(query ?? ''))
          break
        case 'class_file_contents':
          result = transform.formatClassFile(await getClassFileContents(uri))
          break
        case 'rename': {
          if (!newName)
            throw new Error('"rename" requires the "newName" parameter')
          const edit = await rename(uri, line, character, newName)
          result = transform.formatRename(edit, newName)
          break
        }
        case 'symbol_at_position': {
          const rawItems = await prepareCallHierarchy(uri, line, character)
          const items = !rawItems ? [] : (Array.isArray(rawItems) ? rawItems : [rawItems])
          result = transform.formatCallHierarchyItems(items)
          break
        }
        case 'incoming_calls':
          result = transform.formatIncomingCalls(await getIncomingCalls(uri, line, character))
          break
        case 'outgoing_calls':
          result = transform.formatOutgoingCalls(await getOutgoingCalls(uri, line, character))
          break
      }

      return { content: [{ type: 'text', text: result }] }
    },
  )
}
