import { randomUUID } from 'node:crypto'
import * as vscode from 'vscode'
import { classifyUri } from './pathOrigin'
import { getDocument } from './tools'

/**
 * 调用层级适配器
 *
 * VS Code 的 incoming/outgoing 命令要求传回原始 CallHierarchyItem，无法只靠
 * 文件位置继续查询，因此这里为节点创建短期 callId，并在内存中保存原始对象
 * 每次展开返回的新节点也会获得 callId，使调用方可以逐层遍历调用图
 */
const NODE_TTL_MS = 5 * 60 * 1000
const nodes = new Map<string, StoredNode>()

/**
 * 在准确符号位置准备调用层级根节点
 *
 * @param uri 目标文档路径或 URI
 * @param line VS Code 使用的 0-based 行号
 * @param character VS Code 使用的 0-based 字符位置
 * @returns 带短期 callId 和来源分类的根节点
 */
export async function prepareCallHierarchy(
  uri: string,
  line: number,
  character: number,
): Promise<CallNode[]> {
  purgeExpired()
  const document = await getDocument(uri)
  if (!document)
    throw new Error(`Failed to find document: ${uri}`)
  const raw = await vscode.commands.executeCommand<
    vscode.CallHierarchyItem | vscode.CallHierarchyItem[]
  >('vscode.prepareCallHierarchy', document.uri, new vscode.Position(line, character))
  const items = !raw ? [] : Array.isArray(raw) ? raw : [raw]
  return items.map(storeNode)
}

/**
 * 查询直接调用当前节点的上游节点
 *
 * 返回结果会先按来源和符号类型排序，并可在截断前移除依赖与外部节点
 *
 * @param callId prepareCallHierarchy 或上一层结果返回的节点 ID
 * @param includeExternal 是否保留 dependency 和 external 节点
 */
export async function getIncomingCalls(
  callId: string,
  includeExternal = true,
): Promise<IncomingCallNode[]> {
  const source = requireNode(callId)
  const calls = await vscode.commands.executeCommand<vscode.CallHierarchyIncomingCall[]>(
    'vscode.provideIncomingCalls',
    source.item,
  ) ?? []
  return sortCalls(calls.map(call => ({
    node: storeNode(call.from),
    fromRanges: call.fromRanges,
  })), includeExternal)
}

/**
 * 查询当前节点直接调用的下游节点
 *
 * @param callId prepareCallHierarchy 或上一层结果返回的节点 ID
 * @param includeExternal 是否保留 dependency 和 external 节点
 */
export async function getOutgoingCalls(
  callId: string,
  includeExternal = true,
): Promise<OutgoingCallNode[]> {
  const source = requireNode(callId)
  const calls = await vscode.commands.executeCommand<vscode.CallHierarchyOutgoingCall[]>(
    'vscode.provideOutgoingCalls',
    source.item,
  ) ?? []
  return sortCalls(calls.map(call => ({
    node: storeNode(call.to),
    fromRanges: call.fromRanges,
  })), includeExternal)
}

/** 保存 VS Code 原始节点并生成可递归查询的短期 ID */
function storeNode(item: vscode.CallHierarchyItem): CallNode {
  const callId = randomUUID().replaceAll('-', '').slice(0, 24)
  const expiresAt = Date.now() + NODE_TTL_MS
  nodes.set(callId, { item, expiresAt })
  return { item, callId, expiresAt, origin: classifyUri(item.uri) }
}

/** 读取仍在有效期内的节点，伪造、过期或属于其他实例的 ID 会安全失败 */
function requireNode(callId: string): StoredNode {
  purgeExpired()
  const node = nodes.get(callId)
  if (!node)
    throw new Error('Call hierarchy node not found or expired')
  return node
}

/** 清理无人继续遍历的过期节点，避免实例长期运行时持续占用内存 */
function purgeExpired(): void {
  const now = Date.now()
  for (const [id, node] of nodes) {
    if (node.expiresAt < now)
      nodes.delete(id)
  }
}

/**
 * 在 maxResults 截断前过滤并排序调用节点
 *
 * 排序优先级：workspace > dependency > external；
 * 同来源内 Function/Constructor > Method > 其他符号
 */
function sortCalls<T extends CallResult>(calls: T[], includeExternal: boolean): T[] {
  const origins = { workspace: 0, dependency: 1, external: 2 }
  return calls
    .filter(call => includeExternal || call.node.origin === 'workspace')
    .sort((left, right) =>
      origins[left.node.origin] - origins[right.node.origin]
      || kindPriority(left.node.item.kind) - kindPriority(right.node.item.kind)
      || left.node.item.name.localeCompare(right.node.item.name),
    )
}

/** 将常用于理解调用关系的函数类符号排在属性和普通结构节点之前 */
function kindPriority(kind: vscode.SymbolKind): number {
  if (kind === vscode.SymbolKind.Function || kind === vscode.SymbolKind.Constructor)
    return 0
  if (kind === vscode.SymbolKind.Method)
    return 1
  return 2
}

/** 内存中保存的 VS Code 原始调用节点 */
interface StoredNode {
  item: vscode.CallHierarchyItem
  expiresAt: number
}

/** 对外输出的调用节点，包含递归查询所需的 callId 与路径来源 */
export interface CallNode extends StoredNode {
  callId: string
  origin: 'workspace' | 'dependency' | 'external'
}

/** incoming/outgoing 共用的节点与调用位置结构 */
interface CallResult {
  node: CallNode
  fromRanges: vscode.Range[]
}

/** 直接调用当前节点的上游调用关系 */
export type IncomingCallNode = CallResult

/** 当前节点直接调用的下游调用关系 */
export type OutgoingCallNode = CallResult
