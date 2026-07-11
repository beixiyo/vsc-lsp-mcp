import type { ExtensionContext } from 'vscode'
import { env, workspace } from 'vscode'
import { translateMcp } from './mcpLocale'

// ─── Resolve effective MCP locale ────────────────────────────────────

function resolveMcpLocale(): string {
  const mcpLocale = workspace
    .getConfiguration('lsp-mcp')
    .get<string>('mcpLocale', 'none')
  if (mcpLocale && mcpLocale !== 'none')
    return mcpLocale

  // "none" → follow VS Code UI language
  return env.language
}

let mcpLocaleResolved = 'en'

/**
 * Resolve the MCP locale and keep it in sync with configuration changes.
 * Must be called during activation, before any MCP session is created.
 */
export function initMcpLocale(context: ExtensionContext): void {
  mcpLocaleResolved = resolveMcpLocale()

  context.subscriptions.push(
    workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('lsp-mcp.mcpLocale')) {
        mcpLocaleResolved = resolveMcpLocale()
      }
    }),
  )
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Translate an MCP-facing string (tool descriptions, parameter descriptions, responses).
 * Controlled by the `lsp-mcp.mcpLocale` configuration.
 *   - `"none"` (default): follows VS Code UI language
 *   - `"en"` / `"zh-cn"`: forces that language
 *
 * The `key` is the English fallback text. The Chinese bundle maps English → Chinese.
 * `{placeholder}` interpolation applies to both the translated and the fallback text;
 * placeholders missing from `args` are kept verbatim.
 */
export function tMcp(
  key: string,
  args?: Record<string, string | number>,
): string {
  return translateMcp(mcpLocaleResolved, key, args)
}

export function getMcpLocale(): string {
  return mcpLocaleResolved
}
