import MetricRenderer from './MetricRenderer.vue'
import ChartRenderer from './ChartRenderer.vue'
import TableRenderer from './TableRenderer.vue'
import FormRenderer from './FormRenderer.vue'
import CalloutRenderer from './CalloutRenderer.vue'
import { UI_NODE } from '@/contracts/uiSchema'

export const rendererRegistry = {
  [UI_NODE.METRIC_GRID]: MetricRenderer,
  [UI_NODE.CHART]: ChartRenderer,
  [UI_NODE.TABLE]: TableRenderer,
  [UI_NODE.FORM]: FormRenderer,
  [UI_NODE.CALLOUT]: CalloutRenderer,
}

export function resolveRenderer(type) {
  return rendererRegistry[type] || null
}
