import type { CallNode, IncomingCallNode, OutgoingCallNode } from '../lsp/callHierarchy'
import type { CodeActionApplied, CodeActionPreview, CodeActionSummary } from '../lsp/codeActions'
import type { PrepareRenameResult, RenameApplied, RenamePreview } from '../lsp/rename'
import type { ResourceRenameResult } from '../workspace'
import type { Formatter } from './types'
import * as vscode from 'vscode'
import {
  extractContentText,
  flattenCallHierarchyItem,
  flattenDiagnostic,
  flattenDocumentHighlight,
  flattenDocumentLink,
  flattenIncomingCall,
  flattenInlayHint,
  flattenLocation,
  flattenLocationLink,
  flattenOutgoingCall,
  flattenSymbol,
  flattenWorkspaceSymbols,
} from './flatten'
import { JsonFormatter } from './jsonFormatter'
import { MarkdownFormatter } from './markdownFormatter'

/**
 * TransformService is the pipeline entry-point for all formatting operations.
 *
 * Data flow:
 *   raw VSCode API value  →  flatten  →  format (JSON or Markdown)
 *
 * - **flatten**: Converts VSCode-API-specific types (Location, Hover, SymbolInformation, etc.)
 *   into plain JSON-compatible objects (Record<string, any>). This strips type wrappers,
 *   resolves URIs to file paths, enumerates numeric kind values to human-readable names,
 *   and discards fields that are irrelevant for output (tags, targetSelectionRange, etc.).
 *   All flatten logic lives in flatten.ts.
 *
 * - **format**: Serialises the already-flattened plain objects into a final string.
 *   Two implementations exist: JsonFormatter (JSON.stringify) and MarkdownFormatter
 *   (LLM-friendly bullet-oriented Markdown). The format layer never touches VSCode types.
 *
 * The active formatter is determined by the `lsp-mcp.outputFormat` configuration.
 * It is cached and only recreated when the setting changes.
 */
export class TransformService {
  private _formatter: Formatter | null = null
  private _lastFormat: string | null = null

  private _getConfig() {
    const config = vscode.workspace.getConfiguration('lsp-mcp')
    return {
      maxResults: config.get<number>('maxResults', 200),
      outputFormat: config.get<string>('outputFormat', 'json'),
    }
  }

  private _getFormatter(): Formatter {
    const { outputFormat } = this._getConfig()
    if (outputFormat !== this._lastFormat || !this._formatter) {
      this._lastFormat = outputFormat
      this._formatter = outputFormat === 'markdown' ? new MarkdownFormatter() : new JsonFormatter()
    }
    return this._formatter
  }

  formatHover(hovers: vscode.Hover[]): string {
    const contents = hovers.map(h =>
      h.contents.map(extractContentText).filter(Boolean).join('\n\n').trim(),
    ).filter(Boolean)
    return this._formatLimited(contents, items => this._getFormatter().formatHover(items))
  }

  formatSignatureHelp(results: vscode.SignatureHelp[]): string {
    const items = results.flatMap(result => result.signatures.map((signature, index) => ({
      label: signature.label,
      documentation: signature.documentation
        ? extractContentText(signature.documentation)
        : undefined,
      active: index === result.activeSignature,
      activeParameter: index === result.activeSignature
        && (signature.activeParameter ?? result.activeParameter) != null
        ? (signature.activeParameter ?? result.activeParameter)! + 1
        : undefined,
      parameters: signature.parameters?.map(parameter => ({
        label: typeof parameter.label === 'string'
          ? parameter.label
          : signature.label.slice(parameter.label[0], parameter.label[1]),
        documentation: parameter.documentation
          ? extractContentText(parameter.documentation)
          : undefined,
      })),
    })))
    return this._formatLimited(items, limited => this._getFormatter().formatSignatureHelp(limited))
  }

  formatLocations(locations: vscode.Location[], label?: string): string {
    return this._formatLimited(locations.map(flattenLocation), items => this._getFormatter().formatLocations(items, label))
  }

  formatLocationsOrLinks(
    items: vscode.Location | vscode.Location[] | vscode.LocationLink[],
    label?: string,
  ): string {
    if (Array.isArray(items)) {
      if (items.length === 0)
        return this._getFormatter().formatLocations([], label)
      if ('targetUri' in items[0]) {
        return this._formatLimited(
          (items as vscode.LocationLink[]).map(flattenLocationLink),
          limited => this._getFormatter().formatLocations(limited, label),
        )
      }
      return this.formatLocations(items as vscode.Location[], label)
    }
    return this._getFormatter().formatLocations([flattenLocation(items)], label)
  }

  formatDiagnostics(
    items: { uri: vscode.Uri, diagnostic: vscode.Diagnostic }[],
    workspace: boolean,
  ): string {
    return this._formatLimited(
      items.map(item => flattenDiagnostic(item.uri, item.diagnostic)),
      limited => this._getFormatter().formatDiagnostics(limited, workspace),
    )
  }

  formatDocumentHighlights(items: vscode.DocumentHighlight[]): string {
    return this._formatLimited(
      items.map(flattenDocumentHighlight),
      limited => this._getFormatter().formatDocumentHighlights(limited),
    )
  }

  formatDocumentLinks(items: vscode.DocumentLink[]): string {
    return this._formatLimited(
      items.map(flattenDocumentLink),
      limited => this._getFormatter().formatDocumentLinks(limited),
    )
  }

  formatInlayHints(items: vscode.InlayHint[]): string {
    return this._formatLimited(
      items.map(flattenInlayHint),
      limited => this._getFormatter().formatInlayHints(limited),
    )
  }

  formatCodeActions(items: CodeActionSummary[]): string {
    return this._formatLimited(items, limited => this._getFormatter().formatCodeActions(limited))
  }

  formatCodeActionPreview(result: CodeActionPreview, documentFix = false): string {
    const { maxResults } = this._getConfig()
    const limited = { ...result, edits: result.edits.slice(0, maxResults) }
    const output = this._getFormatter().formatCodeActionPreview(limited, documentFix)
    return result.edits.length > maxResults
      ? this._getFormatter().formatTruncation(output, limited.edits.length, result.edits.length)
      : output
  }

  formatCodeActionApplied(result: CodeActionApplied): string {
    return this._getFormatter().formatCodeActionApplied(result)
  }

  formatPrepareRename(result: PrepareRenameResult): string {
    return this._getFormatter().formatPrepareRename(result)
  }

  formatRenamePreview(result: RenamePreview): string {
    const { maxResults } = this._getConfig()
    const limited = { ...result, edits: result.edits.slice(0, maxResults) }
    const output = this._getFormatter().formatRenamePreview(limited)
    return result.edits.length > maxResults
      ? this._getFormatter().formatTruncation(output, limited.edits.length, result.edits.length)
      : output
  }

  formatRenameApplied(result: RenameApplied): string {
    return this._getFormatter().formatRenameApplied(result)
  }

  formatResourceRename(result: ResourceRenameResult): string {
    return this._getFormatter().formatResourceRename(result)
  }

  formatClassFile(text: string): string {
    return this._getFormatter().formatClassFile(text)
  }

  formatDocumentSymbols(
    symbols: (vscode.DocumentSymbol | vscode.SymbolInformation)[],
  ): string {
    const flattened = symbols.map(sym => flattenSymbol(sym, true))
    const total = countSymbolNodes(flattened)
    const { maxResults } = this._getConfig()
    const items = limitSymbolNodes(flattened, maxResults)
    const result = this._getFormatter().formatDocumentSymbols(items)
    return total > maxResults
      ? this._getFormatter().formatTruncation(result, maxResults, total)
      : result
  }

  async formatWorkspaceSymbols(symbols: vscode.SymbolInformation[]): Promise<string> {
    const allItems = await flattenWorkspaceSymbols(symbols)
    return this._formatLimited(allItems, items => this._getFormatter().formatWorkspaceSymbols(items))
  }

  formatCallHierarchyItems(items: CallNode[]): string {
    return this._formatLimited(items.map(flattenCallHierarchyItem), limited => this._getFormatter().formatCallHierarchyItems(limited))
  }

  formatIncomingCalls(calls: IncomingCallNode[]): string {
    return this._formatLimited(calls.map(flattenIncomingCall), limited => this._getFormatter().formatIncomingCalls(limited))
  }

  formatOutgoingCalls(calls: OutgoingCallNode[]): string {
    return this._formatLimited(calls.map(flattenOutgoingCall), limited => this._getFormatter().formatOutgoingCalls(limited))
  }

  private _formatLimited<T>(items: T[], format: (items: T[]) => string): string {
    const { maxResults } = this._getConfig()
    const limited = items.slice(0, maxResults)
    const result = format(limited)
    return items.length > maxResults
      ? this._getFormatter().formatTruncation(result, limited.length, items.length)
      : result
  }
}

function countSymbolNodes(symbols: Record<string, any>[]): number {
  return symbols.reduce((total, symbol) =>
    total + 1 + countSymbolNodes(symbol.children ?? []), 0)
}

function limitSymbolNodes(symbols: Record<string, any>[], limit: number): Record<string, any>[] {
  let remaining = limit

  function visit(items: Record<string, any>[]): Record<string, any>[] {
    const result: Record<string, any>[] = []
    for (const item of items) {
      if (remaining === 0)
        break
      remaining--
      const children = visit(item.children ?? [])
      result.push(children.length > 0 ? { ...item, children } : { ...item, children: undefined })
    }
    return result
  }

  return visit(symbols)
}
