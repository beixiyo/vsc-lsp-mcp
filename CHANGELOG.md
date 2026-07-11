## Unreleased

### Added
- 新增独立多实例 Broker，外部 AI 通过一个稳定 MCP 地址发现并调用多个 VS Code 窗口
- 新增 `health` 与 `list_instances` 工具，`execute_lsp` / `rename_resource` 支持可选 `instanceId`
- 支持省略 `instanceId` 时按工作区根目录最长路径前缀自动路由，歧义时明确拒绝猜测

### Changed
- 每个 VS Code 窗口改为仅监听带随机 token 的 loopback 内部端点
- 实例注册表使用原子写入、心跳、TTL 清理，Broker 与任意窗口生命周期解耦
- 多实例首版支持范围明确为本机桌面 `file:` 工作区
- Broker 改为使用固定外部端口，端口被占用时明确失败，不再回退到客户端未知的其他端口
- CORS 改为默认关闭，浏览器 MCP 客户端可通过配置显式开启
- 实例路由错误细分为实例不存在、路径无匹配、无活动实例和多实例歧义
- 注册目录按当前用户隔离并校验权限，Broker 启动失败时会回滚当前窗口的内部服务

### Removed
- 移除不再适用于固定 Broker 地址的 `lsp-mcp.maxRetries` 配置

## [0.2.2] - 2026-07-02

### Added
- 新增 `lsp-mcp.mcpLocale` 配置项，控制 MCP 工具描述与响应文案的语言（#8）
  - `none`（默认）：跟随 VS Code 显示语言；`en` / `zh-cn`：强制指定语言
  - 切换配置后实时生效于新建的 MCP 会话，已连接的会话保持原语言（重连即可）
  - 仅 `outputFormat: markdown` 下响应文案参与翻译，`json` 输出不受影响
- 新增中文翻译包 `l10n/mcp.l10n.zh-cn.json`，覆盖 `execute_lsp` 工具描述、参数说明与全部响应文案
- 新增 i18n 单元测试：模板插值（含英文 fallback）、locale 解析与运行时切换、翻译 key 与源码英文原文双向一致性校验

### Changed
- i18n 模块清理：移除未使用的 `t()` 包装，MCP 文案统一走 `tMcp()`，VS Code 通知文案继续使用 `vscode.l10n.t`
- `mcpLocale` 配置监听器纳入 `context.subscriptions` 统一销毁，并在 MCP 启动前完成 locale 初始化

## [0.2.1] - 2026-06-27

### Fixed
- 修复 VS Code Marketplace 不解析顶层 `displayName` / `description` nls 占位符导致展示 `%lsp-mcp.displayName%` 的问题

### Changed
- 新增 `release:*` 发布脚本，统一先生成 `lsp-mcp.vsix`，再发布到 VS Code Marketplace 和 Open VSX
- 新增 `PUBLISHING.md`，记录 token 配置、发布前检查和双市场发布流程

## [0.2.0] - 2026-06-27

### Added
- 集成 VS Code Chat / Copilot MCP server definition provider
  - 扩展启动后直接向 VS Code 注册本地 HTTP MCP server
  - 使用实际监听端口生成 `http://127.0.0.1:<port>/mcp`，兼容多窗口端口 fallback
- 增加扩展 i18n 支持
  - `package.json` 静态贡献项使用 `package.nls*.json`
  - 运行时通知使用 `vscode.l10n.t`
  - 新增中文本地化资源
- 新增 `AGENTS.md`，记录项目结构、开发命令、VS Code 扩展注意事项和 MCP 协议边界

### Changed
- 最低 VS Code 版本提升到 `^1.101.0`，用于支持 MCP server definition provider API
- README 的 MCP server 名称统一为 `lsp-mcp`

## [0.1.0] - 2026-05-15

### Breaking Changes
- **Position 参数重构**：`position: "8:16"` (0-based string) → `line: 9, character: 17` (1-based integer)
  - 输入输出统一 1-based，与编辑器显示一致
  - `line` 和 `character` 为 optional，不需要位置的操作（`document_symbols`、`workspace_symbols`、`class_file_contents`）无需传入
  - 输出中的行列号（range、namePosition、callSites）同步改为 1-based，可直接用于链式调用

### Added
- 新增 `lsp-mcp.maxResults` 配置项（默认 200），控制 completions、workspace_symbols 等列表类结果的最大条目数
- Markdown 格式输出：`incoming_calls` / `outgoing_calls` 补充 `namePosition`，支持 LLM 链式调用
- 工具描述（tool description）大幅补充：每个操作包含返回值说明、链式调用提示

### Fixed
- `rename` 缺 `newName` / `workspace_symbols` 缺 `query` 时不再暴露 VSCode 内部 API 名，返回友好错误消息
- `completions` 输出不再无限增长（此前 React 项目实测 434K 字符），受 `maxResults` 配置截断
- Markdown 格式输出：`references` / `definition` / `declaration` / `implementation` 标题从硬编码 `## Locations` 改为与操作名匹配（`## References`、`## Definition` 等）
- `pnpm-workspace.yaml` 移除 `allowBuilds` placeholder 残留
- `src/lsp/tools.ts` 移除多余分号

## [0.0.6] - 2026-03-07

### Added
- 新增 `get_class_file_contents` MCP 工具
  - 通过 jdt:// URI 获取 jdtls 反编译的 Java 类源码
  - 典型用法：`get_definition` 返回依赖库中的 jdt:// URI 时，可调用本工具获取该类的反编译源码，便于 AI 阅读依赖实现

## [0.0.5] - 2025-10-04

### Added
- 添加 `Access-Control-Expose-Headers` 配置支持
  - 新增 `lsp-mcp.cors.exposeHeaders` 配置项，默认值为 `Mcp-Session-Id`
  - 支持逗号分隔的多个响应头配置
  - 允许浏览器访问指定的响应头，便于客户端获取会话信息

## [0.0.4] - 2025-10-03

### Added
- 添加跨域配置，方便 Web 测试

## [0.0.3] - 2025-08-19

### Added
- 当多个 VSCode 窗口同时运行时，简化端口冲突提示
  - 只在第一次端口冲突时显示警告消息，避免产生过多提示

## [0.0.2] - 2025-07-11

### Added
- 完成 LSP MCP 的开发，并发布到 VSCode、OpenVSX 扩展市场
