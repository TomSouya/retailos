import { describe, expect, it } from 'vitest'
import { normalizePagination } from '../src/orders/pagination'

describe('normalizePagination', () => {
  it('默认第 1 页、每页 10 条', () => {
    expect(normalizePagination()).toEqual({ page: 1, pageSize: 10, skip: 0 })
  })

  it('非法页码回退到第 1 页', () => {
    expect(normalizePagination(0, 10).page).toBe(1)
    expect(normalizePagination(Number.NaN, 10).page).toBe(1)
  })

  it('每页条数限制在 1–50', () => {
    expect(normalizePagination(1, 0).pageSize).toBe(10)
    expect(normalizePagination(1, 999).pageSize).toBe(50)
  })

  it('skip 按页计算', () => {
    expect(normalizePagination(3, 20).skip).toBe(40)
  })
})
