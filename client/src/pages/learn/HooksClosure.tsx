import { useCallback, useEffect, useState } from "react";
import { Alert, Button, Card, Flex, Space, Typography } from "antd";

/**
 * 主题一：Hooks 闭包陷阱与 setState 机制
 *
 * 面试高频：
 * 1. 为什么 setTimeout / 事件监听里拿到的 state 是旧值？
 * 2. setState 什么时候同步、什么时候异步（批量更新）？
 * 3. 为什么 React 用「函数式更新」而不是 Vue 的自动依赖追踪？
 *
 * 核心原理：每次渲染都是一个独立的「快照」。
 * 函数组件的每次执行都会创建一套全新的变量和函数，
 * 闭包捕获的是「当次渲染」时的 state 值，而不是一个会变的引用。
 * Vue 用 Proxy 拦截属性访问，所以能追踪依赖并自动更新；
 * React 没有这种响应式拦截，必须通过重新执行组件函数来获取新值。
 */

// 用于记录事件循环中的输出顺序，演示 setState 的批量更新
function useEventLog() {
  const [logs, setLogs] = useState<string[]>([]);

  const push = useCallback((msg: string) => {
    const time = performance.now().toFixed(1);
    setLogs((prev) => [`[${time}ms] ${msg}`, ...prev]);
  }, []);

  const clear = useCallback(() => setLogs([]), []);

  return { logs, push, clear };
}

export function HooksClosure() {
  const [count, setCount] = useState(0);
  const { logs, push, clear } = useEventLog();

  // 演示 1：闭包陷阱——连续点击后，定时器里读到的 count 是点击时的旧值
  const handleClosureTrap = () => {
    const currentAtClick = count;
    push(`点击时 count = ${currentAtClick}，3 秒后读到的 count = ?`);
    setTimeout(() => {
      // 关键：这里的 count 是「本次渲染」的闭包变量，不是最新值
      // 即使 3 秒内 count 已经变了，这里读到的仍是点击那一刻的值
      push(`定时器触发：读到 count = ${count}（点击时是 ${currentAtClick}）`);
    }, 3000);
  };

  // 演示 2：函数式更新——即使闭包里的 count 是旧的，prev 始终是最新值
  const handleFunctionalUpdate = () => {
    const currentAtClick = count;
    push(`点击时 count = ${currentAtClick}，定时器用函数式更新 +1`);
    setTimeout(() => {
      // setCount(prev => ...) 的 prev 由 React 保证是「最新」值，
      // 而不是闭包捕获的旧值
      setCount((prev) => {
        push(`函数式更新：prev = ${prev}，更新为 ${prev + 1}`);
        return prev + 1;
      });
    }, 3000);
  };

  // 演示 3：setState 批量更新——同一个事件处理器里的多次 setState 会被合并
  const handleBatching = () => {
    push("连续调用 3 次 setCount(count + 1)，观察 count 只加 1");
    // React 18+ 自动批处理：同一个事件里的多次 setState 只触发一次渲染
    // 且每次都是基于「同一份旧值」计算，所以下面是 0+1 而不是 0+1+1+1
    setCount(count + 1);
    setCount(count + 1);
    setCount(count + 1);
    // 如果要用函数式更新，则每次 prev 都是最新的：0+1 → 1+1 → 2+1 = 3
  };

  // 演示 4：对比——定时器里连续 setCount 同样批量，但函数式更新能拿到最新 prev
  const handleBatchingInTimeout = () => {
    push("setTimeout 里连续调用 3 次函数式更新，观察是否 +3");
    setTimeout(() => {
      setCount((prev) => prev + 1);
      setCount((prev) => prev + 1);
      setCount((prev) => prev + 1);
      push("定时器内 3 次函数式更新执行完毕（React 批量提交）");
    }, 100);
  };

  // 演示 5：同步 vs 异步——事件处理器里是异步，原生事件/微任务里是同步
  const handleSyncAsync = () => {
    push("测试 setState 在哪些场景同步、哪些场景异步");
    // React 18 之前：setTimeout / 原生事件里 setState 是同步的
    // React 18 之后：所有场景统一自动批处理，但仍非「同步」——结果在下一次渲染才可见
    setCount((prev) => {
      push(`第一次 setState 的 prev = ${prev}`);
      return prev + 1;
    });
    setCount((prev) => {
      push(`第二次 setState 的 prev = ${prev}（已拿到上次结果）`);
      return prev + 1;
    });
    push(`事件处理器末尾：直接读 count = ${count}（还是旧值！）`);
  };

  // 演示 6：useEffect 演示闭包——effect 只在依赖变化时重新执行
  useEffect(() => {
    push(`useEffect 执行：count = ${count}`);
    // 注意：如果依赖数组为空，这里的 count 永远是 0
    // 如果依赖 [count]，每次 count 变化都会重新执行，闭包捕获新值
  }, [count, push]); // push 依赖 setLogs 的函数式更新，是稳定引用

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>
          Hooks 闭包陷阱与 setState 机制
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          当前 count：
          <Typography.Text strong style={{ fontSize: 24, marginLeft: 8 }}>
            {count}
          </Typography.Text>
        </Typography.Paragraph>
        <Alert
          type="info"
          showIcon
          message="核心认知：函数组件的每次渲染都是独立快照，闭包捕获的是当次渲染的 state。"
          description="Vue 通过 Proxy 追踪依赖实现自动更新，React 没有响应式拦截，所以依赖重新执行组件函数。函数式更新 prev => ... 是 React 保证最新值的唯一可靠方式。"
        />
      </div>

      <Card title="演示 1：闭包陷阱——定时器读到旧值" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            点击「+1」两次，然后在 3 秒内再点一次「+1」。观察定时器打印的 count
            和页面显示的 count 不一致。
          </Typography.Paragraph>
          <Space>
            <Button onClick={() => setCount(count + 1)}>+1</Button>
            <Button danger onClick={handleClosureTrap}>
              点击后 3 秒打印 count
            </Button>
          </Space>
        </Space>
      </Card>

      <Card title="演示 2：函数式更新——prev 永远是最新值" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            对比演示 1：同样点击后 3 秒，但用 setCount(prev =&gt; prev +
            1)，拿到的是最新值。
          </Typography.Paragraph>
          <Button type="primary" onClick={handleFunctionalUpdate}>
            点击后 3 秒函数式 +1
          </Button>
        </Space>
      </Card>

      <Card
        title="演示 3：setState 批量更新——同一事件里多次 setState"
        size="small"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            React 18+ 自动批处理：同一事件处理器里的多次 setCount(count + 1)
            只会让 count 加 1（基于同一旧值）。 而函数式更新会依次基于最新 prev
            计算。
          </Typography.Paragraph>
          <Space>
            <Button onClick={handleBatching}>
              连续 3 次 setCount(count+1)
            </Button>
            <Button onClick={handleBatchingInTimeout}>
              setTimeout 里 3 次函数式更新
            </Button>
          </Space>
        </Space>
      </Card>

      <Card
        title="演示 4：同步还是异步？——事件处理器末尾直接读 count"
        size="small"
      >
        <Space direction="vertical" style={{ width: "100%" }}>
          <Typography.Paragraph type="secondary">
            点击后观察日志：函数式更新能依次拿到最新
            prev，但事件处理器末尾直接读 count 仍然是旧值。
          </Typography.Paragraph>
          <Button onClick={handleSyncAsync}>运行测试</Button>
        </Space>
      </Card>

      <Card
        title="事件日志"
        size="small"
        extra={
          <Button size="small" onClick={clear}>
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
          {logs.map((log, i) => (
            <Typography.Text
              key={i}
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
