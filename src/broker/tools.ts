import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ExecuteLspInput, RenameResourceInput } from '../protocol'
import { z } from 'zod'
import { listInstances, publicInstance } from '../instance/registry'
import { InstanceResolutionError, resolveInstance } from '../instance/router'
import { translateMcp } from '../mcpLocale'
import {
  immediateWriteWarning,
  lspOperations,
  lspSafetyDescription,
  lspToolIntroduction,
  nativePathDescription,
  operationIntentDescription,
  pathAndPositionDescription,
  specialUriDescription,
} from '../protocol'

const INSTANCE_REQUEST_TIMEOUT_MS = 30_000

/** 注册 Broker 对外暴露的实例发现、LSP 与工作区工具 */
export function addBrokerTools(server: McpServer, locale: string): void {
  const tMcp = (key: string) => translateMcp(locale, key)
  server.registerTool(
    'health',
    {
      description: tMcp('Report the global VS Code LSP MCP broker status.'),
    },
    async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({ status: 'ok' }),
      }],
    }),
  )

  server.registerTool(
    'list_instances',
    {
      description: tMcp('List active VS Code workspace instances. Use instanceId to select one explicitly.'),
    },
    async () => ({
      content: [{
        type: 'text',
        text: JSON.stringify({ instances: (await listInstances()).map(publicInstance) }),
      }],
    }),
  )

  server.registerTool(
    'execute_lsp',
    {
      title: tMcp('Execute LSP Operation'),
      description: [
        lspToolIntroduction,
        pathAndPositionDescription,
        operationIntentDescription,
        lspSafetyDescription,
        'Pass instanceId when multiple VS Code instances cover the same project.',
      ].map(tMcp).join('\n\n'),
      inputSchema: {
        operation: z.enum(lspOperations).describe(tMcp('Operation selected by intent. See the tool description for position and safety requirements.')),
        uri: z.string().min(1).describe(`${tMcp(nativePathDescription)}\n${tMcp(specialUriDescription)}`),
        line: z.number().int().min(1).optional().describe(tMcp('1-based line. Required only for position-based operations. Reuse a returned range start or namePosition; do not guess.')),
        character: z.number().int().min(1).optional().describe(tMcp('1-based character. Required only for position-based operations. For signature_help, use a position inside the intended call argument.')),
        newName: z.string().min(1).optional().describe(tMcp('Non-empty new symbol name. Required only for rename, which immediately modifies the workspace.')),
        query: z.string().min(1).optional().describe(tMcp('Non-empty project symbol query. Required only for workspace_symbols; empty project-wide searches are rejected.')),
        instanceId: z.string().optional().describe(tMcp('Exact instance ID returned by list_instances. Optional when the path matches one instance.')),
      },
    },
    async ({ instanceId, ...input }) => {
      const result = await forward(
        instanceId,
        input.uri,
        '/internal/lsp',
        input as ExecuteLspInput,
      )
      return { content: [{ type: 'text', text: result }] }
    },
  )

  server.registerTool(
    'rename_resource',
    {
      title: tMcp('Rename Workspace Resource'),
      description: `${tMcp('Rename a file or directory inside the selected VS Code workspace. Both paths must remain inside its workspace roots. Language extensions may update affected references.')} ${tMcp(immediateWriteWarning)}`,
      inputSchema: {
        oldUri: z.string().min(1).describe(tMcp(nativePathDescription)),
        newUri: z.string().min(1).describe(tMcp(nativePathDescription)),
        overwrite: z.boolean().optional().default(false).describe(tMcp('Whether an existing destination may be replaced. Defaults to false.')),
        instanceId: z.string().optional().describe(tMcp('Exact instance ID returned by list_instances. Optional when the path matches one instance.')),
      },
    },
    async ({ instanceId, ...input }) => {
      const result = await forward(
        instanceId,
        input.oldUri,
        '/internal/rename-resource',
        input as RenameResourceInput,
      )
      return { content: [{ type: 'text', text: result }] }
    },
  )
}

async function forward(
  instanceId: string | undefined,
  uri: string,
  path: string,
  body: ExecuteLspInput | RenameResourceInput,
): Promise<string> {
  try {
    const instance = resolveInstance(await listInstances(), instanceId, uri)
    assertLoopbackEndpoint(instance.endpoint)
    const response = await fetch(`${instance.endpoint}${path}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-lsp-mcp-token': instance.token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(INSTANCE_REQUEST_TIMEOUT_MS),
    })
    const payload = await response.json() as ForwardResponse
    if (payload.error)
      return JSON.stringify({ error: payload.error })
    if (!response.ok) {
      return JSON.stringify({
        error: {
          code: 'instance_request_failed',
          message: `VS Code instance returned HTTP ${response.status}`,
        },
      })
    }
    if (typeof payload.result !== 'string')
      return JSON.stringify({ error: { code: 'invalid_instance_response', message: 'VS Code instance returned an invalid response' } })
    return payload.result
  }
  catch (error) {
    if (error instanceof InstanceResolutionError) {
      return JSON.stringify({
        error: {
          code: error.code,
          message: error.message,
          candidates: error.candidates,
        },
      })
    }
    return JSON.stringify({
      error: {
        code: error instanceof DOMException && error.name === 'TimeoutError'
          ? 'instance_timeout'
          : 'instance_request_failed',
        message: error instanceof Error ? error.message : String(error),
      },
    })
  }
}

function assertLoopbackEndpoint(endpoint: string): void {
  const url = new URL(endpoint)
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1')
    throw new Error('VS Code instance endpoint must use the 127.0.0.1 loopback address')
}

interface ForwardResponse {
  result?: string
  error?: {
    code: string
    message: string
  }
}
