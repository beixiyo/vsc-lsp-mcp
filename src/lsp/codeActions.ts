import { randomUUID } from 'node:crypto'
import * as vscode from 'vscode'
import { formatRange, getFile } from '../transform/flatten'
import { assertTextOnlyWorkspaceEdit } from './rename'
import { getDocument } from './tools'

const ACTION_TTL_MS = 5 * 60 * 1000
const transactions = new Map<string, ActionTransaction>()

/** 查询指定位置的可编辑 Code Action，不执行其中携带的 command */
export async function getCodeActions(
  uri: string,
  line: number,
  character: number,
  actionKind?: string,
): Promise<CodeActionSummary[]> {
  purgeExpired()
  const document = await requireDocument(uri)
  const position = new vscode.Position(line, character)
  const actions = await requestActions(
    document.uri,
    new vscode.Range(position, position),
    actionKind,
  )

  const summaries: CodeActionSummary[] = []
  for (const action of actions) {
    if (!action.edit || countEdits(action.edit) === 0)
      continue
    try {
      assertTextOnlyWorkspaceEdit(action.edit, `Code action "${action.title}"`)
    }
    catch {
      continue
    }
    const actionId = await storeTransaction(action.edit, action.title, false)
    summaries.push({
      actionId,
      title: action.title,
      kind: action.kind?.value,
      preferred: action.isPreferred || undefined,
    })
  }
  return summaries
}

/** 将已查询的 action 标记为已预览，并返回紧凑编辑摘要 */
export async function previewCodeAction(actionId: string): Promise<CodeActionPreview> {
  purgeExpired()
  const transaction = requireTransaction(actionId)
  await assertResourcesUnchanged(transaction.resources)
  transaction.versions = await captureVersions(transaction.edit)
  transaction.previewed = true
  return summarize(actionId, transaction)
}

/** 为整个文档生成 fix-all 预览；无 fix-all 时聚合诊断位置上的 quickfix */
export async function previewDocumentFix(uri: string): Promise<CodeActionPreview> {
  purgeExpired()
  const document = await requireDocument(uri)
  const fullRange = new vscode.Range(
    new vscode.Position(0, 0),
    document.lineAt(Math.max(0, document.lineCount - 1)).range.end,
  )
  const fixAll = await requestActions(document.uri, fullRange, vscode.CodeActionKind.SourceFixAll.value)
  const fixAllEdit = fixAll.find(action => action.edit && countEdits(action.edit) > 0)?.edit
  const edit = fixAllEdit ?? await collectQuickFixes(document)
  if (!edit || countEdits(edit) === 0)
    throw new Error('No editable document fixes found')
  assertTextOnlyWorkspaceEdit(edit, 'Document fix')

  const actionId = await storeTransaction(edit, fixAllEdit ? 'Fix all in document' : 'Quick fixes in document', false)
  return await previewCodeAction(actionId)
}

/** 应用一次已预览的 Code Action，并保存所有目标文档 */
export async function applyCodeAction(actionId: string): Promise<CodeActionApplied> {
  purgeExpired()
  const transaction = requireTransaction(actionId)
  if (!transaction.previewed)
    throw new Error('Code action must be previewed before apply')
  transactions.delete(actionId)

  await assertFresh(transaction)
  if (!await vscode.workspace.applyEdit(transaction.edit))
    throw new Error('Code action edit could not be applied')

  const documents = await openTargetDocuments(transaction.edit)
  const saved = await Promise.all(documents.map(document => document.save()))
  if (saved.some(result => !result))
    throw new Error('Code action was applied but one or more documents could not be saved')

  return {
    actionId,
    filesChanged: countFiles(transaction.edit),
    editsCount: countEdits(transaction.edit),
    savedToDisk: true,
  }
}

async function collectQuickFixes(document: vscode.TextDocument): Promise<vscode.WorkspaceEdit | undefined> {
  const diagnostics = vscode.languages.getDiagnostics(document.uri)
  const combined = new vscode.WorkspaceEdit()
  const seen = new Set<string>()

  for (const diagnostic of diagnostics) {
    const actions = await requestActions(document.uri, diagnostic.range, vscode.CodeActionKind.QuickFix.value)
    const action = actions.find(action => action.isPreferred && action.edit)
      ?? actions.find(action => action.edit)

    if (!action?.edit)
      continue

    for (const [target, edits] of action.edit.entries()) {
      for (const edit of edits) {
        const key = `${target.toString()}:${formatRange(edit.range)}:${edit.newText}`

        if (seen.has(key) || overlapsExisting(combined, target, edit.range))
          continue
        seen.add(key)
        combined.replace(target, edit.range, edit.newText)
      }
    }
  }
  return countEdits(combined) > 0 ? combined : undefined
}

function overlapsExisting(edit: vscode.WorkspaceEdit, uri: vscode.Uri, range: vscode.Range): boolean {
  const existing = edit.entries().find(([target]) => target.toString() === uri.toString())?.[1] ?? []
  return existing.some(item => rangesOverlap(item.range, range))
}

function rangesOverlap(left: vscode.Range, right: vscode.Range): boolean {
  return comparePosition(left.start, right.end) < 0 && comparePosition(right.start, left.end) < 0
}

function comparePosition(left: vscode.Position, right: vscode.Position): number {
  return left.line - right.line || left.character - right.character
}

async function requestActions(
  uri: vscode.Uri,
  range: vscode.Range,
  actionKind?: string,
): Promise<vscode.CodeAction[]> {
  const actions = await vscode.commands.executeCommand<(vscode.CodeAction | vscode.Command)[]>(
    'vscode.executeCodeActionProvider',
    uri,
    range,
    actionKind,
    100,
  ) ?? []
  return actions.filter(isCodeAction)
}

function isCodeAction(action: vscode.CodeAction | vscode.Command): action is vscode.CodeAction {
  return 'title' in action && ('edit' in action || 'kind' in action || 'diagnostics' in action || 'isPreferred' in action)
}

async function storeTransaction(edit: vscode.WorkspaceEdit, title: string, previewed: boolean): Promise<string> {
  const actionId = randomUUID().replaceAll('-', '').slice(0, 24)
  transactions.set(actionId, {
    edit,
    title,
    previewed,
    expiresAt: Date.now() + ACTION_TTL_MS,
    resources: await captureResourceSnapshots(edit),
    versions: new Map(),
  })
  return actionId
}

async function captureResourceSnapshots(edit: vscode.WorkspaceEdit): Promise<Map<string, ResourceSnapshot>> {
  const snapshots = new Map<string, ResourceSnapshot>()
  for (const [uri, edits] of edit.entries()) {
    if (edits.length === 0)
      continue

    const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri.toString())
    if (document) {
      snapshots.set(uri.toString(), { uri, version: document.version })
      continue
    }

    const stat = await vscode.workspace.fs.stat(uri)
    snapshots.set(uri.toString(), { uri, mtime: stat.mtime, size: stat.size })
  }
  return snapshots
}

async function assertResourcesUnchanged(resources: Map<string, ResourceSnapshot>): Promise<void> {
  for (const [key, snapshot] of resources) {
    const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === key)
    if (snapshot.version != null) {
      if (!document || document.version !== snapshot.version)
        throw new Error(`Code action is stale for ${key}; request code_actions again`)
      continue
    }

    if (document?.isDirty)
      throw new Error(`Code action is stale for ${key}; request code_actions again`)

    const stat = await vscode.workspace.fs.stat(snapshot.uri)
    if (stat.mtime !== snapshot.mtime || stat.size !== snapshot.size)
      throw new Error(`Code action is stale for ${key}; request code_actions again`)
  }
}

function summarize(actionId: string, transaction: ActionTransaction): CodeActionPreview {
  const edits = transaction.edit.entries().flatMap(([uri, textEdits]) => textEdits.map(edit => ({
    file: getFile(uri),
    range: formatRange(edit.range),
    newText: edit.newText,
  })))

  return {
    actionId,
    title: transaction.title,
    expiresAt: transaction.expiresAt,
    filesChanged: new Set(edits.map(edit => edit.file)).size,
    edits,
  }
}

async function captureVersions(edit: vscode.WorkspaceEdit): Promise<Map<string, number>> {
  const versions = new Map<string, number>()

  for (const [uri, edits] of edit.entries()) {
    if (edits.length === 0)
      continue

    const document = await vscode.workspace.openTextDocument(uri)
    versions.set(uri.toString(), document.version)
  }

  return versions
}

async function assertFresh(transaction: ActionTransaction): Promise<void> {
  for (const [uri, version] of transaction.versions) {
    const document = vscode.workspace.textDocuments.find(document => document.uri.toString() === uri)

    if (!document || document.version !== version)
      throw new Error(`Code action preview is stale for ${uri}`)
  }
}

async function openTargetDocuments(edit: vscode.WorkspaceEdit): Promise<vscode.TextDocument[]> {
  return await Promise.all(edit.entries()
    .filter(([, edits]) => edits.length > 0)
    .map(([uri]) => vscode.workspace.openTextDocument(uri)))
}

function requireTransaction(actionId: string): ActionTransaction {
  const transaction = transactions.get(actionId)
  if (!transaction)
    throw new Error('Code action was not found, expired, or already applied')
  return transaction
}

function purgeExpired(): void {
  const now = Date.now()
  for (const [id, transaction] of transactions) {
    if (transaction.expiresAt < now)
      transactions.delete(id)
  }
}

function countFiles(edit: vscode.WorkspaceEdit): number {
  return edit.entries().filter(([, edits]) => edits.length > 0).length
}

function countEdits(edit: vscode.WorkspaceEdit): number {
  return edit.entries().reduce((total, [, edits]) => total + edits.length, 0)
}

async function requireDocument(uri: string): Promise<vscode.TextDocument> {
  const document = await getDocument(uri)
  if (!document)
    throw new Error(`Failed to find document: ${uri}`)
  return document
}

interface ActionTransaction {
  edit: vscode.WorkspaceEdit
  title: string
  previewed: boolean
  expiresAt: number
  resources: Map<string, ResourceSnapshot>
  versions: Map<string, number>
}

interface ResourceSnapshot {
  uri: vscode.Uri
  version?: number
  mtime?: number
  size?: number
}

export interface CodeActionSummary {
  actionId: string
  title: string
  kind?: string
  preferred?: boolean
}

export interface CodeActionPreview {
  actionId: string
  title: string
  expiresAt: number
  filesChanged: number
  edits: { file: string, range: string, newText: string }[]
}

export interface CodeActionApplied {
  actionId: string
  filesChanged: number
  editsCount: number
  savedToDisk: boolean
}
