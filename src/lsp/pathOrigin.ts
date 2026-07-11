import * as vscode from 'vscode'

export const defaultDependencyMarkers = [
  '/node_modules/',
  '/.pnpm/',
  '/.cargo/registry/',
  '/rustlib/',
  '/go/pkg/mod/',
  '/.m2/repository/',
  '/.gradle/caches/',
  '/.venv/',
  '/site-packages/',
  '/vendor/',
] as const

/** 判断一个 VS Code URI 属于项目源码、依赖还是工作区外部位置 */
export function classifyUri(uri: vscode.Uri): PathOrigin {
  if (uri.scheme !== 'file')
    return 'external'

  const path = normalizePath(uri.fsPath)
  const markers = vscode.workspace
    .getConfiguration('lsp-mcp')
    .get<string[]>('dependencyMarkers', [...defaultDependencyMarkers])
  if (markers.some(marker => path.includes(normalizePath(marker))))
    return 'dependency'

  return vscode.workspace.getWorkspaceFolder(uri) ? 'workspace' : 'external'
}

export function pathMatches(uri: vscode.Uri, pattern: string): boolean {
  return normalizePath(uri.fsPath || uri.toString()).includes(normalizePath(pattern))
}

function normalizePath(value: string): string {
  return value.replaceAll('\\', '/').toLowerCase()
}

export type PathOrigin = 'workspace' | 'dependency' | 'external'
