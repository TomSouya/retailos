import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { STORES } from '../domain/data'

export interface LlmToolCall {
  id: string
  name: string
  arguments: Record<string, any>
}

export interface LlmReply {
  content: string
  toolCalls: LlmToolCall[]
}

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string
  tool_calls?: any[]
  tool_call_id?: string
}

function safeJson(value: any): Record<string, any> {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return {}
  }
}

function mentionedStoreId(text: string) {
  const store = STORES.find(
    (item) => text.includes(item.name) || text.includes(item.city),
  )
  return store?.id
}

/**
 * OpenAI 兼容的模型调用层。
 * - LLM_PROVIDER=rule：始终走规则场景（默认，无外部依赖）
 * - LLM_PROVIDER=stub：本地确定性模型，用于自动化测试
 * - 其他值 + LLM_API_KEY：调用真实模型（支持 DeepSeek / OpenAI 等兼容接口）
 */
@Injectable()
export class LlmService {
  constructor(private readonly config: ConfigService) {}

  private get provider() {
    return this.config.get<string>('LLM_PROVIDER', 'rule')
  }

  private get apiKey() {
    return this.config.get<string>('LLM_API_KEY', '')
  }

  private get baseUrl() {
    return this.config
      .get<string>('LLM_BASE_URL', 'https://api.openai.com/v1')
      .replace(/\/$/, '')
  }

  private get model() {
    return this.config.get<string>('LLM_MODEL', 'deepseek-chat')
  }

  get enabled() {
    if (this.provider === 'rule') return false
    return this.provider === 'stub' || Boolean(this.apiKey)
  }

  get mode() {
    if (this.provider === 'stub') return 'stub'
    return this.enabled ? `${this.provider}:${this.model}` : 'rule'
  }

  async chat(
    messages: LlmMessage[],
    tools: any[],
  ): Promise<LlmReply> {
    if (this.provider === 'stub') return this.stubReply(messages)

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60000)
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(
          `模型调用失败（${response.status}）：${detail.slice(0, 160)}`,
        )
      }

      const data = await response.json()
      const message = data.choices?.[0]?.message || {}
      return {
        content: String(message.content || ''),
        toolCalls: (message.tool_calls || [])
          .map((call: any) => ({
            id: call.id,
            name: call.function?.name,
            arguments: safeJson(call.function?.arguments),
          }))
          .filter((call: LlmToolCall) => Boolean(call.name)),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  async chatStream(
    messages: LlmMessage[],
    tools: any[],
    onDelta: (delta: string) => void,
  ): Promise<LlmReply> {
    if (this.provider === 'stub') {
      const reply = this.stubReply(messages)
      if (reply.content) onDelta(reply.content)
      return reply
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          tools,
          tool_choice: 'auto',
          temperature: 0.2,
          stream: true,
        }),
        signal: controller.signal,
      })
      if (!response.ok) {
        const detail = await response.text()
        throw new Error(
          `模型调用失败（${response.status}）：${detail.slice(0, 160)}`,
        )
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error('模型未返回流式响应')

      const decoder = new TextDecoder()
      let buffer = ''
      let content = ''
      const toolCalls = new Map<
        number,
        { id: string; name: string; arguments: string }
      >()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (!payload || payload === '[DONE]') continue

          let data: any
          try {
            data = JSON.parse(payload)
          } catch {
            continue
          }

          const delta = data.choices?.[0]?.delta || {}
          if (delta.content) {
            content += delta.content
            onDelta(delta.content)
          }

          for (const call of delta.tool_calls || []) {
            const index = Number.isInteger(call.index) ? call.index : 0
            const entry =
              toolCalls.get(index) || {
                id: call.id || `call_${index}`,
                name: '',
                arguments: '',
              }
            if (call.id) entry.id = call.id
            if (call.function?.name) entry.name = call.function.name
            if (call.function?.arguments) {
              entry.arguments += call.function.arguments
            }
            toolCalls.set(index, entry)
          }
        }
      }

      return {
        content,
        toolCalls: [...toolCalls.values()]
          .map((call) => ({
            id: call.id,
            name: call.name,
            arguments: safeJson(call.arguments),
          }))
          .filter((call) => Boolean(call.name)),
      }
    } finally {
      clearTimeout(timer)
    }
  }

  private stubReply(messages: LlmMessage[]): LlmReply {
    const lastUser = [...messages]
      .reverse()
      .find((message) => message.role === 'user')
    const text = String(lastUser?.content || '')
    const toolMessages = messages.filter((message) => message.role === 'tool')

    if (toolMessages.length) {
      const parts = toolMessages.map((message) => {
        const payload = safeJson(message.content)
        if (payload.kind === 'products') return `共 ${payload.total} 个商品`
        if (payload.kind === 'purchase_orders') {
          return `共 ${payload.total} 张采购单`
        }
        if (payload.kind === 'sales_orders') {
          return `共 ${payload.total} 张销售订单`
        }
        if (Array.isArray(payload.items)) {
          return `共 ${payload.items.length} 条库存记录`
        }
        return '已获取查询结果'
      })
      return {
        content: `已完成查询：${parts.join('；')}。详细数据见下方卡片。`,
        toolCalls: [],
      }
    }

    if (/审批|待办/.test(text)) {
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'list_pending_approvals',
            arguments: {},
          },
        ],
      }
    }
    if (/采购/.test(text)) {
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'list_purchase_orders',
            arguments: { keyword: '', limit: 8 },
          },
        ],
      }
    }
    if (/库存|缺货|安全库存/.test(text)) {
      const storeId = mentionedStoreId(text)
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'get_inventory',
            arguments: storeId ? { storeId } : {},
          },
        ],
      }
    }
    if (/订单/.test(text)) {
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'list_sales_orders',
            arguments: { keyword: '', limit: 8 },
          },
        ],
      }
    }
    if (/销售|营业额|经营|环比|趋势|毛利|周转|售罄/.test(text)) {
      const storeId = mentionedStoreId(text)
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'get_sales_summary',
            arguments: storeId ? { storeId } : {},
          },
        ],
      }
    }
    if (/异常|风险/.test(text)) {
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'scan_anomalies',
            arguments: {},
          },
        ],
      }
    }
    if (/商品|产品|SKU/i.test(text)) {
      const keyword = text
        .replace(/(查询|搜索|查找|看看|商品|产品|SKU)/gi, ' ')
        .trim()
      return {
        content: '',
        toolCalls: [
          {
            id: 'stub_call_1',
            name: 'search_products',
            arguments: { keyword, limit: 8 },
          },
        ],
      }
    }

    return {
      content:
        '我可以帮你查询商品、采购单、销售订单、库存和门店经营数据。',
      toolCalls: [],
    }
  }
}
