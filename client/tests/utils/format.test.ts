import { describe, it, expect } from 'vitest'
import { formatThousands } from '../../src/utils/format'

// TDD Red 阶段：此时 format.ts 还不存在，测试必然失败
describe('formatThousands 千分位格式化', () => {
  it('基本整数格式化', () => {
    expect(formatThousands(1234567)).toBe('1,234,567')
  })

  it('不足千位时不加逗号', () => {
    expect(formatThousands(999)).toBe('999')
  })

  it('恰好千位边界', () => {
    expect(formatThousands(1000)).toBe('1,000')
  })

  it('保留小数部分', () => {
    expect(formatThousands(1234567.89)).toBe('1,234,567.89')
  })

  it('负数同样处理', () => {
    expect(formatThousands(-1234567)).toBe('-1,234,567')
  })

  it('0 和小数', () => {
    expect(formatThousands(0)).toBe('0')
    expect(formatThousands(0.5)).toBe('0.5')
  })
})
