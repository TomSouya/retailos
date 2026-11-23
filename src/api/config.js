const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL

/**
 * 留空时使用同源请求（适合 Nginx 反向代理部署）；
 * 未配置该变量时回退到本地开发后端。
 */
export const API_BASE_URL =
  configuredBaseUrl === undefined ? 'http://127.0.0.1:3000' : configuredBaseUrl

/**
 * 与 Agent transport 共用同一个开关：
 * 使用 SSE 时，审批与审计也走后端 API。
 */
export const USE_REMOTE_API =
  import.meta.env.VITE_AGENT_TRANSPORT === 'sse'
