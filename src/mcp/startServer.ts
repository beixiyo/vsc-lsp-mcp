import type express from 'express'
import { l10n, window } from 'vscode'

/**
 * 尝试启动服务器，如果端口被占用则尝试其他端口
 * @param app - 应用实例
 * @param initialPort - 初始端口
 * @param maxRetries - 最大重试次数
 */
export function startServer(app: express.Express, initialPort: number, maxRetries: number) {
  let currentPort = initialPort
  let retries = 0
  let hasShownPortConflict = false

  const tryListen = () => {
    const server = app.listen(currentPort, (error: Error | undefined) => {
      // 不打印多个窗口同时启动的冲突
      if (error) {
        return
      }

      // 如果之前显示过端口冲突提示，则显示最终成功启动的消息
      if (hasShownPortConflict) {
        window.showInformationMessage(l10n.t(
          'LSP MCP server started on port {port} (original port {originalPort} was occupied).',
          { port: currentPort, originalPort: initialPort },
        ))
      }
      else {
        window.showInformationMessage(l10n.t(
          'LSP MCP server started on port {port}.',
          { port: currentPort },
        ))
      }
    })

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE' && retries < maxRetries) {
        // 端口被占用，尝试下一个端口
        retries++
        currentPort++
        hasShownPortConflict = true

        tryListen()
      }
      else {
        window.showErrorMessage(l10n.t(
          'Failed to start LSP MCP server: {message}',
          { message: err.message },
        ))
      }
    })
  }

  tryListen()
}
