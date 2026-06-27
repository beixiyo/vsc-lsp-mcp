## 项目结构

- `src/index.ts`：VS Code 扩展入口，激活后启动 MCP 服务
- `src/mcp/`：MCP 服务相关逻辑，包括 HTTP transport、session、CORS、端口启动、VS Code MCP provider 与工具注册
- `src/lsp/`：对 VS Code LSP 能力的封装，负责定义、引用、补全、重命名、调用层级等操作
- `src/transform/`：将 VS Code / LSP 返回结果转换成 JSON 或 Markdown
- `src/utils/`：通用工具，目前主要是日志输出
- `l10n/`：运行时代码字符串的本地化资源，配合 `vscode.l10n.t` 使用
- `package.nls*.json`：`package.json` 中扩展描述、配置项等静态贡献点的本地化资源
- `dist/`：`tsup` 构建产物，不手写维护

## 开发命令

- 包管理器：`pnpm`
- 类型检查：`pnpm typecheck`
- 构建：`pnpm build`
- 打包前构建：`pnpm vscode:prepublish`
- 查看 VSIX 文件清单：`pnpm exec vsce ls --no-dependencies`
- 生成 VSIX：`pnpm vsix`

## 技术栈

- TypeScript
- VS Code Extension API
- MCP TypeScript SDK
- Express
- Zod
- tsup

以 `package.json`、`tsconfig.json`、`tsup.config.ts`、`pnpm-workspace.yaml` 为准，不要基于通用经验假设项目配置

## VS Code 扩展注意事项

- `package.json` 中面向用户的贡献项文本使用 `%key%`，对应文案写入 `package.nls.json` 与 `package.nls.<locale>.json`
- 顶层 `displayName` / `description` 是 Marketplace 展示与搜索字段，保持英文 literal，不要写成 `%key%`
- 运行时代码里的用户可见提示使用 `vscode.l10n.t`，对应非默认语言资源写入 `l10n/bundle.l10n.<locale>.json`
- 英文是默认 fallback：manifest 的英文 fallback 在 `package.nls.json`，运行时代码的英文 fallback 在源码字符串里
- 不要在扩展主进程里引入 `@vscode/l10n`，VS Code 会为扩展主进程加载本地化资源

## MCP 协议边界

- MCP tool name、operation name、参数名、JSON 字段名属于协议面，默认不要翻译
- MCP tool 描述、参数描述、Markdown 响应如果要多语言，需要单独设计配置项，不要直接跟随 VS Code UI 语言
- JSON 输出优先保持机器可读和稳定，不要为了展示语言修改字段名或结构

## 代码风格

- 无分号
- 两格缩进
- 字符串使用单引号
- 不必要时避免 `export default`，优先具名导出
- 类型定义尽量放在文件底部，避免打断主流程阅读
- 保持改动窄范围，不引入无关抽象
