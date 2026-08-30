import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Flex,
  InputNumber,
  Select,
  Space,
  Statistic,
  Typography,
} from "antd";

const COUNT_OPTIONS = [
  { value: 1000, label: "1 千条" },
  { value: 10000, label: "1 万条" },
  { value: 100000, label: "10 万条" },
];

interface VirtualItem {
  id: number;
  text: string;
}

/**
 * 定高虚拟滚动 Demo
 *
 * 核心原理：每一项高度固定（itemHeight），所以位置可以用
 * `index * itemHeight` O(1) 直接算出，无需逐项累加。
 * 只渲染「可视区 + 缓冲」的 DOM，用撑高层维持滚动条，
 * 用 transform: translateY 偏移定位，DOM 数量恒定。
 */
export function FixedVirtualList() {
  const [itemCount, setItemCount] = useState(100000);
  const [itemHeight, setItemHeight] = useState(50);
  const [containerHeight, setContainerHeight] = useState(400);
  const [buffer, setBuffer] = useState(5);
  const [scrollTop, setScrollTop] = useState(0);
  const [jumpIndex, setJumpIndex] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const latestTop = useRef(0);
  const rafId = useRef<number | null>(null);

  // 数据只生成一次（模拟 10 万条；百万级同理，DOM 数量仍恒定）
  const items = useMemo<VirtualItem[]>(
    () =>
      Array.from({ length: itemCount }, (_, i) => ({
        id: i,
        text: `第 ${i + 1} 行 — 定高虚拟滚动示例内容`,
      })),
    [itemCount],
  );

  const totalHeight = itemCount * itemHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIndex = Math.min(
    itemCount,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + buffer,
  );
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  // scroll 高频触发，用 rAF 节流：一帧最多 setState 一次
  const handleScroll = (top: number) => {
    latestTop.current = top;
    if (rafId.current != null) return;
    rafId.current = requestAnimationFrame(() => {
      rafId.current = null;
      setScrollTop(latestTop.current);
    });
  };

  useEffect(() => {
    return () => {
      if (rafId.current != null) cancelAnimationFrame(rafId.current);
    };
  }, []);

  // 参数变化时回到顶部，避免 offset 错位
  const resetScroll = () => {
    scrollRef.current?.scrollTo({ top: 0 });
    setScrollTop(0);
  };

  const jumpTo = () => {
    const index = Math.max(0, Math.min(jumpIndex, itemCount - 1));
    scrollRef.current?.scrollTo({ top: index * itemHeight });
  };

  return (
    <Flex vertical gap={24}>
      <div>
        <Typography.Title level={3}>定高虚拟滚动</Typography.Title>
        <Alert
          type="info"
          showIcon
          message="核心：只渲染「可视区 + 缓冲」的 DOM，用撑高层维持滚动条，用 translateY 偏移定位。"
          description="不管总数据是 1 万还是 10 万条，实际渲染的 DOM 数量始终只有几十个，这就是虚拟滚动性能收益的来源。"
        />
      </div>

      <Card title="参数" size="small">
        <Space wrap>
          <Space>
            <Typography.Text>总条数</Typography.Text>
            <Select
              value={itemCount}
              options={COUNT_OPTIONS}
              style={{ width: 120 }}
              onChange={(v) => {
                setItemCount(v);
                resetScroll();
              }}
            />
          </Space>
          <Space>
            <Typography.Text>每项高度(px)</Typography.Text>
            <InputNumber
              min={20}
              max={200}
              value={itemHeight}
              onChange={(v) => {
                setItemHeight(v ?? 50);
                resetScroll();
              }}
            />
          </Space>
          <Space>
            <Typography.Text>可视区高度(px)</Typography.Text>
            <InputNumber
              min={100}
              max={800}
              value={containerHeight}
              onChange={(v) => setContainerHeight(v ?? 400)}
            />
          </Space>
          <Space>
            <Typography.Text>缓冲条数</Typography.Text>
            <InputNumber
              min={0}
              max={50}
              value={buffer}
              onChange={(v) => setBuffer(v ?? 5)}
            />
          </Space>
        </Space>
      </Card>

      <Card title="实时统计" size="small">
        <Flex gap={32} wrap>
          <Statistic title="总条数" value={itemCount} />
          <Statistic
            title="实际渲染 DOM 数"
            value={visibleItems.length}
            valueStyle={{ color: "#52c41a" }}
          />
          <Statistic title="scrollTop" value={scrollTop} />
          <Statistic title="起始 index" value={startIndex} />
          <Statistic title="结束 index" value={endIndex} />
          <Statistic title="offsetY" value={offsetY} suffix="px" />
          <Statistic title="总高度" value={totalHeight} suffix="px" />
        </Flex>
      </Card>

      <Card
        title="虚拟滚动列表"
        size="small"
        extra={
          <Space>
            <Typography.Text>跳到第</Typography.Text>
            <InputNumber
              min={0}
              value={jumpIndex}
              onChange={(v) => setJumpIndex(v ?? 0)}
              style={{ width: 100 }}
            />
            <Typography.Text>行</Typography.Text>
            <Button onClick={jumpTo}>跳转</Button>
          </Space>
        }
      >
        <div
          ref={scrollRef}
          onScroll={(e) => handleScroll(e.currentTarget.scrollTop)}
          style={{
            height: containerHeight,
            overflowY: "auto",
            position: "relative",
            border: "1px solid #f0f0f0",
            borderRadius: 6,
          }}
        >
          {/* 撑高层：负责撑出真实滚动条 */}
          <div style={{ height: totalHeight, position: "relative" }}>
            {/* 可视窗口：绝对定位 + translateY 偏移，只渲染 visibleItems */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                transform: `translateY(${offsetY}px)`,
              }}
            >
              {visibleItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    height: itemHeight,
                    display: "flex",
                    alignItems: "center",
                    paddingInline: 12,
                    boxSizing: "border-box",
                    background: item.id % 2 === 0 ? "#fafafa" : "#fff",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  {item.text}
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </Flex>
  );
}
