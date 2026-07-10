import type { Formatter } from './types'

/**
 * JsonFormatter converts flattened LSP data into JSON strings.
 * Items sharing the same file path are grouped together to reduce redundancy.
 */
export class JsonFormatter implements Formatter {
  formatHover(contents: string[]): string {
    return JSON.stringify(contents)
  }

  formatCompletions(items: Record<string, any>[]): string {
    return JSON.stringify(items)
  }

  formatLocations(locations: Record<string, any>[], _label?: string): string {
    const grouped: Record<string, Record<string, any>[]> = {}
    for (const loc of locations) {
      if (!grouped[loc.file])
        grouped[loc.file] = []
      grouped[loc.file].push({ range: loc.range })
    }
    return JSON.stringify(grouped)
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
    return JSON.stringify(symbols)
  }

  formatWorkspaceSymbols(symbols: Record<string, any>[]): string {
    const grouped: Record<string, any[]> = {}
    for (const s of symbols) {
      const { file, ...rest } = s
      if (!file)
        continue
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push(rest)
    }
    return JSON.stringify(grouped)
  }

  formatCallHierarchyItems(items: Record<string, any>[]): string {
    const grouped: Record<string, any[]> = {}
    for (const item of items) {
      const { file, ...rest } = item
      if (!file)
        continue
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push(rest)
    }
    return JSON.stringify(grouped)
  }

  formatIncomingCalls(calls: Record<string, any>[]): string {
    const grouped: Record<string, any[]> = {}
    for (const call of calls) {
      const file = call.caller?.file
      if (!file)
        continue
      const { file: _cf, ...callerRest } = call.caller || {}
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push({ caller: callerRest, callSites: call.callSites })
    }
    return JSON.stringify(grouped)
  }

  formatOutgoingCalls(calls: Record<string, any>[]): string {
    const grouped: Record<string, any[]> = {}
    for (const call of calls) {
      const file = call.callee?.file
      if (!file)
        continue
      const { file: _cf, ...calleeRest } = call.callee || {}
      if (!grouped[file])
        grouped[file] = []
      grouped[file].push({ callee: calleeRest, callSites: call.callSites })
    }
    return JSON.stringify(grouped)
  }
}
