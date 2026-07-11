import type { Server } from 'node:http'
import type { ExtensionContext } from 'vscode'
import type { ExecuteLspInput, RenameResourceInput } from '../protocol'
import type { InstanceRecord } from './registry'
import { randomBytes } from 'node:crypto'
import express from 'express'
import { env, workspace } from 'vscode'
import { getMcpLocale } from '../i18n'
import { executeLspOperation } from '../mcp/tools'
import { executeResourceRename } from '../mcp/workspaceTools'
import {
  createInstanceIdentity,
  getRegistryRoot,
  normalizePath,
  removeInstance,
  writeInstance,
} from './registry'

const HEARTBEAT_MS = 5_000

/**
 * 为当前 VS Code 窗口启动仅监听 loopback 的内部服务
 * 服务使用随机 token 鉴权，并通过心跳将自身登记到共享注册表
 */
export async function startInstanceServer(
  context: ExtensionContext,
): Promise<InstanceServer> {
  if (env.remoteName)
    throw new Error('Multi-instance MCP currently supports local desktop workspaces only')

  const roots = (workspace.workspaceFolders || [])
    .filter(folder => folder.uri.scheme === 'file')
    .map(folder => normalizePath(folder.uri.fsPath))
  const identity = createInstanceIdentity(roots)
  const token = randomBytes(32).toString('hex')
  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.use((req, res, next) => {
    if (req.header('x-lsp-mcp-token') !== token) {
      res.status(401).json({ error: { code: 'unauthorized', message: 'Invalid instance token' } })
      return
    }
    next()
  })

  app.get('/internal/health', (_req, res) => {
    res.json({ status: 'ok', instanceId: identity.instanceId })
  })
  app.post('/internal/lsp', async (req, res) => {
    try {
      res.json({ result: await executeLspOperation(req.body as ExecuteLspInput) })
    }
    catch (error) {
      res.status(500).json({ error: serializeError(error) })
    }
  })
  app.post('/internal/rename-resource', async (req, res) => {
    try {
      res.json({ result: await executeResourceRename(req.body as RenameResourceInput) })
    }
    catch (error) {
      res.status(500).json({ error: serializeError(error) })
    }
  })

  const server = await listen(app)
  let record: InstanceRecord
  const registryRoot = getRegistryRoot()
  try {
    const address = server.address()
    if (!address || typeof address === 'string')
      throw new Error('Failed to resolve internal MCP instance port')

    record = {
      ...identity,
      pid: process.pid,
      label: workspace.name || identity.projectId,
      cwd: normalizePath(process.cwd()),
      roots,
      schemes: ['file'],
      locale: getMcpLocale(),
      endpoint: `http://127.0.0.1:${address.port}`,
      token,
      updatedAt: Date.now(),
    }
    await writeInstance(record, registryRoot)
  }
  catch (error) {
    await closeServer(server)
    throw error
  }

  let refresh = Promise.resolve()
  const heartbeat = setInterval(() => {
    record.updatedAt = Date.now()
    record.locale = getMcpLocale()
    refresh = refresh.then(() => writeInstance(record, registryRoot)).catch(() => {})
  }, HEARTBEAT_MS)
  heartbeat.unref()

  const dispose = async () => {
    clearInterval(heartbeat)
    await refresh
    await removeInstance(record.instanceId, registryRoot)
    await closeServer(server)
  }
  context.subscriptions.push({ dispose: () => void dispose() })

  return { record, dispose }
}

function listen(app: express.Express): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => resolve(server))
    server.once('error', reject)
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()))
}

function serializeError(error: unknown) {
  return {
    code: 'instance_request_failed',
    message: error instanceof Error ? error.message : String(error),
  }
}

/** 当前 VS Code 窗口的内部服务与清理句柄 */
export interface InstanceServer {
  record: InstanceRecord
  dispose: () => Promise<void>
}
