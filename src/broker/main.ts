import { closeSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PRIVATE_FILE_MODE } from '../filePermissions'
import { createRegistry, getRegistryRoot } from '../instance/registry'
import { startBroker } from './server'

/** 独立 Broker 进程入口，负责抢占单实例锁并管理退出清理 */
async function main(): Promise<void> {
  const registryRoot = getRegistryRoot()
  await createRegistry(registryRoot)
  const lockPath = join(registryRoot, 'broker.lock')
  const lock = await acquireLock(lockPath)
  if (lock == null)
    return

  const port = positiveInteger(process.env.VSC_LSP_MCP_PORT, 9527)
  let broker: Awaited<ReturnType<typeof startBroker>> | undefined
  let shuttingDown = false

  const shutdown = async () => {
    if (shuttingDown)
      return
    shuttingDown = true
    await broker?.dispose()
    closeSync(lock)
    rmSync(lockPath, { force: true })
    process.exit(0)
  }

  broker = await startBroker({
    port,
    corsEnabled: process.env.VSC_LSP_MCP_CORS_ENABLED === 'true',
    corsOrigins: process.env.VSC_LSP_MCP_CORS_ORIGINS || '*',
    corsCredentials: process.env.VSC_LSP_MCP_CORS_CREDENTIALS === 'true',
    corsExposeHeaders: process.env.VSC_LSP_MCP_CORS_EXPOSE_HEADERS || 'Mcp-Session-Id',
    locale: process.env.VSC_LSP_MCP_LOCALE || 'en',
    onIdle: () => void shutdown(),
  })
  process.once('SIGINT', () => void shutdown())
  process.once('SIGTERM', () => void shutdown())
}

/**
 * 原子获取 Broker 启动锁
 * 活跃 Broker 持有锁时返回 undefined，陈旧锁则会被回收
 */
async function acquireLock(path: string): Promise<number | undefined> {
  try {
    const descriptor = openSync(path, 'wx', PRIVATE_FILE_MODE)
    writeLock(descriptor)
    return descriptor
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST')
      throw error

    await new Promise(resolve => setTimeout(resolve, 25))
    let lock: BrokerLock
    try {
      lock = JSON.parse(readFileSync(path, 'utf8')) as BrokerLock
      if (isProcessAlive(lock.pid))
        return undefined
    }
    catch {
      return undefined
    }

    rmSync(path, { force: true })
    try {
      const descriptor = openSync(path, 'wx', PRIVATE_FILE_MODE)
      writeLock(descriptor)
      return descriptor
    }
    catch (retryError) {
      if ((retryError as NodeJS.ErrnoException).code === 'EEXIST')
        return undefined
      throw retryError
    }
  }
}

function writeLock(descriptor: number): void {
  writeFileSync(descriptor, JSON.stringify({ pid: process.pid, createdAt: Date.now() }))
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  }
  catch {
    return false
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

void main().catch((error) => {
  console.error(error)
  process.exit(1)
})

interface BrokerLock {
  pid: number
  createdAt: number
}
