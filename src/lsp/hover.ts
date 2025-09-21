import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/**
 * 获取指定位置的悬停信息
 *
 * @param uri 文档URI
 * @param line 行号（从0开始）
 * @param character 字符位置（从0开始）
 * @returns 悬停信息对象
 */
export async function getHover(
  uri: string,
  line: number,
  character: number,
): Promise<vscode.Hover[]> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`无法找到文档: ${uri}`)
    }

    const position = new vscode.Position(line, character)

    logger.info(`获取悬停信息: ${uri} 行:${line} 列:${character}`)

    // 调用VSCode API获取悬停信息
    const hoverResults = await vscode.commands.executeCommand<vscode.Hover[]>(
      'vscode.executeHoverProvider',
      document.uri,
      position,
    )

    return hoverResults || []
  }
  catch (error) {
    logger.error('获取悬停信息失败', error)
    throw error
  }
}
