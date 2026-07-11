import type { RenameResourceInput } from '../protocol'
import { transform } from '../transform'
import { renameResource } from '../workspace'

/** 在当前 VS Code 窗口中执行经过 Broker 路由的资源重命名 */
export async function executeResourceRename(input: RenameResourceInput): Promise<string> {
  const result = await renameResource(input.oldUri, input.newUri, input.overwrite ?? false)
  return transform.formatResourceRename(result)
}
