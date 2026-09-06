/**
 * 数组分块：chunk([1,2,3,4,5], 2) -> [[1,2],[3,4],[5]]
 * 注意：返回新数组，不修改原数组（纯函数，可测试性好）
 */
export function chunk<T> (arr: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size 必须是 >= 1 的整数，收到: ${size}`)
  }

  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}
