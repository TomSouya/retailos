// 轻量进程内指标：供 /api/metrics 以 Prometheus 文本格式暴露。
// 多实例部署时需改为共享存储或使用 Prometheus 客户端库。
const counters = new Map<string, number>()
let durationSecondsSum = 0
let durationCount = 0
let error5xx = 0
const startedAt = Date.now()

export function recordHttpRequest(
  method: string,
  status: number,
  durationMs: number,
) {
  const key = `${method}|${status}`
  counters.set(key, (counters.get(key) || 0) + 1)
  durationSecondsSum += durationMs / 1000
  durationCount += 1
  if (status >= 500) error5xx += 1
}

export function renderMetrics(dbUp: boolean) {
  const lines: string[] = []

  lines.push(
    '# HELP retailos_http_requests_total HTTP 请求总数',
    '# TYPE retailos_http_requests_total counter',
  )
  for (const [key, count] of counters) {
    const [method, status] = key.split('|')
    lines.push(
      `retailos_http_requests_total{method="${method}",status="${status}"} ${count}`,
    )
  }

  lines.push(
    '# HELP retailos_http_request_duration_seconds HTTP 请求耗时',
    '# TYPE retailos_http_request_duration_seconds summary',
    `retailos_http_request_duration_seconds_sum ${durationSecondsSum.toFixed(6)}`,
    `retailos_http_request_duration_seconds_count ${durationCount}`,
  )

  lines.push(
    '# HELP retailos_http_requests_5xx_total 5xx 响应总数',
    '# TYPE retailos_http_requests_5xx_total counter',
    `retailos_http_requests_5xx_total ${error5xx}`,
  )

  lines.push(
    '# HELP retailos_db_up 数据库可用性（1=可用）',
    '# TYPE retailos_db_up gauge',
    `retailos_db_up ${dbUp ? 1 : 0}`,
  )

  lines.push(
    '# HELP retailos_process_uptime_seconds 进程运行时长',
    '# TYPE retailos_process_uptime_seconds gauge',
    `retailos_process_uptime_seconds ${Math.round((Date.now() - startedAt) / 1000)}`,
  )

  return `${lines.join('\n')}\n`
}
