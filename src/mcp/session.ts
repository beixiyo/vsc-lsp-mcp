import type express from 'express'
import { transports } from './config'

/**
 * 处理连接
 */
export async function handleSessionRequest(req: express.Request, res: express.Response) {
  const sessionId = req.headers['mcp-session-id'] as string | undefined
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID')
    return
  }

  const transport = transports[sessionId]
  await transport.handleRequest(req, res)
}
