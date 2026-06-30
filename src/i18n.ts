import { env, l10n, workspace } from 'vscode'

// ─── Translation bundles ────────────────────────────────────────────

import _mcpBundleZhCn from '../l10n/mcp.l10n.zh-cn.json'

const mcpBundleZhCn = _mcpBundleZhCn as Record<string, string>

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

export function initMcpLocale(): void {
  mcpLocaleResolved = resolveMcpLocale()
}

// Listen for configuration changes to re-resolve locale at runtime
workspace.onDidChangeConfiguration((e) => {
  if (e.affectsConfiguration('lsp-mcp.mcpLocale')) {
    mcpLocaleResolved = resolveMcpLocale()
  }
})

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Translate a user-facing string (VS Code notifications, etc.).
 * Delegates to `vscode.l10n.t` — respects VS Code UI language automatically.
 */
export function t(key: string, args?: Record<string, string | number>): string {
  return args ? l10n.t(key, args) : l10n.t(key)
}

/**
 * Translate an MCP-facing string (tool descriptions, parameter descriptions, responses).
 * Controlled by the `lsp-mcp.mcpLocale` configuration.
 *   - `"none"` (default): follows VS Code UI language
 *   - `"en"` / `"zh-cn"`: forces that language
 *
 * The `key` is the English fallback text. The Chinese bundle maps English → Chinese.
 */
export function tMcp(
  key: string,
  args?: Record<string, string | number>,
): string {
  let template = key

  if (mcpLocaleResolved === 'zh-cn') {
    const translated = mcpBundleZhCn[key]
    if (translated)
      template = translated
  }

  if (!args)
    return template

  return template.replace(/\{(\w+)\}/g, (_, k) =>
    String(args[k] ?? `{${k}}`))
}
