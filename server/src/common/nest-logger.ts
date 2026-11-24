import type { LoggerService } from '@nestjs/common'
import { log } from './logger'

function formatMessage(message: unknown) {
  if (typeof message === 'string') return message
  if (message instanceof Error) return message.message
  try {
    return JSON.stringify(message)
  } catch {
    return String(message)
  }
}

function contextOf(params: unknown[]) {
  const last = params[params.length - 1]
  return typeof last === 'string' ? last : undefined
}

/**
 * 把 Nest 框架日志也转成单行 JSON，避免集中采集时混入彩色文本。
 */
export class JsonLogger implements LoggerService {
  log(message: unknown, ...params: unknown[]) {
    log('info', 'nest_log', {
      context: contextOf(params),
      message: formatMessage(message),
    })
  }

  error(message: unknown, ...params: unknown[]) {
    const context = contextOf(params)
    const stack =
      typeof params[0] === 'string' && params[0] !== context
        ? params[0]
        : undefined
    log('error', 'nest_log', {
      context,
      message: formatMessage(message),
      stack,
    })
  }

  warn(message: unknown, ...params: unknown[]) {
    log('warn', 'nest_log', {
      context: contextOf(params),
      message: formatMessage(message),
    })
  }

  debug(message: unknown, ...params: unknown[]) {
    log('debug', 'nest_log', {
      context: contextOf(params),
      message: formatMessage(message),
    })
  }

  verbose(message: unknown, ...params: unknown[]) {
    log('debug', 'nest_log', {
      context: contextOf(params),
      message: formatMessage(message),
    })
  }

  fatal(message: unknown, ...params: unknown[]) {
    log('error', 'nest_log', {
      context: contextOf(params),
      message: formatMessage(message),
    })
  }
}
