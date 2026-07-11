import type { ExecuteLspInput } from '../protocol'
import {
  applyCodeAction,
  applyRename,
  getClassFileContents,
  getCodeActions,
  getDeclarations,
  getDefinition,
  getDiagnostics,
  getDocumentHighlights,
  getDocumentLinks,
  getDocumentSymbols,
  getHover,
  getImplementations,
  getIncomingCalls,
  getInlayHints,
  getOutgoingCalls,
  getReferences,
  getSignatureHelp,
  getTypeDefinition,
  getWorkspaceSymbols,
  prepareCallHierarchy,
  prepareRename,
  previewCodeAction,
  previewDocumentFix,
  previewRename,
} from '../lsp'
import { validateExecuteLspInput } from '../protocol'
import { transform } from '../transform'

/** 在当前 VS Code 窗口中执行经过 Broker 路由的 LSP 操作 */
export async function executeLspOperation(input: ExecuteLspInput): Promise<string> {
  validateExecuteLspInput(input)

  const {
    operation,
    uri,
    newName,
    query,
    symbolKinds,
    includeDeclaration,
    includeExternal,
    pathPattern,
    severities,
    sources,
    codes,
    startLine,
    endLine,
    callId,
    renameId,
    actionId,
    actionKind,
  } = input
  const line = (input.line ?? 1) - 1
  const character = (input.character ?? 1) - 1

  switch (operation) {
    // 函数签名与代码导航
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

    // 符号说明与语义位置
    case 'hover':
      return transform.formatHover(await getHover(uri, line, character))
    case 'references':
      return transform.formatLocations(await getReferences(uri, line, character, {
        includeDeclaration,
        includeExternal,
        pathPattern,
      }), 'References')
    case 'document_highlight':
      return transform.formatDocumentHighlights(await getDocumentHighlights(uri, line, character))

    // 文档元数据与符号检索
    case 'document_links':
      return transform.formatDocumentLinks(await getDocumentLinks(uri))
    case 'inlay_hints':
      return transform.formatInlayHints(await getInlayHints(uri, startLine, endLine))
    case 'document_symbols':
      return transform.formatDocumentSymbols(await getDocumentSymbols(uri, query, symbolKinds))
    case 'workspace_symbols':
      return transform.formatWorkspaceSymbols(await getWorkspaceSymbols(query!))

    // 文件与工作区诊断
    case 'diagnostics':
      return transform.formatDiagnostics(getDiagnostics(uri, false, { severities, sources, codes }), false)
    case 'workspace_diagnostics':
      return transform.formatDiagnostics(getDiagnostics(uri, true, { severities, sources, codes }), true)

    // 单点与全文件 Code Action 事务
    case 'code_actions':
      return transform.formatCodeActions(await getCodeActions(uri, line, character, actionKind))
    case 'code_action_preview':
      return transform.formatCodeActionPreview(await previewCodeAction(actionId!))
    case 'fix_document_preview':
      return transform.formatCodeActionPreview(await previewDocumentFix(uri), true)
    case 'code_action_apply':
      return transform.formatCodeActionApplied(await applyCodeAction(actionId!))

    // Java 依赖源码读取
    case 'class_file_contents':
      return transform.formatClassFile(await getClassFileContents(uri))

    // 符号重命名事务
    case 'prepare_rename':
      return transform.formatPrepareRename(await prepareRename(uri, line, character))
    case 'rename_preview':
      return transform.formatRenamePreview(await previewRename(uri, line, character, newName!))
    case 'rename_apply':
      return transform.formatRenameApplied(await applyRename(renameId!))

    // 可递归调用层级
    case 'prepare_call_hierarchy': {
      const rawItems = await prepareCallHierarchy(uri, line, character)
      return transform.formatCallHierarchyItems(rawItems)
    }
    case 'incoming_calls':
      return transform.formatIncomingCalls(await getIncomingCalls(callId!, includeExternal))
    case 'outgoing_calls':
      return transform.formatOutgoingCalls(await getOutgoingCalls(callId!, includeExternal))
  }
}
