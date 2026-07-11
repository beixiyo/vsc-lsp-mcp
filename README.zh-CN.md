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

## 🔍 概述

VSCode LSP MCP 是一个 Visual Studio Code 扩展。**扩展 ID**：`cjl.lsp-mcp`

在 VS Code 中打开扩展视图（`Ctrl+Shift+X` / `Cmd+Shift+X`），搜索 **cjl.lsp-mcp** 可精确找到本插件

它通过模型上下文协议（MCP）暴露了语言服务器协议（LSP）功能。这使得 AI 助手和外部工具无需直接集成即可利用 VSCode 强大的语言智能功能

![vscode-ext](./docAssets/vsc-ext.webp)
![demo](./docAssets/demo.webp)

<a href="https://glama.ai/mcp/servers/@beixiyo/vsc-lsp-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@beixiyo/vsc-lsp-mcp/badge" alt="VSCode LSP Server MCP server" />
</a>

### 🌟 为什么需要这个扩展？

像 Claude 和 Cursor 这样的大型语言模型难以准确理解你的代码库，因为：

- 它们依赖正则表达式模式查找符号，导致错误匹配
- 它们无法正确分析导入/导出关系
- 它们不理解类型层次结构或继承关系
- 它们的代码导航能力有限

此扩展弥合了这一差距，为 AI 工具提供了与 VSCode 内部使用的相同的代码智能！

## ⚙️ 功能

- 🔄 **LSP 桥接**：将 LSP 功能转换为 MCP 工具
- 🤖 **VS Code Copilot 集成**：直接将本地 MCP 服务器注册到 VS Code Chat / Copilot
- 🔌 **多实例 Broker**：通过一个稳定 MCP 入口发现并路由到所有已打开的 VS Code 窗口
- 🧠 **15 项 LSP 操作**：涵盖代码导航（定义、声明、类型定义、实现、引用）、文档信息（悬停、签名帮助、补全）、结构分析（文档/工作区符号、调用层次）、代码重构（重命名）
- ☕ **Java 依赖源码**：通过 `jdt://` URI 获取 jdtls 反编译的类源码，便于 AI 阅读依赖库实现
- 📄 **双格式输出**：JSON 用于机器处理，Markdown 用于 LLM 友好阅读

## 🛠️ 暴露的 MCP 工具

| 工具 | 描述 |
|------|------|
| `health` | 查看共享 Broker 状态 |
| `list_instances` | 列出活动 VS Code 窗口、工作区根目录和实例 ID |
| `execute_lsp` | 在显式选择或自动匹配的实例中执行 LSP 操作 |
| `rename_resource` | 在匹配实例中重命名工作区文件或目录 |

### LSP 操作

| 操作 | 描述 |
|------|-------------|
| `hover` | 获取指定位置的悬停信息（文档、类型等） |
| `definition` | 获取符号的定义位置 |
| `declaration` | 获取符号的声明位置 |
| `type_definition` | 获取符号的类型定义位置 |
| `implementation` | 获取符号的实现位置 |
| `references` | 查找符号的所有引用位置 |
| `completions` | 获取智能代码补全建议 |
| `signature_help` | 获取调用点的签名与当前参数信息 |
| `document_symbols` | 获取文档的符号大纲树 |
| `workspace_symbols` | 按查询词在整个工作区搜索符号 |
| `class_file_contents` | 通过 jdt:// URI 获取反编译的 Java 类源码，用于阅读依赖库实现 |
| `rename` | 在工作区内重命名符号 |
| `symbol_at_position` | 获取指定位置的符号元数据（名称、类型、范围） |
| `incoming_calls` | 查找所有调用当前符号的位置 |
| `outgoing_calls` | 查找当前符号调用的所有被调用者 |

所有操作通过单个 `execute_lsp` MCP 工具调用，输入格式统一：
- `operation` — 要执行的 LSP 操作
- `uri` — 文件路径或 URI（支持普通路径和 `file://`/`jdt://` URI）
- `line` — 行号（**1-based**，与编辑器显示一致）。位置相关操作必填
- `character` — 列号（**1-based**，与编辑器显示一致）。位置相关操作必填
- `newName` — 仅 `rename` 操作需要
- `query` — 仅 `workspace_symbols` 操作需要
- `instanceId` — 可选，来自 `list_instances`；传入后优先于路径自动路由

> **1-based 位置**：输入和输出都使用 1-based 行列值，与编辑器显示一致。VS Code 显示 `Ln 9, Col 16` → 传 `line: 9, character: 16`。输出中的位置值可直接用于下一次调用，无需任何转换

### 多实例路由

每个 VS Code 窗口启动一个轻量内部端点并注册到共享 Broker。外部 AI 始终连接同一个 MCP URL。Broker 按以下顺序选择实例：

1. 显式传入的 `instanceId`
2. 与文件路径匹配的最长工作区根目录前缀
3. 无法通过路径识别且只有一个活动实例时，选择唯一实例

同一项目同时被两个窗口打开时，Broker 会明确返回歧义错误，不会静默猜测；调用方必须传入 `instanceId`。注册表不会向 MCP 客户端暴露内部凭据，失效窗口记录会自动过期

多实例首版仅承诺本机桌面工作区和 `file:` 资源。Remote SSH、WSL、Dev Container 与虚拟工作区暂不声明支持

### Workspace 工具（Unreleased）

| 工具 | 描述 |
|------|------|
| `rename_resource` | 通过 VS Code `WorkspaceEdit` API 重命名文件或目录，接收 `oldUri`、`newUri` 和可选的 `overwrite` 参数 |

> **已知问题：** VS Code 1.115 中资源可成功重命名，但 TypeScript import 路径可能不会更新。使用后请检查旧路径并运行类型检查

## 📋 配置

<!-- configs -->

| 设置                              | 描述                                                                                       | 类型      | 默认值  |
| --------------------------------- | ------------------------------------------------------------------------------------------ | --------- | ------- |
| `lsp-mcp.enabled`                 | 启用或禁用 LSP MCP 服务器                                                                  | `boolean` | `true`  |
| `lsp-mcp.port`                    | 共享 MCP Broker 的首选端口                                                                 | `number`  | `9527`  |
| `lsp-mcp.cors.enabled`            | 为浏览器 MCP 客户端启用 CORS；原生客户端保持关闭                                            | `boolean` | `false` |
| `lsp-mcp.cors.allowOrigins`       | 允许的 CORS 源。使用 `*` 允许所有源，或提供逗号分隔的源列表（例如 `http://localhost:3000,http://localhost:5173`） | `string`  | `*`     |
| `lsp-mcp.cors.withCredentials`    | 是否允许在 CORS 请求中携带凭证（cookie、授权标头）                                         | `boolean` | `false` |
| `lsp-mcp.cors.exposeHeaders`      | 允许浏览器访问的响应头。提供逗号分隔的头列表（例如 `Mcp-Session-Id`）        | `string`  | `Mcp-Session-Id` |
| `lsp-mcp.maxResults`           | 列表类结果的最大条目数（completions、workspace_symbols 等），防止 token 溢出 | `number` | `200` |
| `lsp-mcp.outputFormat`         | LSP 操作结果的输出格式。`json` 为机器可读 JSON，`markdown` 为 LLM 友好的 Markdown                  | `string`  | `json` |

<!-- configs -->

## 🔗 与 AI 工具集成

### VS Code Copilot

无需配置 `mcp.json`。扩展启动后，会通过 MCP server definition provider 将本地 LSP MCP 服务器注册到 VS Code

可以在 VS Code 中通过 **MCP: List Servers** 或聊天工具选择器启用和管理 **LSP MCP 服务器**

### Cursor

配置文件：`~/.cursor/mcp.json`（Windows 如 `%USERPROFILE%\.cursor\mcp.json`）

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

配置文件：`~/.config/opencode/opencode.jsonc`

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

配置文件：`~/.claude.json`

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

配置文件：`~/.gemini/settings.json`

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

## 💻 开发

- 克隆仓库
- 运行 `pnpm install`
- 运行 `pnpm run update` 生成元数据
- 按 `F5` 开始调试
