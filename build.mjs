// 构建 client bundle：把 src/client/index.tsx 打包成 DSH 客户端加载格式
// `window.__ModuleLoader__.load({ id, factory })`，输出到 lib/client.js。
//
// 用法：pnpm build  （或 node build.mjs）
// 依赖：devDependencies 里的 esbuild（pnpm i 后可用）。

import { build } from 'esbuild'
import { readFile, writeFile, rm } from 'node:fs/promises'

const PACKAGE_ID = 'dsh-memory-core'

// 共享运行时一律 external：由 DSH 的 __ModuleLoader__ 在运行时 require 注入，
// 绝不能打进 bundle（否则会复制 React/Cordis 运行时身份）。
const externals = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-api-remotes',
]

const tmp = 'lib/client.tmp.js'

await build({
  entryPoints: ['src/client/index.tsx'],
  bundle: true,
  outfile: tmp,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  external: externals,
  jsx: 'automatic',
  minify: true,
  logLevel: 'info',
})

const body = await readFile(tmp, 'utf8')
await rm(tmp, { force: true })

const wrapped = [
  'window.__ModuleLoader__.load({',
  `  id: ${JSON.stringify(PACKAGE_ID)},`,
  '  factory: (require) => {',
  '    var module = { exports: {} };',
  '    var exports = module.exports;',
  body,
  '    return module.exports;',
  '  },',
  '});',
  '',
].join('\n')

await writeFile('lib/client.js', wrapped)
console.log(`[memory-core] client bundle written to lib/client.js (${wrapped.length} chars)`)
