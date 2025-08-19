# VSCode LSP MCP

<p align="center">
  <img src="res/icon.webp" width="128" height="128" alt="LSP MCP Icon">
</p>

<p align="center">
  <img alt="License" src="https://img.shields.io/badge/License-MIT-yellow.svg" />
  <img alt="github" src="https://img.shields.io/badge/GitHub-181717?logo=github&logoColor=white" />
</p>

<p align="center">
  <a href="./README.md">English</a> | <a href="./README.zh-CN.md">中文</a>
</p>

## 🔍 Overview

VSCode LSP MCP is a Visual Studio Code extension that exposes Language Server Protocol (LSP) features through the Model Context Protocol (MCP). This allows AI assistants and external tools to utilize VSCode's powerful language intelligence capabilities without direct integration.

![vscode-ext](./docAssets/vsc-ext.webp)
![demo](./docAssets/demo.webp)

### 🌟 Why This Extension?

Large language models like Claude and Cursor struggle to understand your codebase accurately because:

- They rely on regex patterns to find symbols, leading to false matches
- They can't analyze import/export relationships properly
- They don't understand type hierarchies or inheritance
- They have limited code navigation capabilities

This extension bridges that gap, providing AI tools with the same code intelligence that VSCode uses internally!

## ⚙️ Features

- 🔄 **LSP Bridge**: Converts LSP features into MCP tools
- 🔌 **Multi-Instance Support**: Automatically handles port conflicts for multiple VSCode windows
- 🧠 **Rich Code Context**: Provides accurate symbol information through LSP

## 🛠️ Exposed MCP Tools

| Tool | Description |
|------|-------------|
| `get_hover` | Get hover information for symbols |
| `get_definition` | Find symbol definitions |
| `get_completions` | Get intelligent code completions |
| `get_references` | Find all references to a symbol |
| `rename_symbol` | Rename symbols across files |

## 📋 Configuration

<!-- configs -->

| Key                  | Description                                                              | Type      | Default |
| -------------------- | ------------------------------------------------------------------------ | --------- | ------- |
| `lsp-mcp.enabled`    | Enable or disable the LSP MCP server.                                    | `boolean` | `true`  |
| `lsp-mcp.port`       | Port for the LSP MCP server.                                             | `number`  | `9527`  |
| `lsp-mcp.maxRetries` | Maximum number of port retry attempts when the default port is occupied. | `number`  | `10`    |

<!-- configs -->

## 🔗 Integration with AI Tools

### Cursor

[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.png)](https://cursor.com/install-mcp?name=lsp&config=JTdCJTIydXJsJTIyJTNBJTIyaHR0cCUzQSUyRiUyRjEyNy4wLjAuMSUzQTk1MjclMkZtY3AlMjIlN0Q%3D)

```json
{
  "mcpServers": {
    "lsp": {
      "url": "http://127.0.0.1:9527/mcp"
    }
  }
}
```

### Roo Code

```json
{
  "mcpServers": {
    "lsp": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:9527/mcp",
      "disabled": false
    }
  }
}
```

## 💻 Development

- Clone the repository
- Run `pnpm install`
- Run `pnpm run update` to generate metadata
- Press `F5` to start debugging
