import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/**
 * 获取符号定义位置
 *
 * @param uri 文档URI
 * @param line 行号（从0开始）
 * @param character 字符位置（从0开始）
 * @returns 定义位置信息
 */
export async function getDefinition(
  uri: string,
  line: number,
  character: number,
): Promise<vscode.Location[]> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`无法找到文档: ${uri}`)
    }

    const position = new vscode.Position(line, character)

    logger.info(`获取定义: ${uri} 行:${line} 列:${character}`)

    // 调用VSCode API获取定义位置
    const definitions = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeDefinitionProvider',
      document.uri,
      position,
    )

    return definitions || []
  }
  catch (error) {
    logger.error('获取定义失败', error)
    throw error
  }
}
