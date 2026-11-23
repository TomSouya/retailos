<script setup>
import { computed } from 'vue'
import {
  CircleCheck,
  CircleClose,
  Clock,
  Loading,
  RefreshRight,
} from '@element-plus/icons-vue'
import { formatDuration } from '@/utils/format'

const props = defineProps({
  tool: { type: Object, required: true },
})

const STATUS = {
  queued: { label: '排队中', icon: Clock },
  running: { label: '执行中', icon: Loading },
  succeeded: { label: '已完成', icon: CircleCheck },
  failed: { label: '失败', icon: CircleClose },
  retrying: { label: '重试中', icon: RefreshRight },
  cancelled: { label: '已取消', icon: CircleClose },
}

const meta = computed(() => STATUS[props.tool.status] || STATUS.queued)

const inputSummary = computed(() => {
  const text = JSON.stringify(props.tool.input || {})
  return text.length > 82 ? `${text.slice(0, 82)}…` : text
})

const duration = computed(() => {
  if (props.tool.status === 'running') return '进行中'
  if (props.tool.durationMs) return formatDuration(props.tool.durationMs)
  return '—'
})

const prettyOutput = computed(() =>
  JSON.stringify(props.tool.output || {}, null, 2),
)
</script>

<template>
  <article class="tool-card" :class="`is-${tool.status}`">
    <div class="tool-main">
      <div class="tool-icon">
        <el-icon>
          <component
            :is="meta.icon"
            :class="{ 'is-spinning': tool.status === 'running' }"
          />
        </el-icon>
      </div>

      <div class="tool-copy">
        <div class="tool-name">
          {{ tool.label }}
          <span class="tool-code">{{ tool.name }}</span>
        </div>
        <div class="tool-input mono">{{ inputSummary }}</div>
      </div>

      <div class="tool-side">
        <span class="tool-status">{{ meta.label }}</span>
        <span class="tool-duration mono">{{ duration }}</span>
      </div>
    </div>

    <div v-if="tool.status === 'running'" class="tool-progress">
      <span></span>
    </div>

    <div v-if="tool.error" class="tool-error">{{ tool.error }}</div>

    <details v-if="tool.output" class="tool-output">
      <summary>查看返回</summary>
      <pre>{{ prettyOutput }}</pre>
    </details>
  </article>
</template>

<style scoped>
.tool-card {
  position: relative;
  overflow: hidden;
  border: 1px dashed var(--line-strong);
  border-radius: 11px;
  background: var(--surface-2);
}

.tool-card.is-running {
  border-style: solid;
  border-color: #c0cbf6;
  background: var(--accent-soft);
}

.tool-main {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 11px;
}

.tool-icon {
  display: grid;
  width: 24px;
  height: 24px;
  flex: none;
  place-items: center;
  border-radius: 7px;
  background: var(--surface-3);
  color: var(--muted);
  font-size: 13px;
}

.is-running .tool-icon {
  background: var(--accent-soft);
  color: var(--accent-deep);
}

.is-succeeded .tool-icon {
  background: var(--success-soft);
  color: var(--success);
}

.is-failed .tool-icon,
.is-cancelled .tool-icon {
  background: var(--danger-soft);
  color: var(--danger);
}

.tool-copy {
  min-width: 0;
  flex: 1;
}

.tool-name {
  display: flex;
  align-items: baseline;
  gap: 6px;
  color: var(--text);
  font-size: 12.5px;
  font-weight: 650;
  line-height: 1.4;
}

.tool-code {
  overflow: hidden;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 9.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-input {
  margin-top: 3px;
  overflow: hidden;
  color: var(--muted);
  font-size: 10px;
  line-height: 1.5;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tool-side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex: none;
}

.tool-status {
  color: var(--muted);
  font-size: 10.5px;
  font-weight: 600;
}

.is-running .tool-status {
  color: var(--accent-deep);
}

.is-succeeded .tool-status {
  color: var(--success);
}

.is-failed .tool-status,
.is-cancelled .tool-status {
  color: var(--danger);
}

.tool-duration {
  color: var(--faint);
  font-size: 9.5px;
}

.tool-progress {
  position: relative;
  height: 2px;
  overflow: hidden;
  background: #d7dffa;
}

.tool-progress span {
  position: absolute;
  inset: 0;
  width: 42%;
  background: linear-gradient(90deg, transparent, var(--accent), transparent);
  animation: shimmer 1.4s ease-in-out infinite;
}

.tool-error {
  padding: 0 11px 9px;
  color: var(--danger);
  font-size: 10.5px;
  line-height: 1.5;
}

.is-spinning {
  animation: spin 0.9s linear infinite;
}

.tool-output {
  border-top: 1px dashed var(--line);
}

.tool-output summary {
  padding: 6px 11px;
  color: var(--faint);
  cursor: pointer;
  font-size: 10.5px;
  list-style: none;
}

.tool-output summary::-webkit-details-marker {
  display: none;
}

.tool-output pre {
  max-height: 160px;
  margin: 0;
  padding: 0 11px 10px;
  overflow: auto;
  color: var(--text-soft);
  font-family: var(--mono);
  font-size: 10px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
