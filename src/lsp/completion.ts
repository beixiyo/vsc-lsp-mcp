import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/**
 * 获取代码补全建议
 *
 * @param uri 文档URI
 * @param line 行号（从0开始）
 * @param character 字符位置（从0开始）
 * @returns 补全建议列表
 */
export async function getCompletions(
  uri: string,
  line: number,
  character: number,
): Promise<vscode.CompletionList<vscode.CompletionItem>> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`无法找到文档: ${uri}`)
    }

    const position = new vscode.Position(line, character)

    logger.info(`获取代码补全: ${uri} 行:${line} 列:${character}`)

    // 调用VSCode API获取代码补全
    const completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
      'vscode.executeCompletionItemProvider',
      document.uri,
      position,
      undefined,
      30, // 限制数量，避免返回过多
    )

    return completionList
  }
  catch (error) {
    logger.error('获取代码补全失败', error)
    throw error
  }
}
