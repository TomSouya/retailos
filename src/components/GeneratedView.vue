<script setup>
import { computed } from 'vue'
import { resolveRenderer } from './renderers/registry'
import { UI_NODE } from '@/contracts/uiSchema'

const props = defineProps({
  schema: { type: Object, default: null },
})

const isCard = computed(() => props.schema?.type === UI_NODE.CARD)
const title = computed(() => (isCard.value ? props.schema?.props?.title : ''))
const subtitle = computed(() => (isCard.value ? props.schema?.props?.subtitle : ''))
const nodes = computed(() => {
  if (!props.schema) return []
  return isCard.value ? props.schema.children || [] : [props.schema]
})
</script>

<template>
  <section v-if="schema" class="generated-view">
    <header v-if="title || subtitle || schema.version" class="generated-head">
      <div>
        <h4 v-if="title">{{ title }}</h4>
        <p v-if="subtitle">{{ subtitle }}</p>
      </div>
      <span v-if="schema.version" class="schema-version mono">
        A2UI v{{ schema.version }}
      </span>
    </header>

    <div class="generated-body">
      <template v-for="(node, index) in nodes" :key="index">
        <component
          v-if="resolveRenderer(node.type)"
          :is="resolveRenderer(node.type)"
          v-bind="node.props"
        />
        <div v-else class="generated-fallback">
          暂不支持的视图：<code>{{ node.type }}</code>
        </div>
      </template>
    </div>
  </section>
</template>

<style scoped>
.generated-view {
  margin-top: 10px;
  overflow: hidden;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: var(--surface);
}

.generated-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 13px 10px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
}

.schema-version {
  flex: none;
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 999px;
  color: var(--faint);
  font-size: 8.5px;
  letter-spacing: 0.04em;
}

.generated-head h4 {
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.generated-head p {
  margin-top: 2px;
  color: var(--muted);
  font-size: 10px;
}

.generated-body {
  padding: 11px 12px 13px;
}

.generated-fallback {
  padding: 12px;
  border: 1px dashed var(--line-strong);
  border-radius: 8px;
  color: var(--muted);
  font-size: 11px;
}

.generated-fallback code {
  color: var(--accent-deep);
  font-family: var(--mono);
}
</style>
