<script setup>
const page = defineModel('page', { type: Number, default: 1 })
const pageSize = defineModel('pageSize', { type: Number, default: 10 })

defineProps({
  total: { type: Number, default: 0 },
  pageSizes: { type: Array, default: () => [10, 20, 50] },
})
</script>

<template>
  <div v-if="total > 0" class="table-pagination">
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :page-sizes="pageSizes"
      :total="total"
      :pager-count="5"
      layout="total, sizes, prev, pager, next"
      background
      small
    />
  </div>
</template>

<style scoped>
.table-pagination {
  display: flex;
  justify-content: flex-end;
  padding: 12px 16px 14px;
  border-top: 1px solid var(--line);
}

.table-pagination :deep(.el-pagination.is-background .el-pager li),
.table-pagination :deep(.el-pagination.is-background .btn-prev),
.table-pagination :deep(.el-pagination.is-background .btn-next) {
  border-radius: 6px;
}

@media (max-width: 640px) {
  .table-pagination {
    justify-content: center;
    padding: 10px 12px 12px;
  }

  .table-pagination :deep(.el-pagination__total),
  .table-pagination :deep(.el-pagination__sizes) {
    display: none;
  }
}
</style>
