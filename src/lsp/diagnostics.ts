import type { DiagnosticSeverityFilter } from '../protocol'
import * as vscode from 'vscode'
import { resolveUri } from './tools'

/** 读取一个文档或工作区内 VS Code 已持有的诊断并应用结构化筛选 */
export function getDiagnostics(
  uri: string,
  workspaceScope: boolean,
  filters: DiagnosticFilters = {},
): DiagnosticItem[] {
  const target = resolveUri(uri)
  const entries = workspaceScope
    ? vscode.languages.getDiagnostics()
    : [[target, vscode.languages.getDiagnostics(target)] as [vscode.Uri, vscode.Diagnostic[]]]
  const allowedSeverities = filters.severities?.length ? new Set(filters.severities) : undefined
  const allowedSources = filters.sources?.length
    ? new Set(filters.sources.map(value => value.toLowerCase()))
    : undefined
  const allowedCodes = filters.codes?.length
    ? new Set(filters.codes.map(value => value.toLowerCase()))
    : undefined

  return entries.flatMap(([documentUri, diagnostics]) => {
    if (workspaceScope && !isUnderTarget(documentUri, target))
      return []
    return diagnostics.filter((diagnostic) => {
      const severity = severityName(diagnostic.severity)
      const source = diagnostic.source?.toLowerCase()
      const code = diagnostic.code != null
        ? String(typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code).toLowerCase()
        : undefined
      return (!allowedSeverities || allowedSeverities.has(severity))
        && (!allowedSources || (source != null && allowedSources.has(source)))
        && (!allowedCodes || (code != null && allowedCodes.has(code)))
    }).map(diagnostic => ({ uri: documentUri, diagnostic }))
  })
}

function isUnderTarget(uri: vscode.Uri, target: vscode.Uri): boolean {
  if (uri.scheme !== target.scheme)
    return false
  const root = target.fsPath.replaceAll('\\', '/').replace(/\/$/, '')
  const path = uri.fsPath.replaceAll('\\', '/')
  const insensitive = process.platform === 'win32'
  const normalizedRoot = insensitive ? root.toLowerCase() : root
  const normalizedPath = insensitive ? path.toLowerCase() : path
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`)
}

function severityName(severity: vscode.DiagnosticSeverity): DiagnosticSeverityFilter {
  const names: DiagnosticSeverityFilter[] = ['error', 'warning', 'information', 'hint']
  return names[severity] ?? 'information'
}

export interface DiagnosticFilters {
  severities?: DiagnosticSeverityFilter[]
  sources?: string[]
  codes?: string[]
}

export interface DiagnosticItem {
  uri: vscode.Uri
  diagnostic: vscode.Diagnostic
}
