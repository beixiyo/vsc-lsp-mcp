import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/**
 * 获取符号的引用位置
 *
 * @param uri 文档URI
 * @param line 行号（从0开始）
 * @param character 字符位置（从0开始）
 * @param includeDeclaration 是否包含声明
 * @returns 引用位置列表
 */
export async function getReferences(
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

    logger.info(`获取引用: ${uri} 行:${line} 列:${character}`)

    // 调用VSCode API获取引用位置
    const references = await vscode.commands.executeCommand<vscode.Location[]>(
      'vscode.executeReferenceProvider',
      document.uri,
      position,
    )

    return references || []
  }
  catch (error) {
    logger.error('获取引用失败', error)
    throw error
  }
}
