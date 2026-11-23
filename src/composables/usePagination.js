import { computed, ref, watch } from 'vue'

export function usePagination(source, options = {}) {
  const page = ref(1)
  const pageSize = ref(options.pageSize || 10)
  const total = computed(() => source.value.length)

  const paged = computed(() => {
    const start = (page.value - 1) * pageSize.value
    return source.value.slice(start, start + pageSize.value)
  })

  function reset() {
    page.value = 1
  }

  watch(pageSize, reset)

  watch(total, (length) => {
    const maxPage = Math.max(Math.ceil(length / pageSize.value), 1)
    if (page.value > maxPage) page.value = maxPage
  })

  if (options.resetOn) {
    watch(options.resetOn, reset)
  }

  return { page, pageSize, total, paged, reset }
}
