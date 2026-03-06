import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  getClassFileContents,
  getCompletions,
  getDefinition,
  getHover,
  getReferences,
  rename,
} from '../lsp'

const uriDesc = `The file URI in encoded format:
- Windows: "file:///c%3A/path/to/file.ts" (drive letter and colon, ":" encoded as "%3A")
- Unix-like: "file:///home/user/file.ts"
Must start with "file:///" and have special characters URI-encoded`

export function addLspTools(server: McpServer) {
  server.registerTool(
    'get_completions',
    {
      title: 'Get Code Completions',
      description: 'Get code completion suggestions for a given position in a document.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getCompletions(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_definition',
    {
      title: 'Get Definition',
      description: 'Get the definition location of a symbol.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getDefinition(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_hover',
    {
      title: 'Get Hover Information',
      description: 'Get hover information for a symbol at a given position.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getHover(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_references',
    {
      title: 'Get References',
      description: 'Find all references to a symbol.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
      },
    },
    async ({ uri, line, character }) => {
      const result = await getReferences(uri, line, character)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )

  server.registerTool(
    'get_class_file_contents',
    {
      title: 'Get Class File Contents',
      description: 'Get decompiled source code of a Java class file via jdt:// URI. Use this to retrieve the source of library/dependency classes that jdtls references. The jdt:// URI is typically obtained from definition or hover results.',
      inputSchema: {
        uri: z.string().describe('The jdt:// URI of the class file. Typically obtained from go-to-definition results pointing to dependency classes.'),
      },
    },
    async ({ uri }) => {
      const result = await getClassFileContents(uri)
      return { content: [{ type: 'text', text: result }] }
    },
  )

  server.registerTool(
    'rename_symbol',
    {
      title: 'Rename Symbol',
      description: 'Rename a symbol across the workspace.',
      inputSchema: {
        uri: z.string().describe(uriDesc),
        line: z.number().describe('The line number (0-based).'),
        character: z.number().describe('The character position (0-based).'),
        newName: z.string().describe('The new name for the symbol.'),
      },
    },
    async ({ uri, line, character, newName }) => {
      const result = await rename(uri, line, character, newName)
      return { content: [{ type: 'text', text: JSON.stringify(result) }] }
    },
  )
}
