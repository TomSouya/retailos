import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  UI_LIMITS,
  UI_NODE,
  UI_SCHEMA_VERSION,
  validateUiPayload,
} from '../src/contracts/uiSchema.js'
import {
  AGENT_STATE_VERSION,
  normalizeSharedState,
} from '../src/contracts/agentState.js'

let passed = 0
let failed = 0

function check(name, run) {
  try {
    run()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}: ${error.message}`)
  }
}

check('A2UI 合法负载通过并回写版本', () => {
  const result = validateUiPayload({
    version: UI_SCHEMA_VERSION,
    type: UI_NODE.CARD,
    props: { title: '经营概览' },
    children: [
      {
        type: UI_NODE.METRIC_GRID,
        props: { items: [{ label: '销售额', value: '¥1,000' }] },
      },
      {
        type: UI_NODE.TABLE,
        props: {
          columns: [{ key: 'name', label: '商品' }],
          rows: [{ name: '鲜牛奶' }],
        },
      },
    ],
  })
  assert.equal(result.ok, true)
  assert.equal(result.schema.version, UI_SCHEMA_VERSION)
  assert.equal(result.schema.children.length, 2)
})

check('A2UI 未知节点被丢弃', () => {
  const result = validateUiPayload({
    version: UI_SCHEMA_VERSION,
    type: UI_NODE.CARD,
    children: [{ type: 'html', props: { html: '<script />' } }],
  })
  assert.equal(result.ok, true)
  assert.equal(result.schema.children.length, 0)
  assert.ok(result.errors.includes('unsupported_type:html'))
})

check('A2UI 主版本不兼容时拒绝', () => {
  const result = validateUiPayload({
    version: '2.0',
    type: UI_NODE.CALLOUT,
    props: { text: 'x' },
  })
  assert.equal(result.ok, false)
  assert.ok(result.errors[0].startsWith('unsupported_version'))
})

check('A2UI 超深节点被裁掉', () => {
  let node = { type: UI_NODE.CALLOUT, props: { text: 'deep' } }
  for (let depth = 0; depth < UI_LIMITS.maxDepth + 1; depth += 1) {
    node = {
      type: UI_NODE.CARD,
      props: { title: `level-${depth}` },
      children: [node],
    }
  }
  const result = validateUiPayload(node)
  assert.equal(result.ok, true)
  assert.ok(result.errors.includes('depth_exceeded'))
})

check('A2UI 表格行数被截断', () => {
  const rows = Array.from(
    { length: UI_LIMITS.maxTableRows + 10 },
    (_, index) => ({ name: `row-${index}` }),
  )
  const result = validateUiPayload({
    version: UI_SCHEMA_VERSION,
    type: UI_NODE.TABLE,
    props: {
      columns: [{ key: 'name', label: '名称' }],
      rows,
    },
  })
  assert.equal(result.ok, true)
  assert.equal(result.schema.props.rows.length, UI_LIMITS.maxTableRows)
})

check('A2UI 渲染器覆盖全部节点类型', () => {
  const source = fs.readFileSync(
    new URL('../src/components/renderers/registry.js', import.meta.url),
    'utf8',
  )
  const constants = {
    [UI_NODE.METRIC_GRID]: 'METRIC_GRID',
    [UI_NODE.CHART]: 'CHART',
    [UI_NODE.TABLE]: 'TABLE',
    [UI_NODE.FORM]: 'FORM',
    [UI_NODE.CALLOUT]: 'CALLOUT',
  }
  for (const type of Object.values(constants)) {
    assert.ok(
      source.includes(`UI_NODE.${type}`),
      `渲染器注册表缺少 ${type}`,
    )
  }
})

check('AG-UI 共享状态规范化', () => {
  const state = normalizeSharedState({
    threadId: 'thr_test',
    traceId: 'trc_test',
    context: { page: 'inventory' },
    lastRunId: 'run_1',
    status: 'awaiting_permission',
    pending: { kind: 'approval', id: 'AP-1' },
  })
  assert.equal(state.version, AGENT_STATE_VERSION)
  assert.equal(state.threadId, 'thr_test')
  assert.equal(state.traceId, 'trc_test')
  assert.deepEqual(state.context, { page: 'inventory' })
  assert.equal(state.pending.kind, 'approval')
})

check('AG-UI 空状态提供安全默认值', () => {
  const state = normalizeSharedState()
  assert.equal(state.version, AGENT_STATE_VERSION)
  assert.equal(state.threadId, '')
  assert.equal(state.traceId, '')
  assert.deepEqual(state.context, {})
  assert.equal(state.pending, null)
})

console.log(
  `AGENT_CONTRACT ${failed ? 'FAIL' : 'PASS'} ${passed}/${passed + failed}`,
)
if (failed) process.exit(1)
