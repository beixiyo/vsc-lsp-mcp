import { randomUUID } from 'node:crypto'
import * as vscode from 'vscode'
import { formatRange, getFile } from '../transform/flatten'
import { getDocument } from './tools'

const RENAME_TTL_MS = 5 * 60 * 1000
const transactions = new Map<string, RenameTransaction>()

/** 可选预检符号范围；provider 未实现 prepareRename 时回退到当前单词 */
export async function prepareRename(uri: string, line: number, character: number): Promise<PrepareRenameResult> {
  const document = await requireDocument(uri)
  const position = new vscode.Position(line, character)
  const prepared = await vscode.commands.executeCommand<vscode.Range | {
    range: vscode.Range
    placeholder: string
  }>('vscode.prepareRename', document.uri, position)
  const fallback = document.getWordRangeAtPosition(position)
  const range = prepared && 'range' in prepared ? prepared.range : prepared ?? fallback
  if (!range)
    throw new Error('No renameable symbol found at this position')
  return {
    range: formatRange(range),
    placeholder: prepared && 'placeholder' in prepared
      ? prepared.placeholder
      : document.getText(range),
  }
}

/** 获取真实 WorkspaceEdit 并创建无副作用的单次预览事务 */
export async function previewRename(
  uri: string,
  line: number,
  character: number,
  newName: string,
): Promise<RenamePreview> {
  purgeExpired()
  const document = await requireDocument(uri)
  const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
    'vscode.executeDocumentRenameProvider',
    document.uri,
    new vscode.Position(line, character),
    newName,
  )
  if (!edit || edit.entries().every(([, edits]) => edits.length === 0))
    throw new Error('Rename returned no changes')
  assertTextOnlyWorkspaceEdit(edit, 'Rename')

  const renameId = randomUUID().replaceAll('-', '').slice(0, 24)
  const expiresAt = Date.now() + RENAME_TTL_MS
  const versions = new Map<string, number>()
  const edits = edit.entries().flatMap(([target, textEdits]) => {
    return textEdits.map(textEdit => ({
      file: getFile(target),
      range: formatRange(textEdit.range),
      newText: textEdit.newText,
    }))
  })
  for (const [target, textEdits] of edit.entries()) {
    if (textEdits.length === 0)
      continue
    const targetDocument = await vscode.workspace.openTextDocument(target)
    versions.set(target.toString(), targetDocument.version)
  }
  transactions.set(renameId, { edit, expiresAt, versions })
  return {
    renameId,
    newName,
    expiresAt,
    filesChanged: new Set(edits.map(edit => edit.file)).size,
    edits,
  }
}

/** VS Code 无法枚举 WorkspaceEdit 的文件级操作，因此安全预览只接受纯文本编辑 */
export function assertTextOnlyWorkspaceEdit(edit: vscode.WorkspaceEdit, label: string): void {
  const textResources = edit.entries().filter(([, edits]) => edits.length > 0).length
  if (edit.size !== textResources)
    throw new Error(`${label} contains file operations that cannot be safely previewed`)
}

/** 校验预览仍新鲜后应用并保存全部目标文档 */
export async function applyRename(renameId: string): Promise<RenameApplied> {
  purgeExpired()
  const transaction = transactions.get(renameId)
  if (!transaction)
    throw new Error('Rename must be previewed and must not be expired or reused')
  transactions.delete(renameId)

  for (const [uri, version] of transaction.versions) {
    const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri)
    if (!document || document.version !== version)
      throw new Error(`Rename preview is stale for ${uri}`)
  }

  if (!await vscode.workspace.applyEdit(transaction.edit))
    throw new Error('Rename edit could not be applied')

  const targets = new Set(transaction.edit.entries().map(([uri]) => uri.toString()))
  const documents = await Promise.all([...targets].map(uri => vscode.workspace.openTextDocument(vscode.Uri.parse(uri))))
  const saved = await Promise.all(documents.map(document => document.save()))
  if (saved.some(result => !result))
    throw new Error('Rename was applied but one or more documents could not be saved')

  const entries = transaction.edit.entries()
  return {
    renameId,
    filesChanged: entries.filter(([, edits]) => edits.length > 0).length,
    editsCount: entries.reduce((total, [, edits]) => total + edits.length, 0),
    savedToDisk: true,
  }
}

function purgeExpired(): void {
  const now = Date.now()
  for (const [id, transaction] of transactions) {
    if (transaction.expiresAt < now)
      transactions.delete(id)
  }
}

async function requireDocument(uri: string): Promise<vscode.TextDocument> {
  const document = await getDocument(uri)
  if (!document)
    throw new Error(`Failed to find document: ${uri}`)
  return document
}

interface RenameTransaction {
  edit: vscode.WorkspaceEdit
  expiresAt: number
  versions: Map<string, number>
}

export interface PrepareRenameResult {
  range: string
  placeholder: string
}

export interface RenamePreview {
  renameId: string
  newName: string
  expiresAt: number
  filesChanged: number
  edits: { file: string, range: string, newText: string }[]
}

export interface RenameApplied {
  renameId: string
  filesChanged: number
  editsCount: number
  savedToDisk: boolean
}
