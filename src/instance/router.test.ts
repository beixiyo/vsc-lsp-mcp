import type { InstanceRecord } from './registry'
import type { InstanceResolutionError } from './router'
import { describe, expect, it } from 'vitest'
import { resolveInstance } from './router'

describe('instance router', () => {
  it('selects an explicit instance before path matching', () => {
    const instances = [fixture('a', '/code/a'), fixture('b', '/code/b')]
    expect(resolveInstance(instances, 'b', '/code/a/file.ts').instanceId).toBe('b')
  })

  it('uses the longest workspace root prefix', () => {
    const instances = [fixture('root', '/code'), fixture('package', '/code/app')]
    expect(resolveInstance(instances, undefined, '/code/app/src/main.ts').instanceId).toBe('package')
  })

  it('rejects equally specific matches instead of guessing', () => {
    const instances = [fixture('a', '/code/app'), fixture('b', '/code/app')]
    expect(() => resolveInstance(instances, undefined, '/code/app/main.ts')).toThrowError(
      expect.objectContaining<Partial<InstanceResolutionError>>({ code: 'ambiguous_instance' }),
    )
  })

  it('accepts Windows separators at the protocol boundary', () => {
    const instances = [fixture('other', 'D:/code/app'), fixture('windows', 'C:/code/app')]
    expect(resolveInstance(instances, undefined, 'C:\\code\\app\\main.ts').instanceId).toBe('windows')
    expect(resolveInstance(instances, undefined, 'C:/code/app/main.ts').instanceId).toBe('windows')
  })

  it('preserves filesystem roots during prefix matching', () => {
    expect(resolveInstance([fixture('unix', '/')], undefined, '/tmp/main.ts').instanceId).toBe('unix')
    expect(resolveInstance([fixture('drive', 'C:/')], undefined, 'C:/main.ts').instanceId).toBe('drive')
  })

  it('routes single-slash file URIs by path', () => {
    const instances = [fixture('other', '/other'), fixture('unix', '/code/app')]
    expect(resolveInstance(instances, undefined, 'file:/code/app/main.ts').instanceId).toBe('unix')
  })

  it('distinguishes missing IDs, unmatched paths, and an empty registry', () => {
    const instances = [fixture('a', '/code/a')]
    expect(() => resolveInstance(instances, 'missing', '/code/a/main.ts')).toThrowError(
      expect.objectContaining<Partial<InstanceResolutionError>>({ code: 'instance_not_found' }),
    )
    expect(() => resolveInstance(instances, undefined, '/code/b/main.ts')).toThrowError(
      expect.objectContaining<Partial<InstanceResolutionError>>({ code: 'no_matching_instance' }),
    )
    expect(() => resolveInstance([], undefined, undefined)).toThrowError(
      expect.objectContaining<Partial<InstanceResolutionError>>({ code: 'no_active_instances' }),
    )
  })
})

function fixture(instanceId: string, root: string): InstanceRecord {
  return {
    instanceId,
    projectId: instanceId,
    pid: 1,
    label: instanceId,
    roots: [root],
    schemes: ['file'],
    locale: 'en',
    endpoint: 'http://127.0.0.1:1234',
    token: 'secret',
    updatedAt: Date.now(),
  }
}
