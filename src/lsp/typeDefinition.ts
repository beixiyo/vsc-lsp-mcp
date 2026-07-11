import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/** 获取符号的类型定义位置 */
export async function getTypeDefinition(
  uri: string,
  line: number,
  character: number,
): Promise<vscode.Location[] | vscode.LocationLink[]> {
  const document = await getDocument(uri)
  if (!document)
    throw new Error(`Failed to find document: ${uri}`)

  try {
    return await vscode.commands.executeCommand<
      vscode.Location[] | vscode.LocationLink[]
    >(
      'vscode.executeTypeDefinitionProvider',
      document.uri,
      new vscode.Position(line, character),
    )
  }
  catch (error) {
    logger.error('Failed to get type definition', error)
    throw error
  }
}
