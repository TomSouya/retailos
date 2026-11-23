<script setup>
import { reactive, watch } from 'vue'

const props = defineProps({
  title: { type: String, default: '' },
  fields: { type: Array, default: () => [] },
  submitLabel: { type: String, default: '提交' },
})

const emit = defineEmits(['submit'])
const model = reactive({})

watch(
  () => props.fields,
  (fields) => {
    fields.forEach((field) => {
      if (!(field.key in model)) model[field.key] = field.default ?? ''
    })
  },
  { immediate: true, deep: true },
)
</script>

<template>
  <div class="form-renderer">
    <div v-if="title" class="form-title">{{ title }}</div>
    <el-form label-position="top" size="small">
      <el-form-item v-for="field in fields" :key="field.key" :label="field.label">
        <el-select
          v-if="field.type === 'select'"
          v-model="model[field.key]"
          :placeholder="field.placeholder"
        >
          <el-option
            v-for="option in field.options || []"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
        <el-input
          v-else
          v-model="model[field.key]"
          :placeholder="field.placeholder"
          :type="field.type === 'textarea' ? 'textarea' : 'text'"
        />
      </el-form-item>
    </el-form>
    <el-button type="primary" size="small" @click="emit('submit', { ...model })">
      {{ submitLabel }}
    </el-button>
  </div>
</template>

<style scoped>
.form-renderer {
  padding-top: 10px;
}

.form-title {
  margin-bottom: 6px;
  color: var(--text);
  font-size: 11.5px;
  font-weight: 650;
}

:deep(.el-form-item) {
  margin-bottom: 10px;
}

:deep(.el-form-item__label) {
  padding-bottom: 2px;
  color: var(--muted);
  font-size: 10.5px;
}
</style>
