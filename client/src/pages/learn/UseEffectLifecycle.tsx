import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Alert, Button, Card, Flex, Space, Typography } from "antd";

/**
 * 主题二：useEffect 生命周期与依赖数组
 *
 * 面试高频：
 * 1. useEffect 和 useLayoutEffect 的区别？执行时机？
 * 2. 依赖数组的作用？为什么不能省略？
 * 3. StrictMode 下 effect 为什么执行两次？
 * 4. 清理函数什么时候执行？
 *
 * 核心原理：
 * - useEffect：render 提交到 DOM 后异步执行（浏览器绘制之后）
 * - useLayoutEffect：render 提交后、浏览器绘制前同步执行（阻塞绘制）
 * - 依赖数组：React 用 Object.is 比较每个依赖，任一变化则重新执行 effect
 * - 清理函数：effect 重新执行前 或 组件卸载前执行
 */

function useEventLog() {
  const [logs, setLogs] = useState<string[]>([]);

  const push = useCallback((msg: string) => {
    setLogs((prev) => [`[${performance.now().toFixed(1)}ms] ${msg}`, ...prev]);
  }, []);

  const clear = useCallback(() => setLogs([]), []);

  return { logs, push, clear };
}

export function UseEffectLifecycle() {
  const [count, setCount] = useState(0);
  const [text, setText] = useState("");
  const { logs, push, clear } = useEventLog();
  const renderCount = useRef(0);
  // 教学演示：追踪渲染次数。React 19 推荐在 effect 中更新 ref，
  // 但这里需要在 render 时立即记录，属于教学工具的刻意简化。
  // eslint-disable-next-line react-hooks/refs
  renderCount.current += 1;

  // 每次渲染后 push 一条日志（用 useEffect，等渲染完成）
  useEffect(() => {
    push(`第 ${renderCount.current} 次渲染完成`);
  }, [push]);

  // 场景 1：空依赖数组 —— 只在挂载时执行一次
  useEffect(() => {
    push("useEffect([]) 挂载时执行（只一次）");
    return () => push("useEffect([]) 清理函数（组件卸载前执行）");
  }, [push]);

  // 场景 2：依赖 [count] —— count 变化时重新执行
  useEffect(() => {
    push(`useEffect([count]) 执行：count = ${count}`);
    // 清理函数在「下次 effect 执行前」或「卸载前」运行
    return () => push(`useEffect([count]) 清理：上一轮的 count = ${count}`);
  }, [count, push]);

  // 场景 3：依赖 [text] —— text 变化时执行（但 count 变化时不会执行）
  useEffect(() => {
    if (text) push(`useEffect([text]) 执行：text = "${text}"`);
  }, [text, push]);

  // 场景 4：useLayoutEffect —— 在浏览器绘制前同步执行
  useLayoutEffect(() => {
    // 这里会阻塞浏览器绘制，适合「读取布局信息并同步修改」的场景
    // 比如：测量 DOM 尺寸、滚动位置，避免闪烁
    push(`useLayoutEffect 执行（绘制前，阻塞渲染）`);
  }, [count, push]);

  // 演示 StrictMode 下的双执行：React 19 开发模式下 mount → unmount → mount
  useEffect(() => {
    push("StrictMode effect 执行（开发模式会执行两次）");
    return () => push("StrictMode effect 清理（第一次 mount 后立即清理）");
  }, [push]);

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>
          useEffect 生命周期与依赖数组
        </Typography.Title>
        <Alert
          type="info"
          showIcon
          message="执行时机：useEffect 在 DOM 提交后异步执行；useLayoutEffect 在 DOM 提交后、浏览器绘制前同步执行。"
          description="依赖数组用 Object.is 比较。空数组 = 只挂载执行；省略 = 每次渲染都执行。清理函数在 effect 重新执行前或组件卸载前运行。"
        />
      </div>

      <Card title="操作区" size="small">
        <Space direction="vertical" style={{ width: "100%" }}>
          <Space>
            <Button onClick={() => setCount((c) => c + 1)}>
              count +1（当前 {count}）
            </Button>
            <Button onClick={() => setText((t) => t + "a")}>
              text 追加字符
            </Button>
            <Button onClick={clear}>清空日志</Button>
          </Space>
          <Typography.Paragraph type="secondary">
            观察日志中：
            <br />
            1. count 变化时，useEffect([count]) 先执行清理函数（打印旧
            count），再执行新 effect
            <br />
            2. text 变化时，useEffect([count]) 不会重新执行
            <br />
            3. useLayoutEffect 总是先于 useEffect 打印
            <br />
            4. StrictMode 下挂载 effect 执行两次（开发模式特有）
          </Typography.Paragraph>
        </Space>
      </Card>

      <Card title="执行日志" size="small">
        <Flex vertical gap={4}>
          {logs.length === 0 && (
            <Typography.Text type="secondary">暂无日志</Typography.Text>
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
