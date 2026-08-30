import { useQuery } from "@tanstack/react-query";
import { Button, Card, Flex, Spin, Statistic, Typography } from "antd";
import { useCounterStore } from "../stores/counter";
import { api, DEMO_TOKEN } from "../lib/api";
import { useEffect, useReducer, useRef, useState } from "react";

export function Home() {
  const { count, increment, decrement, reset } = useCounterStore();
  // 服务端状态交给 TanStack Query，替代原来的 useEffect + useState 手写取数
  const { data, isPending } = useQuery({
    queryKey: ["health"],
    queryFn: () => api.get<{ status: string }>("/health"),
  });
  const [num, setNum] = useState(0);

  const reducer = (
    state: { count: number },
    action: { type: string; count: number },
  ) => {
    switch (action.type) {
      case "increment":
        return {
          ...state,
          count: state.count + action.count,
        };
      case "decrement":
        return {
          ...state,
          count: state.count - action.count,
        };

      default:
        throw new Error("Unsupported action type");
    }
  };

  const [countNum, dispatch] = useReducer(
    reducer,
    { count: 0 },
    (init: { count: number }) => {
      console.log("init", init);
      return init;
    },
  );

  useEffect(() => {
    const abort = new AbortController();
    async function fetchHealth() {
      console.log("fetching");
      const res = await fetch("/api/health", {
        headers: { authorization: `Bearer ${DEMO_TOKEN}` },
        signal: abort.signal,
      });
      const data = await res.json();
      console.log(data, num, 1111);
    }
    fetchHealth();
    return () => {
      abort.abort();
    };
  }, [num]);

  useEffect(() => {
    console.log(1);
  }, []);
  useEffect(() => {
    console.log(2);
  }, []);
  useEffect(() => {
    console.log(3);
  }, []);

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
