export const lspOperations = [
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

export const lspToolDescription = `Execute an LSP operation.

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

export const uriDescription = `URI or absolute file path.
- Plain path (no scheme): treated as absolute file path on disk, e.g. "/home/user/file.ts" or "C:/path/to/file.ts". Recommended for all file operations.
- URI with scheme (e.g. file://, jdt://): parsed directly. Scheme part is case-insensitive, path requires proper percent-encoding. Do NOT construct file:// URIs manually.
- For "class_file_contents": must be a jdt:// URI (scheme "jdt:").`

export const sourceUriDescription = `Source absolute file system path or URI.
- Plain paths are converted with VS Code's Uri.file().
- URI values retain their scheme, including remote workspace schemes.`

export const destinationUriDescription = `Destination absolute file system path or URI.
- Plain paths are converted with VS Code's Uri.file().
- URI values retain their scheme, including remote workspace schemes.`

/** Broker 支持的 LSP 操作名称 */
export type LspOperation = typeof lspOperations[number]

/** Broker 转发到 VS Code 实例的 LSP 请求 */
export interface ExecuteLspInput {
  operation: LspOperation
  uri: string
  line?: number
  character?: number
  newName?: string
  query?: string
}

/** Broker 转发到 VS Code 实例的资源重命名请求 */
export interface RenameResourceInput {
  oldUri: string
  newUri: string
  overwrite?: boolean
}
