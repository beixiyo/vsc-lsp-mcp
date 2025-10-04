import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'

/**
 * 存储传输对象的映射
 */
export const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {}
