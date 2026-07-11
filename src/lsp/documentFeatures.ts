import * as vscode from 'vscode'
import { getDocument } from './tools'

export async function getDocumentHighlights(uri: string, line: number, character: number) {
  const document = await requireDocument(uri)
  return await vscode.commands.executeCommand<vscode.DocumentHighlight[]>(
    'vscode.executeDocumentHighlights',
    document.uri,
    new vscode.Position(line, character),
  ) ?? []
}

export async function getDocumentLinks(uri: string) {
  const document = await requireDocument(uri)
  return await vscode.commands.executeCommand<vscode.DocumentLink[]>(
    'vscode.executeLinkProvider',
    document.uri,
    100,
  ) ?? []
}

export async function getInlayHints(uri: string, startLine?: number, endLine?: number) {
  const document = await requireDocument(uri)
  const lastLine = Math.max(document.lineCount - 1, 0)
  if (startLine != null && startLine > document.lineCount)
    throw new Error('startLine exceeds the document line count')
  const start = Math.min((startLine ?? 1) - 1, lastLine)
  const end = Math.min((endLine ?? document.lineCount) - 1, lastLine)
  const range = new vscode.Range(start, 0, end, document.lineAt(end).text.length)
  return await vscode.commands.executeCommand<vscode.InlayHint[]>(
    'vscode.executeInlayHintProvider',
    document.uri,
    range,
  ) ?? []
}

async function requireDocument(uri: string): Promise<vscode.TextDocument> {
  const document = await getDocument(uri)
  if (!document)
    throw new Error(`Failed to find document: ${uri}`)
  return document
}
