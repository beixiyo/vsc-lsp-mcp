# 发布说明

这个项目发布到两个扩展市场：

- VS Code Marketplace：`CJL.lsp-mcp`
- Open VSX：`CJL/lsp-mcp`

## Token 配置

VS Code Marketplace 使用 `VSCE_PAT`：

- 官方说明：https://code.visualstudio.com/api/working-with-extensions/publishing-extension#get-a-personal-access-token
- Token 入口：https://dev.azure.com/
- 直接路径：`https://dev.azure.com/<你的 Azure DevOps 组织名>/_usersSettings/tokens` 如 https://dev.azure.com/2662442385/_usersSettings/tokens
- Scope：选择 `Custom defined`，展开 `Show all scopes`，勾选 `Marketplace > Manage`

```bash
export VSCE_PAT=''
```

Open VSX 使用 `OVSX_PAT`：

- Token 入口：https://open-vsx.org/user-settings/tokens

```bash
export OVSX_PAT=''
```

## 发布前检查

```bash
pnpm release:prepare
```

`pnpm release:prepare` 会依次运行测试、类型检查，并生成 `lsp-mcp.vsix`。`pnpm vsix` 会运行 `vscode:prepublish`，因此打包前会自动构建

## 发布命令

发布到 VS Code Marketplace：

```bash
pnpm release:vscode
```

发布到 Open VSX：

```bash
pnpm release:open-vsx
```

两个市场都发布：

```bash
pnpm release:all
```

不要添加 `publish` / `publish:*` 脚本。`pnpm` 可以省略 `run`，`pnpm publish` 会和 npm 包发布语义冲突

三个发布命令都会先执行 `release:prepare`，然后发布同一个 `lsp-mcp.vsix`

## 首次 Open VSX 配置

如果 `CJL` namespace 还没有创建，先执行：

```bash
pnpm exec ovsx create-namespace CJL
```

Open VSX 的 namespace 必须和 `package.json` 里的 `publisher` 保持一致
