## 项目结构

- `src/index.ts`：VS Code Extension Host 入口，构建为 `dist/index.js`
- `src/mcp/index.ts`：当前 VS Code 窗口的启动编排，依次启动内部 Instance Server、确保共享 Broker 存在并注册 VS Code MCP provider
- `src/broker/main.ts`：独立 Broker 子进程入口，构建为 `dist/broker.js`，不属于 VS Code Extension Host
- `src/broker/`：共享 MCP Broker，负责单实例锁、稳定外部端口、MCP session、实例发现和请求转发
- `src/instance/`：每个 VS Code 窗口的内部服务、实例注册表和路由规则
- `src/mcp/`：在当前 VS Code 窗口内执行的 MCP/LSP 操作与 VS Code MCP provider
- `src/protocol.ts`：Broker 与内部 Instance Server 之间共享的请求类型和协议描述
- `src/filePermissions.ts`：注册表、状态文件和启动锁共用的私有文件权限常量
- `src/lsp/`：对 VS Code LSP 能力的封装，负责定义、引用、补全、重命名、调用层级等操作
- `src/transform/`：将 VS Code / LSP 返回结果转换成 JSON 或 Markdown
- `src/utils/`：通用工具，目前主要是日志输出
- `l10n/`：运行时代码字符串的本地化资源，配合 `vscode.l10n.t` 使用
- `package.nls*.json`：`package.json` 中扩展描述、配置项等静态贡献点的本地化资源
- `dist/`：`tsup` 构建产物，不手写维护

## 多实例架构

项目包含两个构建入口和两个独立进程：

```text
VS Code Extension Host
src/index.ts -> src/mcp/index.ts
  ├─ 启动当前窗口的 Instance Server
  ├─ 将窗口信息写入共享注册表
  ├─ 复用或启动独立 Broker
  └─ 注册 VS Code MCP provider

独立 Broker 进程
src/broker/main.ts -> src/broker/server.ts
  ├─ 对外提供单个 /mcp 地址
  ├─ 从注册表发现所有 VS Code 窗口
  ├─ 按 instanceId 或最长工作区路径前缀选择实例
  └─ 将请求转发到目标窗口的内部 loopback 端点
```

- `src/index.ts` 是 VS Code 直接加载的唯一扩展入口，对应 `package.json` 的 `main: ./dist/index.js`
- `src/broker/main.ts` 由 `src/broker/ensure.ts` 通过独立 Node 子进程启动，不由 VS Code 直接加载
- `tsup.config.ts` 必须同时产出 `dist/index.js` 和 `dist/broker.js`
- 外部 MCP 客户端只连接共享 Broker，不直接连接各窗口的内部端口
- 每个窗口使用随机内部端口和随机 token，仅监听 `127.0.0.1`
- Broker 生命周期必须与任意单个 VS Code 窗口解耦，关闭首个窗口不能导致其他窗口断线
- 多实例首版只承诺本机桌面 `file:` 工作区，不要未经设计直接宣称支持 Remote SSH、WSL、Dev Container 或虚拟工作区

## 推荐阅读顺序

理解启动与请求链路时按以下顺序阅读，不要从工具实现或注册表细节开始：

1. `src/index.ts`
2. `src/mcp/index.ts`
3. `src/instance/server.ts`
4. `src/broker/ensure.ts`
5. `src/broker/main.ts`
6. `src/broker/server.ts`
7. `src/broker/tools.ts`
8. `src/instance/router.ts`
9. `src/instance/registry.ts`

请求链路为：外部 MCP 客户端 -> 共享 Broker -> 实例路由 -> 目标 VS Code Instance Server -> LSP/Workspace 操作 -> Broker 原样返回结果

## 多实例实现约束

- 显式 `instanceId` 的优先级高于路径自动路由
- 自动路由使用工作区根目录的最长路径前缀，不允许使用简单字符串前缀误匹配相邻目录
- 同等精确的多个候选必须返回歧义错误，禁止随机选择实例
- 注册表中的 `endpoint` 和 `token` 仅供 Broker 内部使用，`list_instances` 不得暴露
- 实例记录使用心跳和 TTL 清理；写入状态或实例记录时保持原子替换
- MCP tool name、输入字段、输出字段和错误码都是协议契约，修改时同步测试与文档
- 不要重新引入“每个 VS Code 窗口占用一个外部 MCP 端口”的旧架构

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
