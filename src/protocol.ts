import { hasUriScheme, isFileUri, isNativeAbsolutePath } from './pathInput'

export const lspOperations = [
  'signature_help',
  'definition',
  'declaration',
  'type_definition',
  'implementation',
  'hover',
  'references',
  'document_highlight',
  'document_links',
  'inlay_hints',
  'document_symbols',
  'workspace_symbols',
  'diagnostics',
  'workspace_diagnostics',
  'code_actions',
  'code_action_preview',
  'fix_document_preview',
  'code_action_apply',
  'class_file_contents',
  'prepare_rename',
  'rename_preview',
  'rename_apply',
  'prepare_call_hierarchy',
  'incoming_calls',
  'outgoing_calls',
] as const

export const symbolKindFilters = [
  'file',
  'module',
  'namespace',
  'package',
  'class',
  'method',
  'property',
  'field',
  'constructor',
  'enum',
  'interface',
  'function',
  'variable',
  'constant',
  'string',
  'number',
  'boolean',
  'array',
  'object',
  'key',
  'null',
  'enum_member',
  'struct',
  'event',
  'operator',
  'type_parameter',
] as const

export const diagnosticSeverityFilters = ['error', 'warning', 'information', 'hint'] as const

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
- diagnostics: diagnostics for one file; optional severities, sources, and codes filters.
- workspace_diagnostics: diagnostics under a workspace path; optional severities, sources, and codes filters.
- code_action_preview: inspect one actionId returned by code_actions without modifying files.
- fix_document_preview: preview editable source.fixAll or quick-fix edits for the whole document.
- document_links: navigable targets in one document.
- inlay_hints: inferred types and parameter-name hints; optionally accepts startLine and endLine.
- class_file_contents: get Java/JDT decompiled source; requires an existing jdt:// URI and may be unavailable without a Java extension.

Symbol position required:
- hover: signature and documentation.
- definition, declaration, type_definition, implementation: navigation locations.
- references: project references grouped by file.
- document_highlight: semantic occurrences in the current document.
- code_actions: list editable actions at a position; optional actionKind filters the provider request.
- prepare_rename: validate a symbol and return its range and placeholder.
- rename_preview: create a no-side-effect WorkspaceEdit preview; newName is required.

Call-site position required:
- signature_help: pass a position inside the intended call argument.

Call hierarchy:
- prepare_call_hierarchy: prepare nodes at a symbol position and return callId values.
- incoming_calls, outgoing_calls: query one graph layer by callId; returned nodes include new callId values for recursive traversal.`

export const lspSafetyDescription = `READ AND WRITE SAFETY
- All operations are read-only except rename_apply and code_action_apply.
- Rename: prepare_rename -> rename_preview(newName) -> rename_apply(renameId). Preview never modifies files; apply rejects expired, stale, or reused transactions and saves affected documents.
- Code actions: code_actions -> code_action_preview(actionId) -> code_action_apply(actionId). For a whole file use fix_document_preview -> code_action_apply(actionId). Command-only actions are never executed.
- rename_resource is a separate tool and also modifies the workspace immediately.
- Primary list results are compact and limited by the lsp-mcp.maxResults setting. Truncated output reports shown and total. Nested metadata is not counted unless stated otherwise.`

export const nativePathDescription = `Native absolute path or existing URI.
- Unix path example: /home/user/file.ts.
- Windows path example: C:/work/file.ts; backslashes are also accepted.
- Plain absolute paths are recommended and converted with VS Code Uri.file(). Do not manually construct file:// URIs.`

export const specialUriDescription = 'Existing special URIs may be passed unchanged. class_file_contents specifically requires a jdt:// URI from VS Code Java tooling.'

export const immediateWriteWarning = 'This operation immediately modifies the workspace and has no preview or rollback guarantee.'

const positionOperations = new Set<LspOperation>([
  'signature_help',
  'definition',
  'declaration',
  'type_definition',
  'implementation',
  'hover',
  'references',
  'document_highlight',
  'prepare_rename',
  'rename_preview',
  'prepare_call_hierarchy',
  'code_actions',
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

  if (input.operation === 'rename_preview' && !input.newName?.trim())
    throw new Error('"rename_preview" requires a non-empty "newName" parameter')

  if (input.operation === 'rename_apply' && !input.renameId?.trim())
    throw new Error('"rename_apply" requires a non-empty "renameId" parameter')

  if (input.operation === 'code_action_preview' && !input.actionId?.trim())
    throw new Error('"code_action_preview" requires a non-empty "actionId" parameter')

  if (input.operation === 'code_action_apply' && !input.actionId?.trim())
    throw new Error('"code_action_apply" requires a non-empty "actionId" parameter')

  if ((input.operation === 'incoming_calls' || input.operation === 'outgoing_calls') && !input.callId?.trim())
    throw new Error(`"${input.operation}" requires a non-empty "callId" parameter`)

  if (input.operation === 'class_file_contents' && !/^jdt:\/\//i.test(input.uri))
    throw new Error('"class_file_contents" requires an existing jdt:// URI')

  if (input.operation === 'inlay_hints') {
    if (input.startLine != null && (!Number.isInteger(input.startLine) || input.startLine < 1))
      throw new Error('"startLine" must be a 1-based positive integer')
    if (input.endLine != null && (!Number.isInteger(input.endLine) || input.endLine < 1))
      throw new Error('"endLine" must be a 1-based positive integer')
    if (input.startLine != null && input.endLine != null && input.startLine > input.endLine)
      throw new Error('"startLine" must not exceed "endLine"')
  }
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
  symbolKinds?: SymbolKindFilter[]
  includeDeclaration?: boolean
  includeExternal?: boolean
  pathPattern?: string
  severities?: DiagnosticSeverityFilter[]
  sources?: string[]
  codes?: string[]
  startLine?: number
  endLine?: number
  callId?: string
  renameId?: string
  actionId?: string
  actionKind?: string
}

export type SymbolKindFilter = typeof symbolKindFilters[number]
export type DiagnosticSeverityFilter = typeof diagnosticSeverityFilters[number]

/** Broker 转发到 VS Code 实例的资源重命名请求 */
export interface RenameResourceInput {
  oldUri: string
  newUri: string
  overwrite?: boolean
}
