import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(__dirname, '..')

describe('extension manifest', () => {
  it('declares the VS Code MCP server provider', () => {
    const pkg = readJson('package.json')

    expect(pkg.engines.vscode).toBe('^1.101.0')
    expect(pkg.devDependencies['@types/vscode']).toBe('1.101.0')
    expect(pkg.contributes.mcpServerDefinitionProviders).toEqual([
      {
        id: 'lsp-mcp.localServer',
        label: '%lsp-mcp.mcpServerDefinitionProvider.localServer.label%',
      },
    ])
  })

  it('keeps provider labels localized in package.nls files', () => {
    for (const file of ['package.nls.json', 'package.nls.zh-cn.json']) {
      const nls = readJson(file)

      expect(nls['lsp-mcp.mcpServerDefinitionProvider.localServer.label']).toBeTruthy()
    }
  })

  it('uses lsp-mcp consistently in README examples', () => {
    for (const file of ['README.md', 'README.zh-CN.md']) {
      const text = readFileSync(resolve(root, file), 'utf8')

      expect(text).not.toContain('"lsp": {')
      expect(text).not.toContain('[mcp_servers.lsp]')
    }
  })
})

function readJson(file: string) {
  return JSON.parse(readFileSync(resolve(root, file), 'utf8'))
}
