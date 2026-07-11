import { randomUUID } from 'node:crypto'
import { readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PRIVATE_FILE_MODE } from '../filePermissions'
import { createRegistry, getRegistryRoot } from '../instance/registry'

export const BROKER_PROTOCOL_VERSION = 1

/** 获取共享 Broker 状态文件路径 */
export function brokerStatePath(registryRoot = getRegistryRoot()): string {
  return join(registryRoot, 'broker.json')
}

/** 读取当前 Broker 的进程、端口和协议版本信息 */
export async function readBrokerState(
  registryRoot = getRegistryRoot(),
): Promise<BrokerState | undefined> {
  try {
    return JSON.parse(await readFile(brokerStatePath(registryRoot), 'utf8')) as BrokerState
  }
  catch {
    return undefined
  }
}

/** 原子写入 Broker 状态，避免其他 VS Code 窗口读到半份 JSON */
export async function writeBrokerState(
  state: BrokerState,
  registryRoot = getRegistryRoot(),
): Promise<void> {
  await createRegistry(registryRoot)
  const path = brokerStatePath(registryRoot)
  const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`
  await writeFile(temporaryPath, JSON.stringify(state), { mode: PRIVATE_FILE_MODE })
  await rename(temporaryPath, path)
}

/** 仅在状态仍属于预期进程时删除 Broker 状态 */
export async function removeBrokerState(
  registryRoot = getRegistryRoot(),
  expectedPid = process.pid,
): Promise<void> {
  const state = await readBrokerState(registryRoot)
  if (state && state.pid !== expectedPid)
    return
  await rm(brokerStatePath(registryRoot), { force: true })
}

/** 共享 Broker 的持久化发现信息 */
export interface BrokerState {
  pid: number
  port: number
  protocolVersion: number
  updatedAt: number
}
