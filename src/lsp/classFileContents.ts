import * as vscode from 'vscode'
import { logger } from '../utils/logger'

/**
 * 通过 jdt:// URI 获取反编译的 Java 类文件源码
 *
 * @param uri jdt:// 格式的 URI
 * @returns 反编译后的源码文本
 */
export async function getClassFileContents(uri: string): Promise<string> {
  try {
    if (!uri.startsWith('jdt://')) {
      throw new Error(`无效的 URI 格式，需要 jdt:// 开头: ${uri}`)
    }

    logger.info(`获取类文件内容: ${uri}`)

    const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(uri))
    return doc.getText()
  }
  catch (error) {
    logger.error('获取类文件内容失败', error)
    throw error
  }
}
