import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { window, workspace } from 'vscode'
import { addLspTools } from './tools'

/** 存储传输对象的映射 */
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}

export function startMcp() {
  const config = workspace.getConfiguration('lsp-mcp')
  const isMcpEnabled = config.get('enabled', true)
  const mcpPort = config.get('port', 9527)
  const maxRetries = config.get('maxRetries', 10)

  if (!isMcpEnabled) {
    window.showInformationMessage('LSP MCP server is disabled by configuration.')
    return
  }
  const app = express()
  app.use(express.json())

  // Handle POST requests for client-to-server communication
  app.post('/mcp', async (req, res) => {
    // Check for existing session ID
    const sessionId = req.headers['mcp-session-id'] as string | undefined
    let transport: StreamableHTTPServerTransport

    if (sessionId && transports[sessionId]) {
      // Reuse existing transport
      transport = transports[sessionId]
    }
    else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          // Store the transport by session ID
          transports[sessionId] = transport
        },
        allowedHosts: ['127.0.0.1', 'localhost'],
      })

      // Clean up transport when closed
      transport.onclose = () => {
        if (transport.sessionId) {
          delete transports[transport.sessionId]
        }
      }

      const server = new McpServer({
        name: 'lsp-server',
        version: '0.0.2',
      })

      // Add LSP tools to the server
      addLspTools(server)

      // Connect to the MCP server
      await server.connect(transport)
    }
    else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      })
      return
    }

    // Handle the request
    await transport.handleRequest(req, res, req.body)
  })

  // Handle GET requests for server-to-client notifications via SSE
  app.get('/mcp', handleSessionRequest)

  // 尝试启动服务器，处理端口冲突
  startServer(app, mcpPort, maxRetries)
}

/**
 * 尝试启动服务器，如果端口被占用则尝试其他端口
 * @param app - 应用实例
 * @param initialPort - 初始端口
 * @param maxRetries - 最大重试次数
 */
function startServer(app: express.Express, initialPort: number, maxRetries: number) {
  let currentPort = initialPort
  let retries = 0
  let hasShownPortConflict = false

  const tryListen = () => {
    const server = app.listen(currentPort, (error: Error | undefined) => {
      // 不打印多个窗口同时启动的冲突
      if (error) {
        return
      }

      // 如果之前显示过端口冲突提示，则显示最终成功启动的消息
      if (hasShownPortConflict) {
        window.showInformationMessage(`LSP MCP 启动在 ${currentPort}（原端口 ${initialPort} 被占用）`)
      }
      else {
        window.showInformationMessage(`LSP MCP 启动在 ${currentPort}`)
      }
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        // 端口被占用，尝试下一个端口
        retries++
        currentPort++
        hasShownPortConflict = true

        tryListen()
      }
      else {
        window.showErrorMessage(`无法启动 LSP MCP 服务: ${err.message}`)
      }
    })
  }

  tryListen()
}

/**
 * 处理连接
 */
async function handleSessionRequest(req: express.Request, res: express.Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
}
