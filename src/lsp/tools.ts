import * as vscode from 'vscode'
import { logger } from '../utils/logger'

/**
 * 根据URI获取文档对象
 * @param uri 文档URI
 * @returns 文档对象
 */
export async function getDocument(uri: string): Promise<vscode.TextDocument | undefined> {
  try {
    // 尝试从已打开的编辑器获取文档
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === uri) {
        return editor.document
      }
    }

    // 如果未找到，则尝试从文件系统加载
    return await vscode.workspace.openTextDocument(vscode.Uri.parse(uri))
  }
  catch (error) {
    logger.error(`获取文档失败: ${uri}`, error)
    return undefined
  }
}
