import type express from 'express'
import { window } from 'vscode'

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
        window.showInformationMessage(`LSP MCP 启动在 ${currentPort}（原端口 ${initialPort} 被占用）`)
      }
      else {
        window.showInformationMessage(`LSP MCP 启动在 ${currentPort}`)
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
        window.showErrorMessage(`无法启动 LSP MCP 服务: ${err.message}`)
      }
    })
  }

  tryListen()
}
