import { createHash, randomUUID } from 'node:crypto'
import { chmod, lstat, mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import {
  PRIVATE_DIRECTORY_MODE,
  PRIVATE_FILE_MODE,
  SHARED_ACCESS_MODE_MASK,
} from '../filePermissions'

const INSTANCE_TTL_MS = 15_000

/** 获取当前用户的 Broker 与实例共享注册目录 */
export function getRegistryRoot(): string {
  return process.env.VSC_LSP_MCP_REGISTRY || join(tmpdir(), `vsc-lsp-mcp-${userIdentity()}`)
}

/** 获取实例记录所在目录 */
export function getInstancesDir(registryRoot = getRegistryRoot()): string {
  return join(registryRoot, 'instances')
}

/** 创建注册目录并收紧访问权限，实例 token 不应对其他用户公开 */
export async function createRegistry(registryRoot = getRegistryRoot()): Promise<void> {
  await ensurePrivateDirectory(registryRoot)
  await ensurePrivateDirectory(getInstancesDir(registryRoot))
}

/** 根据工作区根目录生成稳定项目 ID 和本次窗口唯一的实例 ID */
export function createInstanceIdentity(roots: string[]): Pick<InstanceRecord, 'instanceId' | 'projectId'> {
  const normalizedRoots = roots.map(normalizeRoutingPath).sort()
  const projectId = `${basename(normalizedRoots[0] || 'workspace')}-${createHash('sha256')
    .update(normalizedRoots.join('\0'))
    .digest('hex')
    .slice(0, 8)}`

  return {
    projectId,
    instanceId: `${projectId}:${process.pid}:${randomUUID().slice(0, 8)}`,
  }
}

/** 原子写入实例记录，供共享 Broker 发现和路由 */
export async function writeInstance(
  record: InstanceRecord,
  registryRoot = getRegistryRoot(),
): Promise<void> {
  await createRegistry(registryRoot)
  const path = instancePath(record.instanceId, registryRoot)
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, JSON.stringify(record), { mode: PRIVATE_FILE_MODE })
  await rename(temporaryPath, path)
}

/** 删除指定 VS Code 窗口的实例记录 */
export async function removeInstance(
  instanceId: string,
  registryRoot = getRegistryRoot(),
): Promise<void> {
  await rm(instancePath(instanceId, registryRoot), { force: true })
}

/** 读取仍在 TTL 内的实例，并清理过期或损坏的记录 */
export async function listInstances(
  registryRoot = getRegistryRoot(),
  now = Date.now(),
): Promise<InstanceRecord[]> {
  await createRegistry(registryRoot)
  const names = await readdir(getInstancesDir(registryRoot)).catch(() => [])
  const records: InstanceRecord[] = []

  for (const name of names) {
    if (!name.endsWith('.json'))
      continue

    const path = join(getInstancesDir(registryRoot), name)
    try {
      const record = JSON.parse(await readFile(path, 'utf8')) as InstanceRecord
      if (!isInstanceRecord(record) || now - record.updatedAt > INSTANCE_TTL_MS) {
        await rm(path, { force: true })
        continue
      }
      records.push(record)
    }
    catch {
      await rm(path, { force: true })
    }
  }

  return records.sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 移除仅供 Broker 内部使用的 endpoint 和 token */
export function publicInstance(record: InstanceRecord): PublicInstance {
  const { token: _token, endpoint: _endpoint, ...instance } = record
  return instance
}

/** 统一路径分隔符、尾部斜杠和 Windows 大小写，供身份计算与路由复用 */
export function normalizeRoutingPath(value: string): string {
  let normalized = value.replaceAll('\\', '/')
  if (normalized !== '/' && !/^[a-z]:\/$/i.test(normalized))
    normalized = normalized.replace(/\/+$/, '')
  return process.platform === 'win32' ? normalized.toLowerCase() : normalized
}

async function ensurePrivateDirectory(path: string): Promise<void> {
  await mkdir(path, { recursive: true, mode: PRIVATE_DIRECTORY_MODE })
  const before = await lstat(path)
  if (!before.isDirectory() || before.isSymbolicLink())
    throw new Error(`Registry path is not a private directory: ${path}`)

  if (process.platform === 'win32')
    return

  await chmod(path, PRIVATE_DIRECTORY_MODE)
  const after = await lstat(path)
  const uid = process.getuid?.()
  if (uid != null && after.uid !== uid)
    throw new Error(`Registry directory is owned by another user: ${path}`)
  if ((after.mode & SHARED_ACCESS_MODE_MASK) !== 0)
    throw new Error(`Registry directory is accessible by other users: ${path}`)
}

function userIdentity(): string {
  return process.getuid?.().toString() || process.env.USERNAME || process.env.USER || 'current-user'
}

function instancePath(instanceId: string, registryRoot: string): string {
  const safeName = createHash('sha256').update(instanceId).digest('hex')
  return join(getInstancesDir(registryRoot), `${safeName}.json`)
}

function isInstanceRecord(value: InstanceRecord): boolean {
  return typeof value?.instanceId === 'string'
    && typeof value?.endpoint === 'string'
    && typeof value?.token === 'string'
    && typeof value?.updatedAt === 'number'
    && Array.isArray(value?.roots)
}

/** VS Code 窗口写入共享注册表的完整内部记录 */
export interface InstanceRecord {
  instanceId: string
  projectId: string
  pid: number
  label: string
  cwd: string
  roots: string[]
  schemes: string[]
  remoteName?: string
  locale: string
  endpoint: string
  token: string
  updatedAt: number
}

/** 可安全返回给 MCP 客户端的实例信息 */
export type PublicInstance = Omit<InstanceRecord, 'token' | 'endpoint'>
