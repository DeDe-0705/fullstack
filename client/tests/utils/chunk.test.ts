import { describe, it, expect } from 'vitest'
import { chunk } from '../../src/utils/chunk'

// TDD Red 阶段：chunk.ts 尚不存在
describe('chunk 数组分块', () => {
  it('均分场景', () => {
    expect(chunk([1, 2, 3, 4], 2)).toEqual([[1, 2], [3, 4]])
  })

  it('不能均分时，最后一块是剩余元素', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('size 大于数组长度时，返回单个完整块', () => {
    expect(chunk([1, 2], 5)).toEqual([[1, 2]])
  })

  it('空数组返回空数组', () => {
    expect(chunk([], 3)).toEqual([])
  })

  it('不修改原数组', () => {
    const source = [1, 2, 3]
    chunk(source, 2)
    expect(source).toEqual([1, 2, 3])
  })

  it('非法 size 抛错（边界防御）', () => {
    expect(() => chunk([1, 2], 0)).toThrow()
    expect(() => chunk([1, 2], -1)).toThrow()
  })
})
