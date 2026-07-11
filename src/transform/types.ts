/**
 * Formatter interface for converting flattened LSP data into formatted text output.
 *
 * Implementations receive data that has already been through the flatten layer,
 * so they only need to concern themselves with string serialization.
 */
export interface Formatter {
  /**
   * Format extracted hover text contents
   *
   * @param contents - Array of plain text strings extracted from hover results
   * @returns Formatted string
   */
  formatHover: (contents: string[]) => string

  /** Format compact signature-help results. */
  formatSignatureHelp: (items: Record<string, any>[]) => string

  /**
   * Format completion items
   *
   * @param items - Array of flattened completion items ({label, kind?, detail?})
   * @returns Formatted string
   */
  formatCompletions: (items: Record<string, any>[]) => string

  /**
   * Format location results
   *
   * @param locations - Array of flattened locations ({file, range})
   * @param label - Display label for the section heading (e.g. "References", "Definition")
   * @returns Formatted string
   */
  formatLocations: (locations: Record<string, any>[], label?: string) => string

  /**
   * Format rename summary
   *
   * @param result - Flattened rename result ({success, newName, filesChanged, totalEdits})
   * @returns Formatted string
   */
  formatRename: (result: Record<string, any>) => string

  /**
   * Format a workspace resource rename result
   *
   * @param result - Resource rename details ({applied, oldUri, newUri})
   * @returns Formatted string
   */
  formatResourceRename: (result: Record<string, any>) => string

  /**
   * Format decompiled class file source text
   *
   * @param text - Raw source code string
   * @returns Formatted string
   */
  formatClassFile: (text: string) => string

  /**
   * Format document symbols (outline)
   *
   * @param symbols - Array of flattened symbols ({name, kind, range?, namePosition?, detail?, containerName?, children?})
   * @returns Formatted string
   */
  formatDocumentSymbols: (symbols: Record<string, any>[]) => string

  /**
   * Format workspace symbols
   *
   * @param symbols - Array of flattened workspace symbols ({name, kind, file, range, containerName?})
   * @returns Formatted string
   */
  formatWorkspaceSymbols: (symbols: Record<string, any>[]) => string

  /**
   * Format call hierarchy items
   *
   * @param items - Array of flattened call hierarchy items ({name, kind, detail?, file, range, namePosition})
   * @returns Formatted string
   */
  formatCallHierarchyItems: (items: Record<string, any>[]) => string

  /**
   * Format incoming calls
   *
   * @param calls - Array of flattened incoming calls ({caller: {name, kind, ...}, callSites: string[]})
   * @returns Formatted string
   */
  formatIncomingCalls: (calls: Record<string, any>[]) => string

  /**
   * Format outgoing calls
   *
   * @param calls - Array of flattened outgoing calls ({callee: {name, kind, ...}, callSites: string[]})
   * @returns Formatted string
   */
  formatOutgoingCalls: (calls: Record<string, any>[]) => string

  /** Attach a machine-readable or human-readable truncation summary. */
  formatTruncation: (result: string, shown: number, total: number) => string
}
