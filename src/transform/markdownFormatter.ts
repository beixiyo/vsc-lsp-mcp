import type { Formatter } from './types'
import { tMcp } from '../i18n'

/**
 * MarkdownFormatter converts flattened LSP data into LLM-friendly Markdown text.
 *
 * Design principles:
 * - No tables (LLM-unfriendly and token-wasteful)
 * - Concise bullet-oriented structure
 * - Inline code for identifiers and file paths
 * - Minimal boilerplate to maximise informational density
 */
export class MarkdownFormatter implements Formatter {
  formatHover(contents: string[]): string {
    if (contents.length === 0) {
      return `## Hover\n\n${tMcp('No hover information available.')}`
    }
    return `## Hover\n\n${contents.join('\n\n---\n\n')}`
  }

  formatSignatureHelp(items: Record<string, any>[]): string {
    if (items.length === 0)
      return `## Signature Help\n\n${tMcp('No signature help available.')}`

    const lines = items.flatMap((item) => {
      const active = item.activeParameter
        ? `; ${tMcp('active parameter: {parameter}', { parameter: item.activeParameter })}`
        : ''
      const lines = [`- \`${item.label}\`${item.active ? ' (active)' : ''}${active}`]
      if (item.documentation)
        lines.push(`  ${item.documentation}`)
      for (const [index, parameter] of (item.parameters ?? []).entries()) {
        const documentation = parameter.documentation ? `: ${parameter.documentation}` : ''
        lines.push(`  - ${index + 1}. \`${parameter.label}\`${documentation}`)
      }
      return lines
    })
    return `## Signature Help\n\n${lines.join('\n')}`
  }

  formatCompletions(items: Record<string, any>[]): string {
    if (items.length === 0) {
      return `## Completions\n\n${tMcp('No completions available.')}`
    }

    const lines = items.map((item) => {
      let line = `- \`${item.label}\``
      if (item.kind)
        line += ` (${item.kind})`
      if (item.detail)
        line += `: ${item.detail}`
      return line
    })

    return `## Completions\n\n${lines.join('\n')}`
  }

  formatLocations(locations: Record<string, any>[], label = 'Locations'): string {
    if (locations.length === 0) {
      return `## ${label}\n\n${tMcp('No {label} found.', { label: label.toLowerCase() })}`
    }

    const grouped: Record<string, string[]> = {}
    for (const loc of locations) {
      if (!grouped[loc.file])
        grouped[loc.file] = []
      grouped[loc.file].push(loc.range)
    }

    const lines = Object.entries(grouped).map(([file, ranges]) =>
      `- \`${file}\`: ${ranges.map(r => tMcp('line {range}', { range: r })).join(', ')}`,
    )

    return `## ${label}\n\n${lines.join('\n')}`
  }

  formatRename(result: Record<string, any>): string {
    return `## Rename\n\n${tMcp('Renamed to `{newName}` across {filesChanged} file(s) ({totalEdits} total edit(s)).', {
      newName: result.newName,
      filesChanged: result.filesChanged,
      totalEdits: result.totalEdits,
    })}`
  }

  formatResourceRename(result: Record<string, any>): string {
    return `## Resource Rename\n\n${tMcp('Renamed `{oldUri}` to `{newUri}`.', {
      oldUri: result.oldUri,
      newUri: result.newUri,
    })}`
  }

  formatClassFile(text: string): string {
    const escaped = text.replace(/```/g, '\\`\\`\\`')
    return `## Class File Contents\n\n\`\`\`java\n${escaped}\n\`\`\``
  }

  formatDocumentSymbols(symbols: Record<string, any>[]): string {
    if (symbols.length === 0)
      return `## Document Symbols\n\n${tMcp('No symbols found.')}`

    const lines = symbols.map(s => this._renderFlatSymbol(s, 0))
    return `## Document Symbols\n\n${lines.join('\n')}`
  }

  formatWorkspaceSymbols(symbols: Record<string, any>[]): string {
    if (symbols.length === 0)
      return `## Workspace Symbols\n\n${tMcp('No symbols found.')}`
    const grouped: Record<string, any[]> = {}

    for (const s of symbols) {
      const { file, ...rest } = s
      if (!file)
        continue
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push(rest)
    }

    const lines = Object.entries(grouped).flatMap(([file, items]) => {
      const itemLines = items.map((item) => {
        const parts: string[] = [tMcp('line {range}', { range: item.range })]
        if (item.containerName)
          parts.push(tMcp('nested in `{containerName}`', { containerName: item.containerName }))
        return `  - \`${item.name}\` (${item.kind}): ${parts.join(', ')}`
      })
      return [`\`${file}\``, ...itemLines]
    })

    return `## Workspace Symbols\n\n${lines.join('\n')}`
  }

  formatCallHierarchyItems(items: Record<string, any>[]): string {
    if (items.length === 0)
      return `## Call Hierarchy\n\n${tMcp('No items found.')}`

    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      const { file, ...rest } = item
      if (!file)
        continue
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push(rest)
    }

    const lines = Object.entries(grouped).flatMap(([file, items]) => {
      const itemLines = items.map((item) => {
        const parts: string[] = [tMcp('line {range}', { range: item.range })]
        if (item.namePosition)
          parts.push(tMcp('name at {pos}', { pos: item.namePosition }))
        if (item.detail)
          parts.push(tMcp('detail: {detail}', { detail: item.detail }))
        return `  - \`${item.name}\` (${item.kind}): ${parts.join(', ')}`
      })
      return [`\`${file}\``, ...itemLines]
    })

    return `## Call Hierarchy\n\n${lines.join('\n')}`
  }

  formatIncomingCalls(calls: Record<string, any>[]): string {
    if (calls.length === 0)
      return `## Incoming Calls\n\n${tMcp('No incoming calls found.')}`
    const grouped: Record<string, any[]> = {}

    for (const call of calls) {
      const file = call.caller?.file
      if (!file)
        continue
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push(call)
    }

    const lines = Object.entries(grouped).flatMap(([file, items]) => {
      const itemLines = items.map((call) => {
        const parts: string[] = [tMcp('line {range}', { range: call.caller.range })]
        if (call.caller.namePosition)
          parts.push(tMcp('name at {pos}', { pos: call.caller.namePosition }))
        if (call.caller.detail)
          parts.push(tMcp('detail: {detail}', { detail: call.caller.detail }))
        if (call.callSites?.length)
          parts.push(tMcp('called at: {sites}', { sites: call.callSites.join(', ') }))
        return `  - \`${call.caller.name}\` (${call.caller.kind}): ${parts.join(', ')}`
      })
      return [`\`${file}\``, ...itemLines]
    })

    return `## Incoming Calls\n\n${lines.join('\n')}`
  }

  formatOutgoingCalls(calls: Record<string, any>[]): string {
    if (calls.length === 0)
      return `## Outgoing Calls\n\n${tMcp('No outgoing calls found or operation not supported.')}`
    const grouped: Record<string, any[]> = {}

    for (const call of calls) {
      const file = call.callee?.file
      if (!file)
        continue
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push(call)
    }

    const lines = Object.entries(grouped).flatMap(([file, items]) => {
      const itemLines = items.map((call) => {
        const parts: string[] = [tMcp('line {range}', { range: call.callee.range })]
        if (call.callee.namePosition)
          parts.push(tMcp('name at {pos}', { pos: call.callee.namePosition }))
        if (call.callee.detail)
          parts.push(tMcp('detail: {detail}', { detail: call.callee.detail }))
        if (call.callSites?.length)
          parts.push(tMcp('called at: {sites}', { sites: call.callSites.join(', ') }))
        return `  - \`${call.callee.name}\` (${call.callee.kind}): ${parts.join(', ')}`
      })
      return [`\`${file}\``, ...itemLines]
    })

    return `## Outgoing Calls\n\n${lines.join('\n')}`
  }

  formatTruncation(result: string, shown: number, total: number): string {
    return `${result}\n\n${tMcp('(Showing {shown} of {total})', { shown, total })}`
  }

  /**
   * Recursively render a flattened symbol tree as a Markdown bullet line.
   *
   * @param sym - Flattened symbol object ({name, kind, range?, namePosition?, detail?, containerName?, children?})
   * @param depth - Current indentation level
   * @returns Markdown bullet string
   */
  private _renderFlatSymbol(sym: Record<string, any>, depth: number = 0): string {
    const indent = '  '.repeat(depth)
    const parts: string[] = []
    if (sym.range)
      parts.push(tMcp('line {range}', { range: sym.range }))
    if (sym.namePosition)
      parts.push(tMcp('name at {pos}', { pos: sym.namePosition }))
    if (sym.detail)
      parts.push(tMcp('detail: {detail}', { detail: sym.detail }))
    if (sym.containerName)
      parts.push(tMcp('nested in `{containerName}`', { containerName: sym.containerName }))

    let line = `${indent}- \`${sym.name}\` (${sym.kind})`
    if (parts.length > 0)
      line += `: ${parts.join(', ')}`

    if (sym.children && sym.children.length > 0) {
      const childLines = sym.children.map((c: Record<string, any>) => this._renderFlatSymbol(c, depth + 1))
      return `${line}\n${childLines.join('\n')}`
    }

    return line
  }
}
