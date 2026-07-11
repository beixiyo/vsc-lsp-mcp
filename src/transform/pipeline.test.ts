import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.fn()
let outputFormat = 'json'

vi.mock('vscode', () => ({
  CompletionItemKind: { Function: 2, 2: 'Function' },
  SymbolKind: {
    Module: 1,
    Function: 11,
    Variable: 12,
    1: 'Module',
    11: 'Function',
    12: 'Variable',
  },
  MarkdownString: class {
    constructor(public value: string) {}
  },
  workspace: {
    getConfiguration: () => ({ get }),
  },
}))

describe('transformService result limits', () => {
  beforeEach(() => {
    get.mockImplementation((key: string, fallback: unknown) => {
      if (key === 'maxResults')
        return 2
      if (key === 'outputFormat')
        return outputFormat
      return fallback
    })
  })

  beforeEach(() => {
    outputFormat = 'json'
  })

  it('deduplicates completions and reports shown/total when truncated', async () => {
    const { TransformService } = await import('./pipeline')
    const service = new TransformService()
    const output = service.formatCompletions({
      items: [
        { label: 'alpha', kind: 2, detail: 'first' },
        { label: 'alpha', kind: 2, detail: 'first' },
        { label: 'beta', kind: 2 },
        { label: 'gamma', kind: 2 },
      ],
    } as never)

    expect(JSON.parse(output)).toEqual({
      items: [
        { label: 'alpha', kind: 'Function', detail: 'first' },
        { label: 'beta', kind: 'Function' },
      ],
      truncated: { shown: 2, total: 3 },
    })
  })

  it('keeps the same JSON envelope when output is not truncated', async () => {
    const { TransformService } = await import('./pipeline')
    const service = new TransformService()
    const output = service.formatCompletions({ items: [{ label: 'alpha', kind: 2 }] } as never)

    expect(JSON.parse(output)).toEqual({
      items: [{ label: 'alpha', kind: 'Function' }],
    })
  })

  it('limits document symbols by recursive node count', async () => {
    const { TransformService } = await import('./pipeline')
    const service = new TransformService()
    const range = {
      start: { line: 0, character: 0 },
      end: { line: 0, character: 1 },
    }
    const output = service.formatDocumentSymbols([{
      name: 'root',
      detail: '',
      kind: 1,
      range,
      selectionRange: range,
      children: [
        { name: 'first', detail: '', kind: 12, range, selectionRange: range, children: [] },
        { name: 'second', detail: '', kind: 12, range, selectionRange: range, children: [] },
      ],
    }] as never)

    expect(JSON.parse(output)).toEqual({
      items: [{
        name: 'root',
        kind: 'Module',
        range: '1:1-1:2',
        namePosition: '1:1',
        children: [{
          name: 'first',
          kind: 'Variable',
          range: '1:1-1:2',
          namePosition: '1:1',
        }],
      }],
      truncated: { shown: 2, total: 3 },
    })
  })

  it('keeps signature documentation and parameters in Markdown output', async () => {
    outputFormat = 'markdown'
    const { TransformService } = await import('./pipeline')
    const service = new TransformService()
    const output = service.formatSignatureHelp([{
      activeSignature: 0,
      activeParameter: 0,
      signatures: [{
        label: 'call(value: string)',
        documentation: 'Call documentation',
        parameters: [{ label: 'value', documentation: 'Value documentation' }],
      }],
    }] as never)

    expect(output).toContain('Call documentation')
    expect(output).toContain('Value documentation')
    expect(output).toContain('active parameter: 1')
  })
})
