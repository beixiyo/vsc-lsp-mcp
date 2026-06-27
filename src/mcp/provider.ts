import type { ExtensionContext } from 'vscode'
import { EventEmitter, lm, McpHttpServerDefinition, Uri, workspace } from 'vscode'

export const MCP_SERVER_PROVIDER_ID = 'lsp-mcp.localServer'

const MCP_SERVER_LABEL = 'LSP MCP'
const MCP_ENDPOINT_PATH = '/mcp'

/**
 * Register this extension's local HTTP MCP server for VS Code Chat / Copilot.
 */
export function registerMcpServerProvider(
  context: ExtensionContext,
  getPort: () => number | undefined,
): McpServerProviderRegistration {
  const didChangeMcpServerDefinitions = new EventEmitter<void>()

  context.subscriptions.push(didChangeMcpServerDefinitions)
  context.subscriptions.push(lm.registerMcpServerDefinitionProvider(MCP_SERVER_PROVIDER_ID, {
    onDidChangeMcpServerDefinitions: didChangeMcpServerDefinitions.event,
    provideMcpServerDefinitions: () => {
      const config = workspace.getConfiguration('lsp-mcp')
      const isMcpEnabled = config.get('enabled', true)
      const port = getPort()

      if (!isMcpEnabled || port == null) {
        return []
      }

      return [
        new McpHttpServerDefinition(
          MCP_SERVER_LABEL,
          Uri.parse(`http://127.0.0.1:${port}${MCP_ENDPOINT_PATH}`),
        ),
      ]
    },
    resolveMcpServerDefinition: server => server,
  }))

  return {
    refresh() {
      didChangeMcpServerDefinitions.fire()
    },
  }
}

/**
 * Handle for notifying VS Code that available MCP server definitions changed.
 */
export interface McpServerProviderRegistration {
  /**
   * Notify VS Code to refresh MCP server definitions from this provider.
   */
  refresh: () => void
}
