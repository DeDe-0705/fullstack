import { Alert, Button, Card, Divider, Flex, List, Space, Typography } from "antd";
import { useContext, useRef, useState } from "react";
import { userConfigContext } from "../utils";

const STACK = [
  "前端：React 19 + TypeScript + Tailwind CSS v4 + React Router v7 + Zustand + Vite",
  "后端：NestJS",
  "包管理：pnpm",
];

// ===== 迭代器与生成器实操工具（放在组件外，避免每次渲染重复创建） =====

// ① 手写迭代器：闭包保存游标 index，每次 next() 前进一位
function createIterator<T>(arr: T[]): Iterator<T> {
  let index = 0;
  return {
    next(): IteratorResult<T> {
      if (index < arr.length) {
        return { value: arr[index++], done: false };
      }
      return { value: undefined, done: true };
    },
  };
}

// ② 可迭代对象：实现 Symbol.iterator，才能被 for...of / 展开运算符消费
function makeRange(from: number, to: number): Iterable<number> {
  const start = from;
  const end = to;
  return {
    [Symbol.iterator]() {
      let current = start;
      return {
        next(): IteratorResult<number> {
          if (current <= end) {
            return { value: current++, done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

// ③ 基础生成器：function* + yield，调用返回迭代器，可暂停 / 恢复
function* countUp(max: number): Generator<number, void, unknown> {
  for (let i = 1; i <= max; i++) {
    yield i;
  }
}

// ④ yield 双向通信：next(arg) 会把 arg 回传给「上一个 yield」的返回值
function* twoWay(): Generator<string, void, string> {
  const received = yield "第一次 yield：等待外部 next(arg) 回传";
  yield `第二次 yield：我收到了 "${received}"`;
}

// ⑤ 无限序列：惰性求值，按需计算，不会一次性生成全部
function* fibonacci(): Generator<number, void, unknown> {
  let [a, b] = [0, 1];
  while (true) {
    yield a;
    [a, b] = [b, a + b];
  }
}

// ⑥ yield* 委托 + 树遍历
interface TreeNode<T> {
  value: T;
  children: TreeNode<T>[];
}

function* traverse<T>(node: TreeNode<T>): Generator<T, void, unknown> {
  yield node.value;
  for (const child of node.children) {
    yield* traverse(child);
  }
}

const DEMO_TREE: TreeNode<string> = {
  value: "root",
  children: [
    {
      value: "A",
      children: [
        { value: "A-1", children: [] },
        { value: "A-2", children: [] },
      ],
    },
    { value: "B", children: [{ value: "B-1", children: [] }] },
  ],
};

// ⑦ async/await = Generator + 自动执行器
function* asyncFlow(): Generator<Promise<string>, string, string> {
  const step1 = yield Promise.resolve("第 1 步结果");
  const step2 = yield Promise.resolve(`${step1} → 第 2 步结果`);
  return step2;
}

function run(
  generator: () => Generator<Promise<string>, string, string>,
): Promise<string> {
  return new Promise((resolve) => {
    const iterator = generator();
    const step = (arg?: string) => {
      const { value, done } = iterator.next(arg as string);
      if (done) {
        resolve(value);
        return;
      }
      Promise.resolve(value).then(step);
    };
    step();
  });
}

export function About() {
  const userConfig = useContext(userConfigContext);

  const [logs, setLogs] = useState<string[]>([]);
  const pushLog = (msg: string) => {
    const time = performance.now().toFixed(0);
    setLogs((prev) => [`[${time}ms] ${msg}`, ...prev]);
  };
  const clearLogs = () => setLogs([]);

  // 迭代器 / 生成器是「有状态」的，用 ref 保存实例，跨渲染保持进度
  const arrayIteratorRef = useRef<Iterator<string> | null>(null);
  const countGeneratorRef = useRef<Generator<number, void, unknown> | null>(null);
  const twoWayGeneratorRef = useRef<Generator<string, void, string> | null>(null);
  const fibonacciGeneratorRef = useRef<Generator<number, void, unknown> | null>(null);

  // --- ① 手写迭代器 ---
  const startArrayIterator = () => {
    arrayIteratorRef.current = createIterator(["红", "黄", "蓝"]);
    pushLog('已创建 createIterator(["红", "黄", "蓝"])，点「下一步」调用 next()');
  };
  const stepArrayIterator = () => {
    const it = arrayIteratorRef.current;
    if (!it) {
      pushLog("请先点「创建迭代器」");
      return;
    }
    const { value, done } = it.next();
    pushLog(
      `next() → { value: ${JSON.stringify(value)}, done: ${done} }${done ? "（已耗尽，再点仍返回 done:true）" : ""}`,
    );
  };

  // --- ② 可迭代对象 ---
  const demoIterable = () => {
    const spread = [...makeRange(1, 4)];
    let looped = "";
    for (const value of makeRange(1, 4)) {
      looped += `${value} `;
    }
    pushLog(`[...range(1,4)] → [${spread.join(", ")}]`);
    pushLog(`for...of → ${looped.trimEnd()}`);
  };

  // --- ③ 基础生成器 ---
  const startCountGenerator = () => {
    countGeneratorRef.current = countUp(3);
    pushLog("已创建 countUp(3)，函数体一行都还没执行，点「next()」才真正开始");
  };
  const stepCountGenerator = () => {
    const g = countGeneratorRef.current;
    if (!g) {
      pushLog("请先点「创建生成器」");
      return;
    }
    const { value, done } = g.next();
    pushLog(
      `next() → { value: ${value}, done: ${done} }${done ? "（生成器已耗尽）" : ""}`,
    );
  };

  // --- ④ yield 双向通信 ---
  const startTwoWay = () => {
    const g = twoWay();
    twoWayGeneratorRef.current = g;
    const first = g.next();
    pushLog(
      `第一次 next() → { value: ${JSON.stringify(first.value)}, done: ${first.done} }（第一次 next 传参无效）`,
    );
  };
  const sendToTwoWay = () => {
    const g = twoWayGeneratorRef.current;
    if (!g) {
      pushLog("请先点「开始双向通信」");
      return;
    }
    const res = g.next("德德");
    if (res.done) {
      pushLog("生成器已执行完毕");
    } else {
      pushLog(
        `next("德德") → 上一个 yield 收到 "德德"，本次 yield 给出 { value: ${JSON.stringify(res.value)} }`,
      );
    }
  };

  // --- ⑤ 斐波那契无限序列 ---
  const startFibonacci = () => {
    fibonacciGeneratorRef.current = fibonacci();
    pushLog("已创建 fibonacci() 无限生成器，点一次 next() 取一个数（惰性，不会一次算完）");
  };
  const stepFibonacci = () => {
    const g = fibonacciGeneratorRef.current;
    if (!g) {
      pushLog("请先点「创建斐波那契」");
      return;
    }
    const { value } = g.next();
    pushLog(`next() → ${value}`);
  };

  // --- ⑥ 树遍历 ---
  const demoTraverse = () => {
    const result = [...traverse(DEMO_TREE)];
    pushLog(`深度优先（yield* 委托）→ ${result.join(" → ")}`);
  };

  // --- ⑦ async/await 关系 ---
  const demoAsyncRunner = async () => {
    pushLog("执行 run(asyncFlow)：用自动执行器驱动生成器，模拟 async/await 的执行顺序");
    const result = await run(asyncFlow);
    pushLog(`执行完成 → ${result}`);
  };

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>关于</Typography.Title>
        <Typography.Paragraph type="secondary">
          这是一个通用全栈脚手架，包含前后端分离架构。{userConfig?.name}
        </Typography.Paragraph>
      </div>

      <Card title="技术栈">
        <List
          dataSource={STACK}
          renderItem={(item) => <List.Item>{item}</List.Item>}
        />
      </Card>

      <Divider />

      <div>
        <Typography.Title level={3}>迭代器与生成器 · 实操</Typography.Title>
        <Typography.Paragraph type="secondary">
          一步步点按钮，观察每次 next() 返回的 {"{ value, done }"}，亲手跑一遍「暂停 / 恢复」「惰性求值」「双向通信」。
        </Typography.Paragraph>
        <Alert
          type="info"
          showIcon
          message="一句话记忆：迭代器是「有 next() 的协议」，生成器是「能暂停 / 恢复的函数」，async/await 是「Generator + 自动执行器」的语法糖。"
        />
      </div>

      <Card title="① 手写迭代器：next() 返回 { value, done }" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            普通数组本身可迭代，但这里用闭包手写一个迭代器，体会「游标 + next()」的协议本质。
          </Typography.Paragraph>
          <Space>
            <Button type="primary" onClick={startArrayIterator}>
              创建迭代器
            </Button>
            <Button onClick={stepArrayIterator}>下一步 next()</Button>
          </Space>
        </Space>
      </Card>

      <Card title="② 可迭代对象：Symbol.iterator 才能被 for...of 消费" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            makeRange(1,4) 实现了 Symbol.iterator，展开运算符和 for...of 底层都走同一个协议。
          </Typography.Paragraph>
          <Button onClick={demoIterable}>运行 [...range] 和 for...of</Button>
        </Space>
      </Card>

      <Card title="③ 基础生成器：function* + yield 的暂停 / 恢复" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            调用 countUp(3) 不会执行函数体，只有 next() 才会跑到下一个 yield 并暂停。
          </Typography.Paragraph>
          <Space>
            <Button type="primary" onClick={startCountGenerator}>
              创建生成器
            </Button>
            <Button onClick={stepCountGenerator}>下一步 next()</Button>
          </Space>
        </Space>
      </Card>

      <Card title="④ yield 双向通信：next(arg) 把值回传给 yield" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            yield 既能向外抛值，也能接收 next(arg) 传入的值；注意第一次 next() 传参无效。
          </Typography.Paragraph>
          <Space>
            <Button type="primary" onClick={startTwoWay}>
              开始双向通信
            </Button>
            <Button onClick={sendToTwoWay}>next("德德")</Button>
          </Space>
        </Space>
      </Card>

      <Card title="⑤ 无限序列：fibonacci() 惰性求值" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            无限生成器不会一次算完，点一次 next() 只算一个数，这正是惰性求值的价值。
          </Typography.Paragraph>
          <Space>
            <Button type="primary" onClick={startFibonacci}>
              创建斐波那契
            </Button>
            <Button onClick={stepFibonacci}>下一步 next()</Button>
          </Space>
        </Space>
      </Card>

      <Card title="⑥ yield* 委托：深度优先遍历树" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            yield* 把迭代委托给另一个生成器，遍历树时递归 yield* 即可写出清晰的 DFS。
          </Typography.Paragraph>
          <Button onClick={demoTraverse}>遍历 DEMO_TREE</Button>
        </Space>
      </Card>

      <Card title="⑦ async/await = Generator + 自动执行器" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            run() 是一个迷你执行器，自动 next() 并等待 Promise resolve，等价于 async/await 的「语法糖」本质。
          </Typography.Paragraph>
          <Button onClick={demoAsyncRunner}>执行 run(asyncFlow)</Button>
        </Space>
      </Card>

      <Card
        title="运行日志"
        size="small"
        extra={
          <Button size="small" onClick={clearLogs}>
            清空
          </Button>
        }
      >
        <Flex vertical gap={4}>
          {logs.length === 0 && (
            <Typography.Text type="secondary">
              暂无日志，点击上方按钮开始演示
            </Typography.Text>
          )}
          {logs.map((log, index) => (
            <Typography.Text
              key={index}
              style={{ fontSize: 12, fontFamily: "monospace" }}
            >
              {log}
            </Typography.Text>
          ))}
        </Flex>
      </Card>
    </Flex>
  );
}
