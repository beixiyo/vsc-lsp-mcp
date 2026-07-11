import type { InstanceRecord } from './registry'
import { fileURLToPath } from 'node:url'
import { normalizeRoutingPath } from './registry'

/**
 * 根据显式实例 ID 或最长工作区路径前缀选择目标 VS Code 窗口
 * 同等精确的多个候选会返回歧义错误，禁止静默猜测
 */
export function resolveInstance(
  instances: InstanceRecord[],
  instanceId?: string,
  uri?: string,
): InstanceRecord {
  if (instanceId) {
    const instance = instances.find(candidate => candidate.instanceId === instanceId)
    if (!instance)
      throw new InstanceResolutionError('instance_not_found', `Instance not found: ${instanceId}`)
    return instance
  }

  if (!uri)
    return resolveUnique(instances)

  const path = inputPath(uri)
  if (!path)
    return resolveUnique(instances)

  let longest = -1
  let matches: InstanceRecord[] = []
  for (const instance of instances) {
    for (const root of instance.roots) {
      const normalizedRoot = normalizeRoutingPath(root)
      if (!isPathInside(path, normalizedRoot))
        continue

      if (normalizedRoot.length > longest) {
        longest = normalizedRoot.length
        matches = [instance]
      }
      else if (normalizedRoot.length === longest && !matches.includes(instance)) {
        matches.push(instance)
      }
    }
  }

  if (matches.length === 1)
    return matches[0]
  if (matches.length > 1) {
    throw new InstanceResolutionError(
      'ambiguous_instance',
      'Multiple VS Code instances match this path; pass instanceId explicitly',
      matches.map(instance => instance.instanceId),
    )
  }

  throw new InstanceResolutionError('no_matching_instance', `No VS Code instance covers: ${uri}`)
}

function isPathInside(path: string, root: string): boolean {
  if (root === '/')
    return path.startsWith('/')
  if (/^[a-z]:\/$/i.test(root))
    return path.startsWith(root)
  return path === root || path.startsWith(`${root}/`)
}

function resolveUnique(instances: InstanceRecord[]): InstanceRecord {
  if (instances.length === 1)
    return instances[0]
  if (instances.length === 0)
    throw new InstanceResolutionError('no_active_instances', 'No active VS Code instances')

  throw new InstanceResolutionError(
    'ambiguous_instance',
    'Multiple VS Code instances are active; pass instanceId explicitly',
    instances.map(instance => instance.instanceId),
  )
}

function inputPath(uri: string): string | undefined {
  try {
    if (/^file:\/\//i.test(uri))
      return normalizeRoutingPath(fileURLToPath(uri))
    if (/^[a-z][a-z\d+.-]*:/i.test(uri))
      return undefined
    return normalizeRoutingPath(uri)
  }
  catch {
    return undefined
  }
}

/** 实例发现与路由失败的稳定协议错误 */
export class InstanceResolutionError extends Error {
  constructor(
    public readonly code:
      | 'instance_not_found'
      | 'no_matching_instance'
      | 'no_active_instances'
      | 'ambiguous_instance',
    message: string,
    public readonly candidates: string[] = [],
  ) {
    super(message)
  }
}
