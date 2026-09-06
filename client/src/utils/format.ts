/**
 * 千分位格式化：1234567.89 -> "1,234,567.89"
 *
 * 重构版（TDD Refactor 阶段）：测试已全部通过，在不改行为的前提下优化实现。
 * 核心思路：只处理整数部分（小数点前的数字串），负号天然不会被匹配，因为它后面跟的不是 3 的倍数位数字。
 * 正则拆解：/\B(?=(\d{3})+(?!\d))/g
 *   - \B            非单词边界：避免在字符串开头（数字串最左侧）加逗号
 *   - (?=(\d{3})+)  前瞻断言：当前位置右侧必须是 3 的倍数位数字
 *   - (?!\d)        负向断言：确保 (\d{3})+ 匹配到最后一组，即右侧恰好是 3 的倍数位
 */
export function formatThousands (num: number): string {
  const [intPart, decimalPart] = String(num).split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimalPart !== undefined ? `${formatted}.${decimalPart}` : formatted
}
