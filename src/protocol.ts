import { hasUriScheme, isFileUri, isNativeAbsolutePath } from './pathInput'

export const lspOperations = [
  'completions',
  'signature_help',
  'definition',
  'declaration',
  'type_definition',
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

export const lspToolIntroduction = 'Execute an LSP operation through the matching VS Code instance.'

export const pathAndPositionDescription = `PATHS AND POSITIONS
- Pass a native absolute path. Unix: /home/user/file.ts. Windows: C:/work/file.ts.
- Plain paths are recommended; do not manually construct file:// URIs. Existing special URIs may be passed unchanged.
- Input and output positions are 1-based. Output range or namePosition \`45:17-45:32\` can be reused as line=45, character=17.
- Do not guess symbol positions. For a known file, call document_symbols first. For a project search, call workspace_symbols with a non-empty query, then reuse the returned range start or namePosition.`

export const operationIntentDescription = `CHOOSE BY INTENT
No position required:
- document_symbols: outline symbols in one file.
- workspace_symbols: search project symbols; query is required and must not be empty.
- class_file_contents: get Java/JDT decompiled source; requires an existing jdt:// URI and may be unavailable without a Java extension.

Symbol position required:
- hover: signature and documentation.
- definition, declaration, type_definition, implementation: navigation locations.
- references: project references grouped by file.
- rename: rename a symbol across the workspace; newName is required.

Call-site position required:
- completions: suggestions at the cursor or expression position.
- signature_help: pass a position inside the intended call argument.

Call hierarchy:
- symbol_at_position: prepare the hierarchy item at a symbol position.
- incoming_calls, outgoing_calls: prepare at the supplied symbol position, then return callers or callees. Reuse namePosition from document_symbols or a previous call-hierarchy result.`

export const lspSafetyDescription = `READ AND WRITE SAFETY
- All operations are read-only except rename.
- rename immediately applies a VS Code WorkspaceEdit. It has no preview, transaction ID, stale check, rollback guarantee, or explicit save-to-disk guarantee. Inspect symbols/references first and use it only when immediate workspace modification is intended.
- rename_resource is a separate tool and also modifies the workspace immediately.
- Primary list results are compact and limited by the lsp-mcp.maxResults setting. Truncated output reports shown and total. Nested metadata is not counted unless stated otherwise.`

export const nativePathDescription = `Native absolute path or existing URI.
- Unix path example: /home/user/file.ts.
- Windows path example: C:/work/file.ts; backslashes are also accepted.
- Plain absolute paths are recommended and converted with VS Code Uri.file(). Do not manually construct file:// URIs.`

export const specialUriDescription = 'Existing special URIs may be passed unchanged. class_file_contents specifically requires a jdt:// URI from VS Code Java tooling.'

export const immediateWriteWarning = 'This operation immediately modifies the workspace and has no preview or rollback guarantee.'

const positionOperations = new Set<LspOperation>([
  'completions',
  'signature_help',
  'definition',
  'declaration',
  'type_definition',
  'implementation',
  'hover',
  'references',
  'rename',
  'symbol_at_position',
  'incoming_calls',
  'outgoing_calls',
])

/** 校验 Broker 与内部 Instance Server 共用的 LSP 输入契约 */
export function validateExecuteLspInput(input: ExecuteLspInput): void {
  if (!isAbsolutePathOrUri(input.uri))
    throw new Error('"uri" must be a native absolute Unix/Windows path or an existing URI')

  if (positionOperations.has(input.operation)) {
    if (!Number.isInteger(input.line) || (input.line ?? 0) < 1)
      throw new Error(`"${input.operation}" requires "line" as a 1-based positive integer`)
    if (!Number.isInteger(input.character) || (input.character ?? 0) < 1)
      throw new Error(`"${input.operation}" requires "character" as a 1-based positive integer`)
  }

  if (input.operation === 'workspace_symbols' && !input.query?.trim())
    throw new Error('"workspace_symbols" requires a non-empty "query" parameter')

  if (input.operation === 'rename' && !input.newName?.trim())
    throw new Error('"rename" requires a non-empty "newName" parameter')

  if (input.operation === 'class_file_contents' && !/^jdt:\/\//i.test(input.uri))
    throw new Error('"class_file_contents" requires an existing jdt:// URI')
}

/** 校验资源重命名的路径输入，只允许本地绝对路径与 file URI */
export function validateRenameResourceInput(input: RenameResourceInput): void {
  for (const [name, value] of [['oldUri', input.oldUri], ['newUri', input.newUri]] as const) {
    if (!value?.trim())
      throw new Error(`"${name}" must not be empty`)
    if (!isNativeAbsolutePath(value) && !isFileUri(value))
      throw new Error(`"${name}" must be a native absolute path or file URI`)
  }
}

function isAbsolutePathOrUri(value: string): boolean {
  return isNativeAbsolutePath(value) || hasUriScheme(value)
}

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
