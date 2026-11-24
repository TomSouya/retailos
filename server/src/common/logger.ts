import {
  appendFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  statSync,
  unlinkSync,
} from 'node:fs'
import { dirname } from 'node:path'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
}

const SERVICE_NAME = 'retailos-server'

let threshold: number | undefined
let fileReady = false
let filePath = ''
let fileMaxBytes = 20 * 1024 * 1024
let fileKeep = 5
let fileWrites = 0
let fileErrorLogged = false

function minWeight() {
  if (threshold === undefined) {
    const configured = String(process.env.LOG_LEVEL || 'info').toLowerCase()
    threshold = LEVEL_WEIGHT[configured as LogLevel] ?? LEVEL_WEIGHT.info
  }
  return threshold
}

function setupFile() {
  if (fileReady) return
  fileReady = true
  filePath = String(process.env.LOG_FILE || '').trim()
  if (!filePath) return

  const maxMb = Number(process.env.LOG_FILE_MAX_MB)
  if (Number.isFinite(maxMb) && maxMb > 0) {
    fileMaxBytes = maxMb * 1024 * 1024
  }
  const keep = Number(process.env.LOG_FILE_KEEP)
  if (Number.isFinite(keep) && keep > 0) {
    fileKeep = Math.floor(keep)
  }

  try {
    mkdirSync(dirname(filePath), { recursive: true })
  } catch {
    // 目录创建失败时保留 stdout 输出即可
  }
  // 首次写入就检查一次，避免重启后旧文件继续超限增长
  fileWrites = 49
}

function rotateIfNeeded() {
  if (!filePath || !existsSync(filePath)) return
  fileWrites += 1
  // 每 50 行检查一次大小，避免每次请求都 stat
  if (fileWrites % 50 !== 0) return
  try {
    if (statSync(filePath).size < fileMaxBytes) return
    for (let index = fileKeep; index >= 1; index -= 1) {
      const from = index === 1 ? filePath : `${filePath}.${index - 1}`
      const to = `${filePath}.${index}`
      if (!existsSync(from)) continue
      if (existsSync(to)) unlinkSync(to)
      renameSync(from, to)
    }
  } catch {
    // 滚动失败不阻断业务日志
  }
}

function writeToFile(line: string) {
  setupFile()
  if (!filePath) return
  try {
    rotateIfNeeded()
    appendFileSync(filePath, `${line}\n`, 'utf8')
  } catch (error) {
    if (fileErrorLogged) return
    fileErrorLogged = true
    console.error(
      JSON.stringify({
        service: SERVICE_NAME,
        level: 'error',
        ts: new Date().toISOString(),
        event: 'log_file_error',
        message: error instanceof Error ? error.message : String(error),
      }),
    )
  }
}

/**
 * 输出单行 JSON 日志：默认写 stdout，设置 LOG_FILE 后同步追加文件。
 * LOG_LEVEL=debug|info|warn|error 控制级别，默认 info。
 */
export function log(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> = {},
) {
  if (LEVEL_WEIGHT[level] < minWeight()) return

  const line = JSON.stringify({
    service: SERVICE_NAME,
    level,
    ts: new Date().toISOString(),
    event,
    ...fields,
  })

  if (level === 'error') {
    console.error(line)
  } else if (level === 'warn') {
    console.warn(line)
  } else {
    console.log(line)
  }

  writeToFile(line)
}

export function logInfo(event: string, fields?: Record<string, unknown>) {
  log('info', event, fields)
}

export function logWarn(event: string, fields?: Record<string, unknown>) {
  log('warn', event, fields)
}

export function logError(event: string, fields?: Record<string, unknown>) {
  log('error', event, fields)
}
