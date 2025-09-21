import * as vscode from 'vscode'

/**
 * 日志输出通道
 */
let outputChannel: vscode.OutputChannel | undefined

/**
 * 获取或创建日志输出通道
 */
function getOutputChannel(): vscode.OutputChannel {
  if (!outputChannel) {
    outputChannel = vscode.window.createOutputChannel('LSP MCP')
  }
  return outputChannel
}

/**
 * 日志记录器
 */
export const logger = {
  /**
   * 记录信息日志
   * @param message 日志消息
   * @param data 附加数据
   */
  info(message: string, data?: any): void {
    const output = getOutputChannel()
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [INFO] ${message}`

    output.appendLine(logMessage)
    if (data) {
      output.appendLine(`  Data: ${JSON.stringify(data, null, 2)}`)
    }
  },

  /**
   * 记录警告日志
   * @param message 日志消息
   * @param data 附加数据
   */
  warn(message: string, data?: any): void {
    const output = getOutputChannel()
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [WARN] ${message}`

    output.appendLine(logMessage)
    if (data) {
      output.appendLine(`  Data: ${JSON.stringify(data, null, 2)}`)
    }
  },

  /**
   * 记录错误日志
   * @param message 日志消息
   * @param error 错误对象
   */
  error(message: string, error?: any): void {
    const output = getOutputChannel()
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [ERROR] ${message}`

    output.appendLine(logMessage)
    if (error) {
      if (error instanceof Error) {
        output.appendLine(`  Error: ${error.message}`)
        output.appendLine(`  Stack: ${error.stack}`)
      }
      else {
        output.appendLine(`  Error: ${JSON.stringify(error, null, 2)}`)
      }
    }
  },

  /**
   * 记录调试日志
   * @param message 日志消息
   * @param data 附加数据
   */
  debug(message: string, data?: any): void {
    const output = getOutputChannel()
    const timestamp = new Date().toISOString()
    const logMessage = `[${timestamp}] [DEBUG] ${message}`

    output.appendLine(logMessage)
    if (data) {
      output.appendLine(`  Data: ${JSON.stringify(data, null, 2)}`)
    }
  },

  /**
   * 显示输出通道
   */
  show(): void {
    getOutputChannel().show()
  },

  /**
   * 清除日志
   */
  clear(): void {
    getOutputChannel().clear()
  },
}
