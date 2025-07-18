import { randomUUID } from 'node:crypto'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js'
import express from 'express'
import { window, workspace } from 'vscode'
import { addLspTools } from './tools'

// Map to store transports by session ID
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

// 尝试启动服务器，如果端口被占用则尝试其他端口
function startServer(app: express.Express, initialPort: number, maxRetries: number) {
  let currentPort = initialPort
  let retries = 0

  const tryListen = () => {
    const server = app.listen(currentPort, () => {
      window.showInformationMessage(`LSP MCP 服务已启动，监听端口 ${currentPort}`)
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        // 端口被占用，尝试下一个端口
        retries++
        currentPort++
        window.showWarningMessage(`端口 ${currentPort - 1} 已被占用，尝试端口 ${currentPort}...`)
        tryListen()
      }
      else {
        window.showErrorMessage(`无法启动 LSP MCP 服务: ${err.message}`)
      }
    })
  }

  tryListen()
}

// Reusable handler for GET and DELETE requests
async function handleSessionRequest(req: express.Request, res: express.Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
}
