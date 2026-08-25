import { useQuery } from "@tanstack/react-query";
import { Button, Card, Flex, Spin, Statistic, Typography } from "antd";
import { useCounterStore } from "../stores/counter";
import { api } from "../lib/api";
import { useRef } from "react";

export function Home() {
  const { count, increment, decrement, reset } = useCounterStore();
  // 服务端状态交给 TanStack Query，替代原来的 useEffect + useState 手写取数
  const { data, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<{ status: string }>("/health"),
  });

  const SET_LOADING = Symbol("SET_LOADING");
  console.log(SET_LOADING);

  const name = Symbol("name");
  const a = {
    [name]: "dede",
  };
  console.log(a[name]);

  const divEl = useRef<HTMLDivElement | null>(null);

  const toBiger = () => {
    let rafId: number | null = null; // 用变量保存最新的 rafId

    const startBigger = () => {
      const curWidth = divEl.current!.clientWidth;
      divEl.current!.style.width = `${curWidth + 8}px`;
      rafId = requestAnimationFrame(startBigger); // 每次都更新 rafId
    };

    rafId = requestAnimationFrame(startBigger);

    setTimeout(() => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId); // ✅ 取消最新的一次
      }
    }, 1000);
  };

  return (
    <Flex vertical gap={24}>
      <div
        ref={divEl}
        className="w-[24px] h-[24px] bg-black"
        onClick={toBiger}
      ></div>
      <div>
        <Typography.Title level={3}>全栈脚手架</Typography.Title>
        <Typography.Paragraph type="secondary">
          React + TypeScript + Tailwind CSS + React Router + Zustand + NestJS
        </Typography.Paragraph>
      </div>

      {/* API 联调示例 */}
      <Card
        title="后端 API 状态"
        extra={isPending ? <Spin size="small" /> : undefined}
      >
        <Statistic
          value={data?.status ?? "—"}
          valueStyle={{ color: "#52c41a" }}
        />
      </Card>

      {/* Zustand 计数器示例 */}
      <Card title="Zustand 状态管理示例">
        <Statistic value={count} />
        <Flex gap={8} style={{ marginTop: 16 }}>
          <Button onClick={decrement}>-1</Button>
          <Button type="primary" onClick={increment}>
            +1
          </Button>
          <Button onClick={reset}>重置</Button>
        </Flex>
      </Card>
    </Flex>
  );
}
