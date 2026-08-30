import type { StateCreator, StoreMutatorIdentifier } from "zustand";

// 自定义 Zustand 中间件：每次 set 后打印 prev -> next，方便观察状态变化
// 类型签名是 Zustand 官方推荐的中间件写法，保证 create<T>()(...) 能正常推导
type Logger = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  f: StateCreator<T, Mps, Mcs>,
  name?: string,
) => StateCreator<T, Mps, Mcs>;

type LoggerImpl = <T>(
  f: StateCreator<T, [], []>,
  name?: string,
) => StateCreator<T, [], []>;

const loggerImpl: LoggerImpl = (f, name) => (set, get, store) => {
  const loggedSet: typeof set = (...args) => {
    const prev = get();
    set(...(args as Parameters<typeof set>));
    const next = get();
    console.log(`[${name ?? "store"}]`, { prev, next });
  };

  return f(loggedSet, get, store);
};

export const logger = loggerImpl as unknown as Logger;
