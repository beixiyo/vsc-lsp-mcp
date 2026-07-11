import type { ExtensionContext } from 'vscode'
import { l10n, window, workspace } from 'vscode'
import { ensureBroker } from '../broker/ensure'
import { getMcpLocale, initMcpLocale } from '../i18n'
import { startInstanceServer } from '../instance/server'
import { registerMcpServerProvider } from './provider'

/** Start this VS Code window's internal LSP endpoint and the shared MCP broker. */
export async function startMcp(context: ExtensionContext): Promise<void> {
  initMcpLocale(context)

  const config = workspace.getConfiguration('lsp-mcp')
  if (!config.get('enabled', true)) {
    window.showInformationMessage(l10n.t('LSP MCP server is disabled by configuration.'))
    return
  }

  const preferredPort = config.get('port', 9527)
  let instance: Awaited<ReturnType<typeof startInstanceServer>> | undefined

  try {
    instance = await startInstanceServer(context)
    const brokerPort = await ensureBroker(context, {
      port: preferredPort,
      corsEnabled: config.get('cors.enabled', false),
      corsOrigins: config.get('cors.allowOrigins', '*'),
      corsCredentials: config.get('cors.withCredentials', false),
      corsExposeHeaders: config.get('cors.exposeHeaders', 'Mcp-Session-Id'),
      locale: getMcpLocale(),
    })

    const provider = registerMcpServerProvider(context, () => brokerPort)
    provider.refresh()

    window.showInformationMessage(l10n.t(
      'LSP MCP server started on port {port}.',
      { port: brokerPort },
    ))
  }
  catch (error) {
    await instance?.dispose()
    window.showErrorMessage(l10n.t(
      'Failed to start LSP MCP server: {message}',
      { message: error instanceof Error ? error.message : String(error) },
    ))
  }
}
