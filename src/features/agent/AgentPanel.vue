<script setup>
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue'
import {
  ArrowRight,
  Close,
  MagicStick,
  Promotion,
  RefreshLeft,
} from '@element-plus/icons-vue'
import ChatMessage from './ChatMessage.vue'
import { useAgentStore } from '@/stores/agent'
import { useAuthStore } from '@/stores/auth'
import { agentPrompts } from '@/mocks/data'
import { AGENT_RUN_STATUS } from '@/contracts/agentEvents'

const agent = useAgentStore()
const auth = useAuthStore()

const draft = ref('')
const listRef = ref(null)
const contentRef = ref(null)

const pageLabel = computed(() => {
  const labels = {
    dashboard: '经营驾驶舱',
    inventory: '库存管理',
    audit: '审计日志',
    products: '商品管理',
    procurement: '采购管理',
    stores: '门店管理',
    members: '会员管理',
    orders: '订单管理',
    system: '系统管理',
  }
  return labels[agent.context.page] || '经营驾驶舱'
})

const visiblePrompts = computed(() => {
  if (['regional_manager', 'warehouse'].includes(auth.user?.key)) {
    return agentPrompts.filter((prompt) => prompt.label !== '发起补货')
  }
  return agentPrompts
})

const statusDotClass = computed(() => {
  if (
    agent.isBusy ||
    agent.status === AGENT_RUN_STATUS.AWAITING_PERMISSION
  ) {
    return 'is-warning'
  }
  if (agent.status === AGENT_RUN_STATUS.FAILED) return 'is-danger'
  if (agent.status === AGENT_RUN_STATUS.COMPLETED) return 'is-success'
  return ''
})

let autoStick = true
let contentObserver = null
let programmaticScroll = false
let scrollReleaseTimer = null

function scrollToBottom() {
  const el = listRef.value
  if (!el) return
  programmaticScroll = true
  el.scrollTop = el.scrollHeight
  window.clearTimeout(scrollReleaseTimer)
  scrollReleaseTimer = window.setTimeout(() => {
    programmaticScroll = false
  }, 140)
}

function onListScroll() {
  if (programmaticScroll) return
  const el = listRef.value
  if (!el) return
  autoStick = el.scrollHeight - el.scrollTop - el.clientHeight < 80
}

function stickToBottomSoon() {
  settleScroll(8)
}

function settleScroll(attempts = 8) {
  if (!autoStick) return
  scrollToBottom()
  if (attempts <= 0) return
  window.setTimeout(() => settleScroll(attempts - 1), 180)
}

function attachObserver() {
  contentObserver?.disconnect()
  if (!contentRef.value) return
  contentObserver = new ResizeObserver(() => {
    if (autoStick) scrollToBottom()
  })
  contentObserver.observe(contentRef.value)
}

function send(text = draft.value) {
  const content = String(text || '').trim()
  if (!content || agent.isBusy) return
  autoStick = true
  draft.value = ''
  agent.send(content)
}

onMounted(attachObserver)

onBeforeUnmount(() => {
  contentObserver?.disconnect()
  window.clearTimeout(scrollReleaseTimer)
})

watch(
  () => [agent.messages.length, agent.toolCalls.map((tool) => tool.status).join('|'), agent.status],
  async () => {
    await nextTick()
    stickToBottomSoon()
  },
)

watch(
  () => agent.panelOpen,
  async (open) => {
    if (!open) return
    autoStick = true
    await nextTick()
    attachObserver()
    stickToBottomSoon()
  },
)
</script>

<template>
  <el-drawer
    v-model="agent.panelOpen"
    direction="rtl"
    size="480px"
    :with-header="false"
    append-to-body
    class="agent-drawer"
  >
    <div class="agent-shell">
      <header class="agent-head">
        <div class="agent-head-main">
          <div class="agent-mark">
            <el-icon><MagicStick /></el-icon>
          </div>
          <div>
            <div class="agent-title">
              经营助手
              <span class="agent-beta">Beta</span>
            </div>
            <div class="agent-sub">
              <span class="dot is-success"></span>
              已接入 17 个经营工具 · {{ auth.user?.scope }}
            </div>
          </div>
        </div>

        <div class="agent-head-actions">
          <button
            class="agent-icon-btn"
            type="button"
            title="新对话"
            aria-label="新对话"
            @click="agent.reset()"
          >
            <el-icon><RefreshLeft /></el-icon>
          </button>
          <button
            class="agent-icon-btn"
            type="button"
            title="关闭"
            aria-label="关闭助手"
            @click="agent.close()"
          >
            <el-icon><Close /></el-icon>
          </button>
        </div>
      </header>

      <div ref="listRef" class="agent-list" @scroll="onListScroll">
        <div ref="contentRef" class="agent-list-inner">
          <div v-if="!agent.messages.length" class="agent-welcome">
            <div class="welcome-kicker">Now working on</div>
            <h3>今天想先看哪一块？</h3>
            <p>我可以查销售、找异常、看库存，也能生成补货/采购草稿并准备审批决定。</p>

            <div class="welcome-grid">
              <button
                v-for="prompt in visiblePrompts"
                :key="prompt.label"
                class="welcome-card"
                type="button"
                @click="send(prompt.text)"
              >
                <span>{{ prompt.label }}</span>
                <el-icon><ArrowRight /></el-icon>
              </button>
            </div>

            <div class="welcome-note">
              <span class="dot"></span>
              当前角色：{{ auth.user?.label }} · 数据范围：{{ auth.user?.scope }}
            </div>

            <div class="welcome-context">
              <div class="section-label">当前上下文</div>
              <div class="context-list">
                <div>
                  <span>页面</span>
                  <strong>{{ pageLabel }}</strong>
                </div>
                <div>
                  <span>数据范围</span>
                  <strong>{{ auth.user?.scope }}</strong>
                </div>
                <div>
                  <span>可用工具</span>
                  <strong>销售 · 库存 · 异常 · 补货</strong>
                </div>
              </div>
            </div>
          </div>

          <ChatMessage
            v-for="message in agent.messages"
            :key="message.id"
            :message="message"
            :tools="agent.toolCalls"
            @approve="agent.submitApproval"
            @cancel="agent.cancelApproval"
            @confirm="agent.confirmAction"
            @cancel-action="agent.cancelAction"
          />

          <div v-if="agent.isBusy" class="agent-typing">
            <span></span>
            <span></span>
            <span></span>
            <em>{{ agent.statusLabel }}</em>
          </div>
        </div>
      </div>

      <footer class="agent-composer">
        <div class="prompt-row">
          <button
            v-for="prompt in visiblePrompts"
            :key="prompt.label"
            class="prompt-chip"
            type="button"
            @click="send(prompt.text)"
          >
            {{ prompt.label }}
          </button>
        </div>

        <div class="composer-box">
          <textarea
            v-model="draft"
            rows="3"
            placeholder="问销售、库存、门店异常，或让我发起补货…"
            @keydown.enter.exact.prevent="send()"
          ></textarea>

          <div class="composer-foot">
            <span class="composer-hint">Enter 发送 · Shift + Enter 换行</span>
            <div class="composer-actions">
              <button
                v-if="agent.isBusy"
                class="stop-btn"
                type="button"
                @click="agent.cancelRun()"
              >
                停止
              </button>
              <button
                class="send-btn"
                type="button"
                :disabled="!draft.trim() || agent.isBusy"
                aria-label="发送"
                @click="send()"
              >
                <el-icon><Promotion /></el-icon>
              </button>
            </div>
          </div>
        </div>

        <div class="agent-footnote">
          <span class="dot" :class="statusDotClass"></span>
          {{ agent.statusLabel }} · 工具调用与审批会写入审计日志
        </div>
      </footer>
    </div>
  </el-drawer>
</template>

<style scoped>
.agent-shell {
  display: flex;
  height: 100vh;
  flex-direction: column;
  background: var(--paper);
}

.agent-head {
  display: flex;
  flex: none;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 18px 17px 16px;
  background: var(--graphite);
  color: #f5f7fa;
}

.agent-head-main {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 10px;
}

.agent-mark {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 9px;
  background: rgba(110, 138, 255, 0.16);
  color: #8ea4ff;
  font-size: 16px;
}

.agent-title {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14px;
  font-weight: 650;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.agent-beta {
  padding: 0 5px;
  border: 1px solid rgba(110, 138, 255, 0.35);
  border-radius: 999px;
  color: #8ea4ff;
  font-family: var(--sans);
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.agent-sub {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 3px;
  color: rgba(245, 247, 250, 0.44);
  font-size: 9.5px;
}

.agent-sub .dot {
  box-shadow: none;
  width: 6px;
  height: 6px;
}

.agent-head-actions {
  display: flex;
  align-items: center;
  gap: 3px;
  flex: none;
}

.agent-icon-btn {
  display: grid;
  width: 28px;
  height: 28px;
  place-items: center;
  border: 1px solid rgba(245, 247, 250, 0.12);
  border-radius: 8px;
  background: transparent;
  color: rgba(245, 247, 250, 0.55);
  font-size: 13px;
  transition:
    color 0.16s ease,
    border-color 0.16s ease;
}

.agent-icon-btn:hover {
  border-color: rgba(245, 247, 250, 0.3);
  color: #ffffff;
}

.agent-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 17px 15px 12px;
  overscroll-behavior: contain;
}

.agent-list-inner {
  min-height: 100%;
}

.agent-welcome {
  padding: 4px 3px 8px;
}

.welcome-kicker {
  color: var(--accent);
  font-family: var(--sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.agent-welcome h3 {
  margin-top: 8px;
  color: var(--ink);
  font-size: 25px;
  font-weight: 650;
  letter-spacing: -0.045em;
  line-height: 1.2;
}

.agent-welcome p {
  max-width: 330px;
  margin-top: 7px;
  color: var(--muted);
  font-size: 12px;
  line-height: 1.7;
}

.welcome-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 18px;
}

.welcome-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 11px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  font-weight: 600;
  text-align: left;
  transition:
    border-color 0.16s ease,
    transform 0.16s ease;
}

.welcome-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
}

.welcome-card .el-icon {
  color: var(--accent);
  font-size: 12px;
}

.welcome-note {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 14px;
  color: var(--faint);
  font-size: 9.5px;
}

.welcome-note .dot {
  width: 5px;
  height: 5px;
  box-shadow: none;
}

.welcome-context {
  margin-top: 22px;
  padding-top: 16px;
  border-top: 1px solid var(--line);
}

.context-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}

.context-list div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.context-list span {
  color: var(--muted);
  font-size: 10.5px;
}

.context-list strong {
  overflow: hidden;
  color: var(--text-soft);
  font-size: 11px;
  font-weight: 600;
  text-align: right;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.agent-typing {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 2px 12px;
}

.agent-typing span {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: var(--accent);
  animation: blink 1.2s ease-in-out infinite;
}

.agent-typing span:nth-child(2) {
  animation-delay: 0.15s;
}

.agent-typing span:nth-child(3) {
  animation-delay: 0.3s;
}

.agent-typing em {
  margin-left: 5px;
  color: var(--faint);
  font-size: 9.5px;
  font-style: normal;
}

.agent-composer {
  flex: none;
  padding: 9px 12px 11px;
  border-top: 1px solid var(--line);
  background: var(--surface);
}

.prompt-row {
  display: flex;
  gap: 5px;
  padding-bottom: 8px;
  overflow-x: auto;
  scrollbar-width: none;
}

.prompt-row::-webkit-scrollbar {
  display: none;
}

.prompt-chip {
  flex: none;
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface-2);
  color: var(--muted);
  font-size: 9.5px;
  white-space: nowrap;
}

.prompt-chip:hover {
  border-color: var(--accent);
  color: var(--accent-deep);
}

.composer-box {
  padding: 8px 9px 6px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface-2);
  transition: border-color 0.16s ease;
}

.composer-box:focus-within {
  border-color: var(--line-strong);
  background: var(--surface);
}

.composer-box textarea {
  width: 100%;
  min-height: 52px;
  padding: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: var(--text);
  font-family: var(--sans);
  font-size: 12.5px;
  line-height: 1.65;
  resize: none;
}

.composer-box textarea::placeholder {
  color: var(--faint);
}

.composer-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-top: 4px;
}

.composer-hint {
  color: var(--faint);
  font-size: 8.5px;
}

.composer-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stop-btn {
  padding: 3px 8px;
  border: 1px solid var(--line);
  border-radius: 999px;
  background: var(--surface);
  color: var(--muted);
  font-size: 9.5px;
}

.send-btn {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 0;
  border-radius: 9px;
  background: var(--accent);
  color: #ffffff;
  font-size: 14px;
  transition:
    background 0.16s ease,
    opacity 0.16s ease;
}

.send-btn:hover:not(:disabled) {
  background: var(--accent-deep);
}

.send-btn:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}

.agent-footnote {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 7px;
  color: var(--faint);
  font-size: 8.5px;
}

.agent-footnote .dot {
  width: 5px;
  height: 5px;
  box-shadow: none;
}

@keyframes blink {
  0%,
  100% {
    opacity: 0.3;
    transform: translateY(0);
  }
  50% {
    opacity: 1;
    transform: translateY(-2px);
  }
}

@media (max-width: 520px) {
  .agent-head {
    padding: 15px 14px 14px;
  }

  .agent-list {
    padding: 14px 12px 10px;
  }

  .welcome-grid {
    grid-template-columns: 1fr;
  }

  .agent-welcome h3 {
    font-size: 22px;
  }

  .agent-composer {
    padding: 8px 10px 10px;
  }
}
</style>
