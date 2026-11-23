<script setup>
import { computed } from 'vue'
import ToolCallCard from '@/components/ToolCallCard.vue'
import ApprovalCard from '@/components/ApprovalCard.vue'
import ActionConfirmCard from '@/components/ActionConfirmCard.vue'
import GeneratedView from '@/components/GeneratedView.vue'
import { validateUiPayload } from '@/contracts/uiSchema'
import { renderMarkdown } from '@/utils/markdown'

const props = defineProps({
  message: { type: Object, required: true },
  tools: { type: Array, default: () => [] },
})

defineEmits(['approve', 'cancel', 'confirm', 'cancel-action'])

const isUser = computed(() => props.message.role === 'user')
const toolList = computed(() => {
  if (!props.message.toolIds) return []
  return props.message.toolIds
    .map((id) => props.tools.find((tool) => tool.id === id))
    .filter(Boolean)
})
const uiResult = computed(() =>
  props.message.ui ? validateUiPayload(props.message.ui) : null,
)
const uiSchema = computed(() => (uiResult.value?.ok ? uiResult.value.schema : null))
const renderedText = computed(() => renderMarkdown(props.message.text))
</script>

<template>
  <article class="msg" :class="isUser ? 'is-user' : 'is-assistant'">
    <div class="msg-meta">
      <span class="msg-author">{{ isUser ? '你' : 'RetailOS' }}</span>
      <span v-if="message.kind === 'plan'" class="msg-kind">规划</span>
      <span v-if="message.kind === 'result'" class="msg-kind">结果</span>
      <span v-if="message.traceId" class="msg-trace mono" :title="message.traceId">
        {{ message.traceId.slice(-8) }}
      </span>
      <span class="msg-time mono">{{ message.time }}</span>
    </div>

    <div
      v-if="message.text"
      class="msg-text"
      :class="{
        'is-plan': message.kind === 'plan',
        'is-markdown': !isUser,
      }"
    >
      <template v-if="isUser">{{ message.text }}</template>
      <div v-else class="md-body" v-html="renderedText"></div>
    </div>

    <div v-if="toolList.length" class="tool-stack">
      <ToolCallCard v-for="tool in toolList" :key="tool.id" :tool="tool" />
    </div>

    <GeneratedView v-if="uiSchema" :schema="uiSchema" />
    <div v-else-if="uiResult && !uiResult.ok" class="ui-rejected">
      视图协议校验未通过，已回退为文本结果。
    </div>

    <ApprovalCard
      v-if="message.approval"
      :approval="message.approval"
      @submit="$emit('approve', $event)"
      @cancel="$emit('cancel', $event)"
    />

    <ActionConfirmCard
      v-if="message.confirmation"
      :confirmation="message.confirmation"
      @confirm="$emit('confirm', $event)"
      @cancel="$emit('cancel-action', $event)"
    />
  </article>
</template>

<style scoped>
.msg {
  margin-bottom: 17px;
}

.msg.is-user {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 5px;
  color: var(--faint);
  font-size: 9px;
}

.msg-author {
  color: var(--muted);
  font-family: var(--sans);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.is-assistant .msg-author {
  color: var(--accent-deep);
}

.msg-kind {
  padding: 0 5px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--faint);
  font-size: 8px;
  line-height: 1.5;
}

.msg-time {
  font-size: 8.5px;
}

.msg-trace {
  padding: 0 4px;
  border: 1px solid var(--line);
  border-radius: 4px;
  color: var(--faint);
  font-size: 8px;
}

.msg-text {
  color: var(--text-soft);
  font-size: 12.5px;
  line-height: 1.75;
  white-space: pre-wrap;
}

.msg-text.is-markdown {
  white-space: normal;
}

.ui-rejected {
  margin-top: 8px;
  padding: 9px 11px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--muted);
  font-size: 11px;
}

.is-user .msg-text {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 13px 13px 4px 13px;
  background: var(--ink);
  color: #ffffff;
  font-size: 12px;
  line-height: 1.65;
}

.msg-text.is-plan {
  padding: 9px 11px;
  border-left: 2px solid var(--accent);
  border-radius: 0 8px 8px 0;
  background: var(--surface-2);
  color: var(--text-soft);
  font-size: 11.5px;
  line-height: 1.7;
}

.tool-stack {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 8px;
}
</style>
