export interface Pagination {
  limit: number;
  offset: number;
}

// 列表接口统一的分页解析：非法值回退默认值，上限 100 防止拖库
export function parsePagination(
  query: { limit?: string; offset?: string },
  defaults: { limit?: number; max?: number } = {},
): Pagination {
  const max = defaults.max ?? 100;
  const defaultLimit = defaults.limit ?? 20;
  const rawLimit = Number(query.limit);
  const limit = Number.isInteger(rawLimit)
    ? Math.min(Math.max(rawLimit, 1), max)
    : defaultLimit;
  const rawOffset = Number(query.offset);
  const offset = Number.isInteger(rawOffset) ? Math.max(rawOffset, 0) : 0;
  return { limit, offset };
}
