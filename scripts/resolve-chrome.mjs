// 跨平台解析 Chrome / Edge 可执行文件，供 e2e 脚本共用。
// 优先 CHROME_PATH，其次按平台在常见安装路径与 PATH 中查找。
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const CANDIDATES = {
  win32: [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ],
  darwin: [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ],
  linux: [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ],
}

const LINUX_NAMES = [
  'google-chrome',
  'google-chrome-stable',
  'chromium',
  'chromium-browser',
]

function fromPath(name) {
  try {
    return execFileSync('which', [name], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

export function resolveChromePath() {
  const configured = process.env.CHROME_PATH
  if (configured) {
    if (!fs.existsSync(configured)) {
      throw new Error(`CHROME_PATH 指向的文件不存在：${configured}`)
    }
    return configured
  }

  const candidates = [...(CANDIDATES[process.platform] || [])]
  if (process.platform === 'linux') {
    for (const name of LINUX_NAMES) {
      const hit = fromPath(name)
      if (hit) candidates.push(hit)
    }
  }

  const found = candidates.find((candidate) => fs.existsSync(candidate))
  if (!found) {
    throw new Error('未找到 Chrome/Edge，请通过 CHROME_PATH 指定可执行文件')
  }
  return found
}
