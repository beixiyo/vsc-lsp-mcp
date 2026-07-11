import type { Server as HttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import pkg from '../../package.json'
import { listInstances } from '../instance/registry'
import { cors } from '../mcp/cors'
import { BROKER_PROTOCOL_VERSION, removeBrokerState, writeBrokerState } from './state'
import { addBrokerTools } from './tools'

const IDLE_EXIT_MS = 30_000
const STATE_HEARTBEAT_MS = 5_000

/**
 * 启动供外部 AI 客户端连接的共享 MCP Broker
 * Broker 本身不执行 LSP，而是根据实例注册表将请求转发给目标 VS Code 窗口
 */
export async function startBroker(options: BrokerOptions): Promise<BrokerHandle> {
  const app = express()
  const transports = new Map<string, StreamableHTTPServerTransport>()
  if (options.corsEnabled) {
    const origins = options.corsOrigins === '*'
      ? '*'
      : options.corsOrigins.split(',').map(origin => origin.trim())
    app.use(cors(
      origins,
      options.corsCredentials,
      options.corsExposeHeaders.split(',').map(header => header.trim()),
    ))
  }
  app.use(express.json({ limit: '1mb' }))
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', protocolVersion: BROKER_PROTOCOL_VERSION })
  })

  const handleMcp = async (req: express.Request, res: express.Response) => {
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport = sessionId ? transports.get(sessionId) : undefined

    if (!transport && !sessionId && isInitializeRequest(req.body)) {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (initializedId) => {
          transports.set(initializedId, transport!)
        },
        allowedHosts: ['127.0.0.1', 'localhost'],
      })
      transport.onclose = () => {
        if (transport?.sessionId)
          transports.delete(transport.sessionId)
      }

      const mcpServer = new McpServer({ name: 'vsc-lsp-mcp', version: pkg.version })
      const locale = (await listInstances())[0]?.locale || options.locale
      addBrokerTools(mcpServer, locale)
      await mcpServer.connect(transport)
    }

    if (!transport) {
      res.status(400).json({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: invalid or missing MCP session ID' },
        id: null,
      })
      return
    }

    await transport.handleRequest(req, res, req.body)
  }

  app.post('/mcp', handleMcp)
  app.get('/mcp', handleMcp)
  app.delete('/mcp', handleMcp)

  const { server, port } = await listenWithRetry(app, options.port, options.maxRetries)
  await writeBrokerState({
    pid: process.pid,
    port,
    protocolVersion: BROKER_PROTOCOL_VERSION,
    updatedAt: Date.now(),
  })

  let emptySince: number | undefined
  let heartbeatRun = Promise.resolve()

  const heartbeat = setInterval(() => {
    heartbeatRun = heartbeatRun.then(async () => {
      await writeBrokerState({
        pid: process.pid,
        port,
        protocolVersion: BROKER_PROTOCOL_VERSION,
        updatedAt: Date.now(),
      })

      const instances = await listInstances()
      if (instances.length > 0) {
        emptySince = undefined
        return
      }

      emptySince ??= Date.now()

      if (Date.now() - emptySince >= IDLE_EXIT_MS) {
        if (options.onIdle)
          options.onIdle()
        else
          void dispose()
      }
    }).catch(() => {})
  }, STATE_HEARTBEAT_MS)
  heartbeat.unref()

  let disposed = false
  const dispose = async () => {
    if (disposed)
      return
    disposed = true
    clearInterval(heartbeat)
    await heartbeatRun
    for (const transport of transports.values())
      await transport.close().catch(() => {})
    transports.clear()
    await closeServer(server)
    await removeBrokerState()
  }

  return { port, dispose }
}

async function listenWithRetry(
  app: express.Express,
  initialPort: number,
  maxRetries: number,
): Promise<{ server: HttpServer, port: number }> {
  let lastError: unknown
  for (let offset = 0; offset <= maxRetries; offset++) {
    const port = initialPort + offset
    try {
      const server = await listen(app, port)
      const address = server.address()
      if (!address || typeof address === 'string')
        throw new Error('Failed to resolve broker port')
      return { server, port: address.port }
    }
    catch (error) {
      lastError = error
      if ((error as NodeJS.ErrnoException).code !== 'EADDRINUSE')
        throw error
    }
  }
  throw lastError
}

function listen(app: express.Express, port: number): Promise<HttpServer> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => resolve(server))
    server.once('error', reject)
  })
}

function closeServer(server: HttpServer): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()))
}

/** 共享 Broker 的监听、跨域和生命周期配置 */
export interface BrokerOptions {
  port: number
  maxRetries: number
  corsEnabled: boolean
  corsOrigins: string
  corsCredentials: boolean
  corsExposeHeaders: string
  locale: string
  onIdle?: () => void
}

/** 已启动 Broker 的端口与清理句柄 */
export interface BrokerHandle {
  port: number
  dispose: () => Promise<void>
}
