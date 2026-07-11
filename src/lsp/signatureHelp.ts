import * as vscode from 'vscode'
import { logger } from '../utils/logger'
import { getDocument } from './tools'

/** 获取调用点的签名与当前参数信息 */
export async function getSignatureHelp(
  uri: string,
  line: number,
  character: number,
): Promise<vscode.SignatureHelp[]> {
  const document = await getDocument(uri)
  if (!document)
    throw new Error(`Failed to find document: ${uri}`)

  try {
    const result = await vscode.commands.executeCommand<vscode.SignatureHelp | undefined>(
      'vscode.executeSignatureHelpProvider',
      document.uri,
      new vscode.Position(line, character),
      undefined,
    )
    return result ? [result] : []
  }
  catch (error) {
    logger.error('Failed to get signature help', error)
    throw error
  }
}
