import _mcpBundleZhCn from '../l10n/mcp.l10n.zh-cn.json'

const mcpBundleZhCn = _mcpBundleZhCn as Record<string, string>

export function translateMcp(
  locale: string,
  key: string,
  args?: Record<string, string | number>,
): string {
  const template = locale === 'zh-cn' ? (mcpBundleZhCn[key] || key) : key
  if (!args)
    return template

  return template.replace(/\{(\w+)\}/g, (_, name) =>
    String(args[name] ?? `{${name}}`))
}
