import type { ExtensionContext } from 'vscode'
import { spawn } from 'node:child_process'
import { getRegistryRoot } from '../instance/registry'
import { BROKER_PROTOCOL_VERSION, readBrokerState } from './state'

const BROKER_START_TIMEOUT_MS = 5_000

/**
 * 复用已运行的共享 Broker，或启动一个与 VS Code 窗口解耦的后台进程
 * @returns 外部 MCP 客户端应连接的实际端口
 */
export async function ensureBroker(
  context: ExtensionContext,
  options: BrokerLaunchOptions,
): Promise<number> {
  const registryRoot = getRegistryRoot()
  const activePort = await activeBrokerPort(registryRoot)
  if (activePort != null)
    return activePort

  const brokerPath = context.asAbsolutePath('dist/broker.js')
  const child = spawn(process.execPath, [brokerPath], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: '1',
      VSC_LSP_MCP_REGISTRY: registryRoot,
      VSC_LSP_MCP_PORT: String(options.port),
      VSC_LSP_MCP_CORS_ENABLED: String(options.corsEnabled),
      VSC_LSP_MCP_CORS_ORIGINS: options.corsOrigins,
      VSC_LSP_MCP_CORS_CREDENTIALS: String(options.corsCredentials),
      VSC_LSP_MCP_CORS_EXPOSE_HEADERS: options.corsExposeHeaders,
      VSC_LSP_MCP_LOCALE: options.locale,
    },
  })
  child.unref()

  const deadline = Date.now() + BROKER_START_TIMEOUT_MS
  while (Date.now() < deadline) {
    const port = await activeBrokerPort(registryRoot)
    if (port != null)
      return port
    await new Promise(resolve => setTimeout(resolve, 50))
  }

  throw new Error('Timed out waiting for the LSP MCP broker to start')
}

/** 启动共享 Broker 所需的运行参数 */
export interface BrokerLaunchOptions {
  port: number
  corsEnabled: boolean
  corsOrigins: string
  corsCredentials: boolean
  corsExposeHeaders: string
  locale: string
}

async function activeBrokerPort(registryRoot: string): Promise<number | undefined> {
  const state = await readBrokerState(registryRoot)
  if (!state)
    return undefined

  try {
    const response = await fetch(`http://127.0.0.1:${state.port}/health`, {
      signal: AbortSignal.timeout(500),
    })
    const health = await response.json() as { protocolVersion?: number }
    if (response.ok && health.protocolVersion === BROKER_PROTOCOL_VERSION)
      return state.port
  }
  catch {}

  return undefined
}
