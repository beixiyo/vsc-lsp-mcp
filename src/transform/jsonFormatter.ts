import type { Formatter } from './types'

/** 将扁平化结果序列化为具有稳定顶层结构的 JSON */
export class JsonFormatter implements Formatter {
  formatHover(contents: string[]): string {
    return list(contents)
  }

  formatSignatureHelp(items: Record<string, any>[]): string {
    return list(items)
  }

  formatCompletions(items: Record<string, any>[]): string {
    return list(items)
  }

  formatLocations(locations: Record<string, any>[], _label?: string): string {
    const grouped: Record<string, Record<string, any>[]> = {}
    for (const loc of locations) {
      if (!grouped[loc.file])
        grouped[loc.file] = []
      grouped[loc.file].push({ range: loc.range })
    }
    return list(grouped)
  }

  formatRename(result: Record<string, any>): string {
    return JSON.stringify(result)
  }

  formatResourceRename(result: Record<string, any>): string {
    return JSON.stringify(result)
  }

  formatClassFile(text: string): string {
    return JSON.stringify({ language: 'java', source: text })
  }

  formatDocumentSymbols(symbols: Record<string, any>[]): string {
    return list(symbols)
  }

  formatWorkspaceSymbols(symbols: Record<string, any>[]): string {
    return list(groupByFile(symbols))
  }

  formatCallHierarchyItems(items: Record<string, any>[]): string {
    return list(groupByFile(items))
  }

  formatIncomingCalls(calls: Record<string, any>[]): string {
    const grouped: Record<string, any[]> = {}
    for (const call of calls) {
      const file = call.caller?.file
      if (!file)
        continue
      const { file: _file, ...caller } = call.caller
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push({ caller, callSites: call.callSites })
    }
    return list(grouped)
  }

  formatOutgoingCalls(calls: Record<string, any>[]): string {
    const grouped: Record<string, any[]> = {}
    for (const call of calls) {
      const file = call.callee?.file
      if (!file)
        continue
      const { file: _file, ...callee } = call.callee
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push({ callee, callSites: call.callSites })
    }
    return list(grouped)
  }

  formatTruncation(result: string, shown: number, total: number): string {
    return JSON.stringify({
      ...JSON.parse(result),
      truncated: { shown, total },
    })
  }
}

function list(items: unknown): string {
  return JSON.stringify({ items })
}

function groupByFile(items: Record<string, any>[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {}
  for (const item of items) {
    const { file, ...rest } = item
    if (!file)
      continue
    if (!grouped[file])
      grouped[file] = []
    grouped[file].push(rest)
  }
  return grouped
}
