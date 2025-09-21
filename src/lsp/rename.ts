import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/**
 * 执行符号重命名
 * @param uri 文档URI
 * @param line 行号（从0开始）
 * @param character 字符位置（从0开始）
 * @param newName 新名称
 * @returns 返回应用的重命名编辑（WorkspaceEdit）
 */
export async function rename(
  uri: string,
  line: number,
  character: number,
  newName: string,
): Promise<vscode.WorkspaceEdit> {
  try {
    const document = await getDocument(uri)
    if (!document) {
      throw new Error(`无法找到文档: ${uri}`)
    }

    const position = new vscode.Position(line, character)

    logger.info(`执行重命名: ${uri} 行:${line} 列:${character} 新名称:${newName}`)

    // 1. 首先检查是否可以重命名
    const canRename = await vscode.commands.executeCommand<vscode.Range | { range: vscode.Range, placeholder: string }>(
      'vscode.prepareRename',
      document.uri,
      position,
    )

    if (!canRename) {
      throw new Error('当前位置不支持重命名')
    }

    // 2. 执行实际的重命名操作
    const edit = await vscode.commands.executeCommand<vscode.WorkspaceEdit>(
      'vscode.executeDocumentRenameProvider',
      document.uri,
      position,
      newName,
    )

    if (!edit) {
      throw new Error('重命名未返回任何更改')
    }

    // 3. 应用编辑（可选，如果调用方希望自己控制应用时机）
    await vscode.workspace.applyEdit(edit)

    return edit
  }
  catch (error) {
    logger.error('执行重命名失败', error)
    throw error
  }
}
