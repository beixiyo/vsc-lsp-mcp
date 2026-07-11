import { defineConfig } from 'tsup'
import pkg from './package.json'

// 定义需要排除的包（这些包在运行时环境中提供）
const externalPackages = ['vscode']

// 自动获取所有需要打包的依赖（排除 external 中指定的）
const dependencies = Object.keys(pkg.dependencies || {})
const noExternalPackages = dependencies.filter(dep => !externalPackages.includes(dep))

export default defineConfig({
  entry: {
    index: './src/index.ts',
    broker: './src/broker/main.ts',
  },
  outDir: 'dist',
  format: ['cjs'],
  clean: true,
  minify: true,
  bundle: true,
  /**
   * polyfill 一些 Node 特有的功能（如 __dirname、require）
   * 对于 ESM 格式，这些 Node 内置变量是没有的，设置 shims: true 会用兼容代码模拟这些行为
   */
  shims: true,
  target: 'node16',
  platform: 'node',
  external: externalPackages,
  // 自动将所有 dependencies 都打包进来（除了 external 中指定的）
  noExternal: noExternalPackages,

  plugins: [
    {
      name: 'build-notify',
      buildEnd() {
        console.log('Build completed')
      },
    },
  ],
})
