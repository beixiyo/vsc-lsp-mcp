import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { window, workspace } from 'vscode'
import { transports } from './config'
import { cors } from './cors'
import { handleSessionRequest } from './session'
import { startServer } from './startServer'
import { addLspTools } from './tools'

export function startMcp() {
  const config = workspace.getConfiguration('lsp-mcp')
  const isMcpEnabled = config.get('enabled', true)
  const mcpPort = config.get('port', 9527)
  const maxRetries = config.get('maxRetries', 10)

  // CORS 配置
  const corsEnabled = config.get('cors.enabled', true)
  const allowOriginsStr: string = config.get('cors.allowOrigins', '*')
  const withCredentials = config.get('cors.withCredentials', false)
  const exposeHeadersStr: string = config.get('cors.exposeHeaders', 'Mcp-Session-Id')

  if (!isMcpEnabled) {
    window.showInformationMessage('LSP MCP server is disabled by configuration.')
    return
  }
  const app = express()

  // 应用 CORS 中间件（必须在其他中间件之前）
  if (corsEnabled) {
    const allowOrigins = allowOriginsStr === '*'
      ? '*'
      : allowOriginsStr.split(',').map(origin => origin.trim())

    const exposeHeaders = exposeHeadersStr.split(',').map(header => header.trim())

    app.use(cors(allowOrigins, withCredentials, exposeHeaders))
  }

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
