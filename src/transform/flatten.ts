import * as vscode from 'vscode'

/**
 * Build a value-to-name map from a TypeScript numeric enum
 *
 * @param enumObj - A TypeScript numeric enum object
 * @returns Record mapping numeric values to their string names
 */
function generateEnumNameMap<T extends Record<string, string | number>>(enumObj: T): Record<number, string> {
  return Object.fromEntries(
    Object.entries(enumObj)
      .filter(([, v]) => typeof v === 'number')
      .map(([k, v]) => [v, k]),
  ) as Record<number, string>
}

export const kindNames = generateEnumNameMap(vscode.CompletionItemKind)
export const symbolKindNames = generateEnumNameMap(vscode.SymbolKind)

/**
 * Convert a VSCode Range to a compact 1-based string pair with character offsets
 * Kept for namePosition and callSites which need character-level precision.
 *
 * @param range - VSCode Range (0-based internally)
 * @returns string with "line:char" sub strings for start and end (1-based)
 */
export function formatRange(range: vscode.Range): string {
  return `${range.start.line + 1}:${range.start.character + 1}-${range.end.line + 1}:${range.end.character + 1}`
}

/**
 * Resolve a URI to its file system path string
 *
 * @param uri - VSCode Uri
 * @returns File path string
 */
export function getFile(uri: vscode.Uri): string {
  return uri.fsPath || uri.toString()
}

/**
 * Flatten a Location to a plain object
 *
 * @param loc - VSCode Location
 * @returns Plain object with file, range
 */
export function flattenLocation(loc: vscode.Location): Record<string, any> {
  return {
    file: getFile(loc.uri),
    range: formatRange(loc.range),
  }
}

/**
 * Flatten a LocationLink to a plain object
 *
 * @param link - VSCode LocationLink
 * @returns Plain object with file, range
 */
export function flattenLocationLink(link: vscode.LocationLink): Record<string, any> {
  return {
    file: getFile(link.targetUri),
    range: formatRange(link.targetRange),
  }
}

/**
 * Extract plain text from hover content item
 *
 * @param content - Hover content which may be MarkdownString, plain string, or MarkedString
 * @returns Extracted text content
 */
export function extractContentText(content: vscode.MarkdownString | vscode.MarkedString): string {
  if (typeof content === 'string') {
    return content
  }
  if (content instanceof vscode.MarkdownString) {
    return content.value
  }
  return content.value
}

/**
 * Flatten completion item label into a single string
 *
 * @param label - Completion item label which may be string or CompletionItemLabel
 * @returns Flattened label text
 */
export function flattenLabel(label: string | vscode.CompletionItemLabel): string {
  if (typeof label === 'string')
    return label
  let result = label.label
  if (label.detail)
    result += label.detail
  if (label.description)
    result += ` (${label.description})`
  return result
}

/**
 * Recursively flatten a symbol (SymbolInformation or DocumentSymbol) into a plain object
 * Keeps: name, kind, containerName, range, detail, children, namePosition (DocumentSymbol).
 * Strips: tags, file (SymbolInformation — file is implicit from the queried document).
 *
 * Recursion policy:
 * - Function / Method / Constructor: children are never included (body internals are noise).
 * - Class / Interface / Struct / Object / Enum:  one level of direct children kept,
 *   but no deeper recursion into those children.
 * - All other containers (File, Module, Namespace etc.): full recursion.
 *
 * @param symbol - A DocumentSymbol or SymbolInformation instance
 * @param recurse - Whether to process children; internal parameter for recursion control
 * @returns Plain object with name, kind, location info, and optional children
 */
export function flattenSymbol(
  symbol: vscode.SymbolInformation | vscode.DocumentSymbol,
  recurse: boolean = true,
): Record<string, any> {
  const base: Record<string, any> = {
    name: symbol.name,
    kind: symbolKindNames[symbol.kind] ?? 'Unknown',
  }

  if ('location' in symbol) {
    base.range = formatRange(symbol.location.range)
    if (symbol.containerName)
      base.containerName = symbol.containerName
  }

  if ('detail' in symbol) {
    if (symbol.detail)
      base.detail = symbol.detail
    base.range = formatRange(symbol.range)
    base.namePosition = formatRange(symbol.selectionRange).split('-')[0]
  }

  // Symbol kinds whose body internals are never relevant for an outline
  const STOP_KINDS = new Set([
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Method,
    vscode.SymbolKind.Constructor,
  ])

  // Symbol kinds that act as containers; show one level of direct members only
  const LEAF_CONTAINER_KINDS = new Set([
    vscode.SymbolKind.Class,
    vscode.SymbolKind.Interface,
    vscode.SymbolKind.Struct,
    vscode.SymbolKind.Object,
    vscode.SymbolKind.Enum,
  ])

  if ('children' in symbol && symbol.children.length > 0 && recurse) {
    if (STOP_KINDS.has(symbol.kind)) {
      // Function / Method / Constructor: skip children entirely
    }
    else {
      const deep = !LEAF_CONTAINER_KINDS.has(symbol.kind)
      base.children = symbol.children.map(child => flattenSymbol(child, deep))
    }
  }

  return base
}

/**
 * Flatten workspace SymbolInformation[] with built-in local-variable filtering.
 *
 * A Variable whose container resolves to a Function / Method / Constructor is a
 * function-local variable and is excluded — it provides no value for Agent-driven
 * API discovery. Variables nested in a Class, Namespace, Module, Package etc. are
 * kept because they represent legitimate API surface.
 *
 * @param symbols - Raw SymbolInformation array from the workspace symbol provider
 * @returns Array of flattened symbol objects ready for formatting
 */
export async function flattenWorkspaceSymbols(
  symbols: readonly vscode.SymbolInformation[],
): Promise<Record<string, any>[]> {
  const docSymbolsCache = new Map<string, Promise<(vscode.SymbolInformation | vscode.DocumentSymbol)[]>>()

  const FUNCTION_LIKE = new Set([
    vscode.SymbolKind.Function,
    vscode.SymbolKind.Method,
    vscode.SymbolKind.Constructor,
  ])

  const VARIABLE_LIKE = new Set([
    vscode.SymbolKind.Variable,
    vscode.SymbolKind.Field,
    vscode.SymbolKind.Property,
    vscode.SymbolKind.Constant,
  ])

  async function resolveContainerKind(
    uri: vscode.Uri,
    containerName: string,
    targetRange: vscode.Range,
  ): Promise<vscode.SymbolKind | undefined> {
    const key = uri.toString()
    if (!docSymbolsCache.has(key)) {
      docSymbolsCache.set(
        key,
        Promise.resolve(
          vscode.commands.executeCommand<(vscode.SymbolInformation[] | vscode.DocumentSymbol[])>(
            'vscode.executeDocumentSymbolProvider',
          uri,
          ),
        ).then(result => result ?? []),
      )
    }

    const tree = await docSymbolsCache.get(key)!

    let bestKind: vscode.SymbolKind | undefined
    let bestSize = Infinity

    function walk(list: (vscode.SymbolInformation | vscode.DocumentSymbol)[]): void {
      for (const sym of list) {
        const r = 'location' in sym ? sym.location.range : sym.range
        if (sym.name === containerName && r.contains(targetRange)) {
          const size = r.end.line - r.start.line
          if (size < bestSize) {
            bestSize = size
            bestKind = sym.kind
          }
        }
        if ('children' in sym && sym.children.length > 0) {
          walk(sym.children)
        }
      }
    }

    walk(tree)
    return bestKind
  }

  const result: Record<string, any>[] = []

  for (const s of symbols) {
    if (VARIABLE_LIKE.has(s.kind) && s.containerName) {
      const containerKind = await resolveContainerKind(s.location.uri, s.containerName, s.location.range)
      if (containerKind !== undefined && FUNCTION_LIKE.has(containerKind)) {
        continue
      }
    }
    result.push({
      name: s.name,
      kind: symbolKindNames[s.kind] ?? 'Unknown',
      containerName: s.containerName || undefined,
      ...flattenLocation(s.location),
    })
  }

  return result
}

/**
 * Flatten a CallHierarchyItem into a plain object
 * Keeps: name, kind, detail, file, range, namePosition.
 * Strips: tags.
 *
 * @param item - VSCode CallHierarchyItem
 * @returns Plain object with name, kind, detail, file, range, namePosition
 */
export function flattenCallHierarchyItem(item: vscode.CallHierarchyItem): Record<string, any> {
  return {
    name: item.name,
    kind: symbolKindNames[item.kind] ?? 'Unknown',
    detail: item.detail || undefined,
    file: getFile(item.uri),
    range: formatRange(item.range),
    namePosition: formatRange(item.selectionRange).split('-')[0],
  }
}

/**
 * Flatten a CallHierarchyIncomingCall into a plain object
 *
 * @param call - VSCode CallHierarchyIncomingCall
 * @returns Plain object with caller info and call site ranges
 */
export function flattenIncomingCall(call: vscode.CallHierarchyIncomingCall): Record<string, any> {
  return {
    caller: flattenCallHierarchyItem(call.from),
    callSites: call.fromRanges.map(formatRange),
  }
}

/**
 * Flatten a CallHierarchyOutgoingCall into a plain object
 *
 * @param call - VSCode CallHierarchyOutgoingCall
 * @returns Plain object with callee info and call site ranges
 */
export function flattenOutgoingCall(call: vscode.CallHierarchyOutgoingCall): Record<string, any> {
  return {
    callee: flattenCallHierarchyItem(call.to),
    callSites: call.fromRanges.map(formatRange),
  }
}
