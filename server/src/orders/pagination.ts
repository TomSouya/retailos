/**
 * 列表分页参数归一化：页码最小 1，每页 1–50，默认 10。
 */
export function normalizePagination(
  pageInput?: number,
  pageSizeInput?: number,
) {
  const page = Math.max(1, Math.floor(Number(pageInput) || 1))
  const pageSize = Math.min(
    50,
    Math.max(1, Math.floor(Number(pageSizeInput) || 10)),
  )
  return { page, pageSize, skip: (page - 1) * pageSize }
}
