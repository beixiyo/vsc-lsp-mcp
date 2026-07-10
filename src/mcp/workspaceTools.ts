import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { tMcp } from '../i18n'
import { transform } from '../transform'
import { renameResource } from '../workspace'

const sourceUriDesc = `Source absolute file system path or URI.
- Plain paths are converted with VS Code's Uri.file().
- URI values retain their scheme, including remote workspace schemes.`

const destinationUriDesc = `Destination absolute file system path or URI.
- Plain paths are converted with VS Code's Uri.file().
- URI values retain their scheme, including remote workspace schemes.`

/** Register workspace resource operations that are not LSP symbol operations. */
export function addWorkspaceTools(server: McpServer) {
  server.registerTool(
    'rename_resource',
    {
      title: tMcp('Rename Workspace Resource'),
      description: tMcp('Rename a file or directory through VS Code. Language extensions can update affected references during the operation.'),
      inputSchema: {
        oldUri: z.string().min(1).describe(tMcp(sourceUriDesc)),
        newUri: z.string().min(1).describe(tMcp(destinationUriDesc)),
        overwrite: z.boolean().optional().default(false).describe(tMcp('Whether an existing destination may be replaced. Defaults to false.')),
      },
    },
    async ({ oldUri, newUri, overwrite }) => {
      const result = await renameResource(oldUri, newUri, overwrite)

      return {
        content: [{
          type: 'text',
          text: transform.formatResourceRename(result),
        }],
      }
    },
  )
}
