# VSCode LSP MCP

<p align="center">
  <img src="res/icon.webp" width="128" height="128" alt="LSP MCP Icon">
</p>

<p align="center">
  <a href="https://marketplace.visualstudio.com/items?itemName=CJL.lsp-mcp">
    <img alt="VS Marketplace Version" src="https://badgen.net/vs-marketplace/v/CJL.lsp-mcp" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=CJL.lsp-mcp">
    <img alt="VS Marketplace Installs" src="https://badgen.net/vs-marketplace/i/CJL.lsp-mcp" />
  </a>
  <a href="https://marketplace.visualstudio.com/items?itemName=CJL.lsp-mcp">
    <img alt="VS Marketplace Rating" src="https://badgen.net/vs-marketplace/rating/CJL.lsp-mcp" />
  </a>
  <a href="https://github.com/beixiyo/vsc-lsp-mcp">
    <img alt="GitHub Stars" src="https://img.shields.io/github/stars/beixiyo/vsc-lsp-mcp?style=flat" />
  </a>
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a>
</p>

## 🔍 Overview

VSCode LSP MCP is a Visual Studio Code extension that exposes Language Server Protocol (LSP) features through the Model Context Protocol (MCP).

**Extension ID**: `cjl.lsp-mcp` — open Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`) and search for **cjl.lsp-mcp** to find this plugin precisely.

This allows AI assistants and external tools to utilize VSCode's powerful language intelligence capabilities without direct integration.

> [!TIP]
> **Using Neovim?** See [vv-mcp.nvim](https://github.com/beixiyo/vv-mcp.nvim), the sibling implementation that exposes Neovim LSP clients and live editor context through MCP.

![vscode-ext](./docAssets/vsc-ext.webp)
![demo](./docAssets/demo.webp)

<a href="https://glama.ai/mcp/servers/@beixiyo/vsc-lsp-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@beixiyo/vsc-lsp-mcp/badge" alt="VSCode LSP Server MCP server" />
</a>

### 🌟 Why This Extension?

Large language models like Claude and Cursor struggle to understand your codebase accurately because:

- They rely on regex patterns to find symbols, leading to false matches
- They can't analyze import/export relationships properly
- They don't understand type hierarchies or inheritance
- They have limited code navigation capabilities

This extension bridges that gap, providing AI tools with the same code intelligence that VSCode uses internally!

## ⚙️ Features

- 🔄 **LSP Bridge**: Converts LSP features into MCP tools
- 🤖 **VS Code Copilot integration**: Registers the local MCP server directly with VS Code Chat / Copilot
- 🔌 **Multi-Instance Broker**: One stable MCP endpoint discovers and routes requests across all open VS Code windows
- 🧠 **25 LSP operations** covering navigation, diagnostics, document metadata, symbols, call hierarchy, transactional rename, and safe Code Actions
- ☕ **Java dependency source**: Get decompiled Java class source via jdt:// URI (from jdtls), so AI can read library implementations
- 📄 **Dual output format**: JSON for machine processing, Markdown for LLM-friendly reading

## 🛠️ Exposed MCP Tools

| Tool | Description |
|------|-------------|
| `health` | Report the shared broker status |
| `list_instances` | List active VS Code windows, workspace roots, and instance IDs |
| `execute_lsp` | Execute an LSP operation in an explicitly selected or automatically matched instance |
| `rename_resource` | Rename a workspace file or directory in the matching instance |

### LSP operations

| Operation | Description |
|-----------|-------------|
| `hover` | Get hover information (documentation, type, etc.) at a position |
| `definition` | Get the definition location of a symbol |
| `declaration` | Get the declaration location of a symbol |
| `type_definition` | Get the type definition location of a symbol |
| `implementation` | Get the implementation location(s) of a symbol |
| `references` | Find all references to a symbol |
| `document_highlight` | Find semantic occurrences of a symbol in the current document |
| `document_links` | Get navigable document links exposed by the active language extension |
| `inlay_hints` | Get inferred type and parameter-name hints for a document range |
| `signature_help` | Get signatures and active-parameter information at a call site |
| `document_symbols` | Get the symbol outline (tree) of a document |
| `workspace_symbols` | Search for symbols across the entire workspace by query |
| `diagnostics` | Get diagnostics for one file with optional severity, source, and code filters |
| `workspace_diagnostics` | Get filtered diagnostics under a workspace path |
| `code_actions` | List editable Code Actions at a position |
| `code_action_preview` | Preview one listed Code Action without side effects |
| `fix_document_preview` | Preview editable fix-all or quick-fix edits for an entire document |
| `code_action_apply` | Apply one previously previewed Code Action transaction |
| `class_file_contents` | Get decompiled Java class source via jdt:// URI (from jdtls), to read library/dependency implementations |
| `prepare_rename` | Locate and validate a rename candidate |
| `rename_preview` | Preview a symbol rename without modifying files |
| `rename_apply` | Apply one previously previewed rename transaction |
| `prepare_call_hierarchy` | Prepare call hierarchy nodes and return recursive `callId` values |
| `incoming_calls` | Find all callers of a symbol |
| `outgoing_calls` | Find all callees (calls made by) a symbol |

All operations are invoked through the single `execute_lsp` MCP tool with a unified input format:
- `operation` — which LSP operation to execute
- `uri` — file path or URI string (supports both plain paths and `file://`/`jdt://` URIs)
- `line` — line number (**1-based**, matching editor display). Required for position-dependent operations
- `character` — character offset (**1-based**, matching editor display). Required for position-dependent operations
- `newName` / `renameId` — used by the three-stage rename flow
- `actionKind` / `actionId` — filter and continue the Code Action transaction flow
- `query` — required only for `workspace_symbols`
- `symbolKinds`, `includeDeclaration`, `includeExternal`, `pathPattern`, `severities`, `sources`, `codes` — optional result filters applied before `maxResults`
- `startLine`, `endLine` — optional inclusive range for `inlay_hints`
- `callId` — returned by call hierarchy operations for recursive traversal
- `instanceId` — optional instance returned by `list_instances`; takes precedence over automatic path routing

> **1-based positions**: Both input and output use 1-based line/character values, matching what your editor displays. VS Code shows `Ln 9, Col 16` → pass `line: 9, character: 16`. Output positions can be used directly as input for the next call — no conversion needed.

### Multi-instance routing

The extension starts one lightweight internal endpoint per VS Code window and registers it with a shared broker. External clients keep using a single MCP URL. The broker selects an instance in this order:

1. Exact `instanceId`, when provided
2. Longest workspace-root prefix matching the input file path
3. The only active instance, when no path can identify one

If two windows open the same project, routing is intentionally rejected as ambiguous until the caller passes `instanceId`. The registry contains no public credentials and stale window records expire automatically.

The first multi-instance release supports local desktop workspaces and `file:` resources. Remote SSH, WSL, Dev Containers, and virtual workspaces are not yet advertised as supported.

### Workspace tools

| Tool | Description |
|------|-------------|
| `rename_resource` | Rename a file or directory through VS Code's `WorkspaceEdit` API. Accepts `oldUri`, `newUri`, and optional `overwrite` parameters. Language extensions can update affected imports and exports as part of the same workspace edit. |

For example, the built-in TypeScript provider updates relative imports and barrel exports when a referenced `.ts` or `.tsx` file is renamed. The exact companion edits remain language-provider dependent, so inspect diagnostics after applying a resource rename.

## 📋 Configuration

<!-- configs -->

| Key                           | Description                                                                                                                                           | Type      | Default |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------- | ------- |
| `lsp-mcp.enabled`             | Enable or disable the LSP MCP server.                                                                                                                 | `boolean` | `true`  |
| `lsp-mcp.port`                | Preferred port for the shared MCP broker.                                                                                                             | `number`  | `9527`  |
| `lsp-mcp.cors.enabled`        | Enable CORS for browser-based MCP clients. Keep disabled for native clients.                                                                          | `boolean` | `false` |
| `lsp-mcp.cors.allowOrigins`   | Allowed origins for CORS. Use `*` to allow all origins, or provide a comma-separated list of origins (e.g., `http://localhost:3000,http://localhost:5173`). | `string`  | `*`     |
| `lsp-mcp.cors.withCredentials` | Whether to allow credentials (cookies, authorization headers) in CORS requests.                                                                       | `boolean` | `false` |
| `lsp-mcp.cors.exposeHeaders`   | Headers that browsers are allowed to access. Provide a comma-separated list of headers (e.g., `Mcp-Session-Id`).                      | `string`  | `Mcp-Session-Id` |
| `lsp-mcp.maxResults`           | Maximum number of items returned for list-type results such as `workspace_symbols`. Prevents excessive token usage. | `number` | `200` |
| `lsp-mcp.outputFormat`         | Output format for LSP operation results. `json` for machine-readable JSON, `markdown` for LLM-friendly Markdown.                     | `string`  | `json` |
| `lsp-mcp.dependencyMarkers`    | Path substrings used to classify dependency results for sorting and `includeExternal=false`. | `string[]` | language-specific defaults |
 
<!-- configs -->

## 🔗 Integration with AI Tools

### VS Code Copilot

No `mcp.json` setup is required. After the extension starts, it registers the local LSP MCP server with VS Code through an MCP server definition provider.

Use **MCP: List Servers** or the chat tools picker in VS Code to enable or manage the **LSP MCP Server**.

### Cursor

Config file: `~/.cursor/mcp.json` (e.g. `%USERPROFILE%\.cursor\mcp.json` on Windows)

```json
{
  "mcpServers": {
    "lsp-mcp": {
      "url": "http://127.0.0.1:9527/mcp"
    }
  }
}
```

### OpenCode

Config file: `~/.config/opencode/opencode.jsonc`

```json
{
  "mcp": {
    "lsp-mcp": {
      "type": "remote",
      "url": "http://127.0.0.1:9527/mcp",
      "enabled": true
    }
  }
}
```

### Claude Code

Config file: `~/.claude.json`

```json
{
  "mcpServers": {
    "lsp-mcp": {
      "type": "http",
      "url": "http://127.0.0.1:9527/mcp"
    }
  }
}
```

### Gemini | IFlow

Config file: `~/.gemini/settings.json`

```json
{
  "mcpServers": {
    "lsp-mcp": {
      "type": "streamable-http",
      "httpUrl": "http://127.0.0.1:9527/mcp"
    }
  }
}
```

### Codex

Config file: `~/.codex/config.toml`

```toml
[mcp_servers.lsp-mcp]
url = "http://127.0.0.1:9527/mcp"
```

### Roo Code

```json
{
  "mcpServers": {
    "lsp-mcp": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:9527/mcp",
      "disabled": false
    }
  }
}
```

---

## 💻 Development

- Clone the repository
- Run `pnpm install`
- Run `pnpm run update` to generate metadata
- Press `F5` to start debugging
