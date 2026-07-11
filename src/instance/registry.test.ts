import type { InstanceRecord } from './registry'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { listInstances, publicInstance, writeInstance } from './registry'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map(path => rm(path, { force: true, recursive: true })))
})

describe('instance registry', () => {
  it('atomically stores active instances without exposing routing secrets', async () => {
    const root = await temporaryRoot()
    const record = fixture({ updatedAt: 1000 })
    await writeInstance(record, root)

    const instances = await listInstances(root, 2000)
    expect(instances).toEqual([record])
    expect(publicInstance(record)).not.toHaveProperty('token')
    expect(publicInstance(record)).not.toHaveProperty('endpoint')
  })

  it('removes expired instance records', async () => {
    const root = await temporaryRoot()
    await writeInstance(fixture({ updatedAt: 1000 }), root)

    expect(await listInstances(root, 20_000)).toEqual([])
  })
})

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'vsc-lsp-mcp-registry-'))
  temporaryRoots.push(root)
  return root
}

function fixture(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    instanceId: 'project:1:a',
    projectId: 'project',
    pid: 1,
    label: 'project',
    cwd: '/code/project',
    roots: ['/code/project'],
    schemes: ['file'],
    locale: 'en',
    endpoint: 'http://127.0.0.1:1234',
    token: 'secret',
    updatedAt: Date.now(),
    ...overrides,
  }
}
