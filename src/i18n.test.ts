import type { ExtensionContext } from 'vscode'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it, vi } from 'vitest'
import mcpBundleZhCn from '../l10n/mcp.l10n.zh-cn.json'

const bundle = mcpBundleZhCn as Record<string, string>

describe('tMcp placeholder interpolation', () => {
  it('interpolates placeholders in the English fallback', async () => {
    const { i18n, context } = await loadI18nWithVscodeMock({ mcpLocale: 'en' })
    i18n.initMcpLocale(context)

    expect(i18n.tMcp('No {label} found.', { label: 'references' }))
      .toBe('No references found.')
    expect(i18n.tMcp('line {range}', { range: '9-12' }))
      .toBe('line 9-12')
    expect(i18n.tMcp('Renamed to `{newName}` across {filesChanged} file(s) ({totalEdits} total edit(s)).', {
      newName: 'foo',
      filesChanged: 2,
      totalEdits: 5,
    })).toBe('Renamed to `foo` across 2 file(s) (5 total edit(s)).')
  })

  it('interpolates placeholders in the translated text', async () => {
    const { i18n, context } = await loadI18nWithVscodeMock({ mcpLocale: 'zh-cn' })
    i18n.initMcpLocale(context)

    expect(i18n.tMcp('No symbols found.'))
      .toBe('未找到符号。')
    expect(i18n.tMcp('(Showing {maxResults} of {total} symbols)', { maxResults: 5, total: 10 }))
      .toBe('（显示 10 个符号中的前 5 个）')
  })

  it('falls back to English with interpolation when a key is missing from the bundle', async () => {
    const { i18n, context } = await loadI18nWithVscodeMock({ mcpLocale: 'zh-cn' })
    i18n.initMcpLocale(context)

    expect(i18n.tMcp('key not in bundle: {value}', { value: 42 }))
      .toBe('key not in bundle: 42')
  })

  it('keeps placeholders verbatim when args are missing', async () => {
    const { i18n, context } = await loadI18nWithVscodeMock({ mcpLocale: 'en' })
    i18n.initMcpLocale(context)

    expect(i18n.tMcp('No {label} found.')).toBe('No {label} found.')
    expect(i18n.tMcp('No {label} found.', {})).toBe('No {label} found.')
  })
})

describe('mcpLocale resolution', () => {
  it('follows VS Code UI language when set to "none"', async () => {
    const { i18n, context } = await loadI18nWithVscodeMock({ mcpLocale: 'none', envLanguage: 'zh-cn' })
    i18n.initMcpLocale(context)

    expect(i18n.tMcp('No symbols found.')).toBe('未找到符号。')
  })

  it('re-resolves locale on configuration change and registers a disposable', async () => {
    const { i18n, context, setLocale } = await loadI18nWithVscodeMock({ mcpLocale: 'en' })
    i18n.initMcpLocale(context)

    expect(i18n.tMcp('No symbols found.')).toBe('No symbols found.')
    expect(context.subscriptions).toHaveLength(1)

    setLocale('zh-cn')
    expect(i18n.tMcp('No symbols found.')).toBe('未找到符号。')
  })
})

describe('translation bundle consistency', () => {
  const root = fileURLToPath(new URL('..', import.meta.url))
  const sourceFiles = [
    'src/mcp/tools.ts',
    'src/transform/markdownFormatter.ts',
    'src/transform/pipeline.ts',
  ]
  const sources = sourceFiles
    .map(file => readFileSync(`${root}${file}`, 'utf8'))
    .join('\n')

  it('every bundle key matches a source string exactly', () => {
    // 英文原文即翻译 key：源码文案一旦改动，这里会立刻失败并指出脱钩的 key
    for (const key of Object.keys(bundle)) {
      const asTemplateLiteral = key.replace(/`/g, '\\`')
      const found = sources.includes(key) || sources.includes(asTemplateLiteral)

      expect(found, `bundle key 与源码脱钩: ${JSON.stringify(key.slice(0, 80))}`).toBe(true)
    }
  })

  it('every tMcp() string literal has a translation in the bundle', () => {
    const literalRe = /tMcp\(\s*'((?:[^'\\]|\\.)*)'/g
    const literals: string[] = []
    let match: RegExpExecArray | null = literalRe.exec(sources)

    while (match !== null) {
      literals.push(match[1]
        .replace(/\\'/g, `'`)
        .replace(/\\n/g, '\n')
        .replace(/\\`/g, '`'))
      match = literalRe.exec(sources)
    }

    expect(literals.length).toBeGreaterThan(0)

    for (const literal of literals) {
      expect(literal in bundle, `源码中的 key 缺少翻译: ${JSON.stringify(literal.slice(0, 80))}`).toBe(true)
    }
  })
})

async function loadI18nWithVscodeMock(options: {
  mcpLocale?: string
  envLanguage?: string
} = {}) {
  vi.resetModules()

  let configLocale = options.mcpLocale ?? 'none'
  const listeners: Array<(e: { affectsConfiguration: (section: string) => boolean }) => void> = []

  const vscode = {
    env: {
      language: options.envLanguage ?? 'en',
    },
    workspace: {
      getConfiguration: vi.fn(() => ({
        get: vi.fn((key: string, fallback: unknown) =>
          key === 'mcpLocale'
            ? configLocale
            : fallback),
      })),
      onDidChangeConfiguration: vi.fn((listener: (typeof listeners)[number]) => {
        listeners.push(listener)
        return { dispose: vi.fn() }
      }),
    },
  }

  vi.doMock('vscode', () => vscode)
  const i18n = await import('./i18n')

  return {
    i18n,
    context: { subscriptions: [] } as unknown as ExtensionContext,
    setLocale(next: string) {
      configLocale = next
      for (const listener of listeners) {
        listener({ affectsConfiguration: section => section === 'lsp-mcp.mcpLocale' })
      }
    },
  }
}
