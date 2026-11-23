import { AGENT_EVENT, createAgentEvent } from '@/contracts/agentEvents'
import { pickScenario } from '@/features/agent/mockAgent'
import { executeTool } from '@/mocks/agentServer'

let sequence = 0

function uid(prefix) {
  sequence += 1
  return `${prefix}_${Date.now()}_${sequence}`
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Mock 传输层：与 SSE 传输层保持同一事件协议。
 * 场景只提供计划与 UI 投影；工具执行与 RBAC 在模拟服务端完成。
 */
export function createMockAgentStream() {
  let cancelled = false

  return {
    cancel() {
      cancelled = true
    },

    async *send({ text, actor }) {
      const runId = uid('run')
      yield createAgentEvent(AGENT_EVENT.RUN_STARTED, { runId })

      await sleep(320)
      if (cancelled) return

      const scenario = pickScenario(text, actor)

      const planId = uid('msg')
      yield createAgentEvent(AGENT_EVENT.TEXT_MESSAGE_START, {
        messageId: planId,
        kind: 'plan',
      })
      yield createAgentEvent(AGENT_EVENT.TEXT_MESSAGE_CONTENT, {
        messageId: planId,
        delta: scenario.plan,
      })
      yield createAgentEvent(AGENT_EVENT.TEXT_MESSAGE_END, {
        messageId: planId,
      })

      await sleep(280)
      if (cancelled) return

      const tools = scenario.tools.map((tool) => ({
        ...tool,
        toolCallId: uid('tool'),
      }))

      for (const tool of tools) {
        yield createAgentEvent(AGENT_EVENT.TOOL_CALL_START, {
          toolCallId: tool.toolCallId,
          name: tool.name,
          label: tool.label,
          input: tool.input,
        })
      }

      for (const tool of tools) {
        if (cancelled) return

        yield createAgentEvent(AGENT_EVENT.TOOL_CALL_STATE, {
          toolCallId: tool.toolCallId,
          status: 'running',
        })

        const started = Date.now()
        await sleep(tool.duration || 600)

        if (cancelled) {
          yield createAgentEvent(AGENT_EVENT.TOOL_CALL_RESULT, {
            toolCallId: tool.toolCallId,
            status: 'cancelled',
            error: '用户已取消',
            durationMs: Date.now() - started,
          })
          return
        }

        try {
          const output = executeTool({
            actor,
            tool: tool.name,
            input: tool.input,
          })
          yield createAgentEvent(AGENT_EVENT.TOOL_CALL_RESULT, {
            toolCallId: tool.toolCallId,
            status: 'succeeded',
            output,
            durationMs: Date.now() - started,
          })
        } catch (error) {
          yield createAgentEvent(AGENT_EVENT.TOOL_CALL_RESULT, {
            toolCallId: tool.toolCallId,
            status: 'failed',
            error: error.message,
            errorCode: error.code,
            durationMs: Date.now() - started,
          })
          yield createAgentEvent(AGENT_EVENT.RUN_ERROR, {
            message: error.message,
            code: error.code || 'TOOL_ERROR',
          })
          return
        }
      }

      await sleep(260)
      if (cancelled) return

      const resultId = uid('msg')
      yield createAgentEvent(AGENT_EVENT.TEXT_MESSAGE_START, {
        messageId: resultId,
        kind: 'result',
      })
      yield createAgentEvent(AGENT_EVENT.TEXT_MESSAGE_CONTENT, {
        messageId: resultId,
        delta: scenario.reply,
      })
      yield createAgentEvent(AGENT_EVENT.TEXT_MESSAGE_END, {
        messageId: resultId,
        ui: scenario.ui,
      })

      if (scenario.approval) {
        yield createAgentEvent(AGENT_EVENT.APPROVAL_REQUIRED, {
          approval: scenario.approval,
        })
      }

      yield createAgentEvent(AGENT_EVENT.RUN_FINISHED, { runId })
    },
  }
}
