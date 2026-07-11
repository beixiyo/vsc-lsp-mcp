import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { InstanceRecord } from '../instance/registry'
import { mkdtemp, rm } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { afterEach, describe, expect, it } from 'vitest'
import { writeInstance } from '../instance/registry'
import { startBroker } from './server'

const disposers: Array<() => Promise<void>> = []
const originalRegistry = process.env.VSC_LSP_MCP_REGISTRY

afterEach(async () => {
  for (const dispose of disposers.splice(0).reverse())
    await dispose()
  if (originalRegistry == null)
    delete process.env.VSC_LSP_MCP_REGISTRY
  else
    process.env.VSC_LSP_MCP_REGISTRY = originalRegistry
})

describe('multi-instance broker', () => {
  it('lists instances and routes an LSP request by longest path prefix', async () => {
    const registry = await mkdtemp(join(tmpdir(), 'vsc-lsp-mcp-broker-'))
    process.env.VSC_LSP_MCP_REGISTRY = registry
    disposers.push(() => rm(registry, { force: true, recursive: true }))

    const broad = await fakeInstance('broad', '/code')
    const exact = await fakeInstance('exact', '/code/app')
    await writeInstance(broad.record)
    await writeInstance(exact.record)
    disposers.push(broad.dispose, exact.dispose)

    const broker = await startBroker({
      port: 0,
      corsEnabled: false,
      corsOrigins: '*',
      corsCredentials: false,
      corsExposeHeaders: 'Mcp-Session-Id',
      locale: 'en',
    })
    disposers.push(broker.dispose)
    const client = new Client({ name: 'broker-test', version: '1.0.0' })
    await client.connect(new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${broker.port}/mcp`),
    ))
    disposers.push(() => client.close())

    const listed = await client.callTool({ name: 'list_instances', arguments: {} })
    const listedText = textContent(listed.content)
    expect(JSON.parse(listedText).instances).toHaveLength(2)
    expect(listedText).not.toContain('secret')

    const routed = await client.callTool({
      name: 'execute_lsp',
      arguments: {
        operation: 'hover',
        uri: '/code/app/src/main.ts',
        line: 1,
        character: 1,
      },
    })
    expect(textContent(routed.content)).toBe('exact:/code/app/src/main.ts')

    const failed = await client.callTool({
      name: 'execute_lsp',
      arguments: {
        operation: 'hover',
        uri: '/code/error.ts',
        line: 1,
        character: 1,
        instanceId: 'broad',
      },
    })
    expect(JSON.parse(textContent(failed.content)).error).toEqual({
      code: 'mock_failure',
      message: 'Mock instance failed',
    })

    await writeInstance({ ...exact.record, instanceId: 'duplicate', updatedAt: Date.now() })
    const ambiguous = await client.callTool({
      name: 'execute_lsp',
      arguments: {
        operation: 'hover',
        uri: '/code/app/src/main.ts',
        line: 1,
        character: 1,
      },
    })
    expect(JSON.parse(textContent(ambiguous.content)).error.code).toBe('ambiguous_instance')
  })
})

async function fakeInstance(instanceId: string, root: string): Promise<{
  record: InstanceRecord
  dispose: () => Promise<void>
}> {
  const token = `secret-${instanceId}`
  const server = createServer((req, res) => {
    if (req.headers['x-lsp-mcp-token'] !== token) {
      res.writeHead(401, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: { message: 'unauthorized' } }))
      return
    }
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      const input = JSON.parse(body)
      if (input.uri.endsWith('/error.ts')) {
        res.writeHead(500, { 'content-type': 'application/json' })
        res.end(JSON.stringify({
          error: { code: 'mock_failure', message: 'Mock instance failed' },
        }))
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ result: `${instanceId}:${input.uri}` }))
    })
  })
  await listen(server)
  const port = (server.address() as AddressInfo).port

  return {
    record: {
      instanceId,
      projectId: instanceId,
      pid: process.pid,
      label: instanceId,
      roots: [root],
      schemes: ['file'],
      locale: 'en',
      endpoint: `http://127.0.0.1:${port}`,
      token,
      updatedAt: Date.now(),
    },
    dispose: () => close(server),
  }
}

function listen(server: Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', resolve)
    server.once('error', reject)
  })
}

function close(server: Server): Promise<void> {
  return new Promise(resolve => server.close(() => resolve()))
}

function textContent(content: unknown): string {
  const item = (content as Array<{ type: string, text?: string }>)[0]
  if (item?.type !== 'text' || item.text == null)
    throw new Error('Expected MCP text content')
  return item.text
}
