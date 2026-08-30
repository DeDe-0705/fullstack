import { QueryInput } from "./components/Input.tsx";
import { Tabs } from "antd";
import type { Input, TabsProps } from "antd";
import type { GetProps } from "antd";
import { useCallback } from "react";
import { QueryList } from "./components/List.tsx";

type SearchProps = GetProps<typeof Input.Search>;

export function UGC() {
  const items: TabsProps["items"] = [
    {
      key: "1",
      label: "美食",
      children: <QueryList type="美食" />,
    },
    {
      key: "2",
      label: "旅游",
      children: <QueryList type="旅游" />,
    },
    {
      key: "3",
      label: "健身",
      children: <QueryList type="健身" />,
    },
  ];

  const onSearch: SearchProps["onSearch"] = useCallback((value) => {
    // TODO: implement search
    console.log(value, 123123);
  }, []);

  return (
    <div className="h-[calc(100vh-80px)] overflow-hidden flex flex-col items-stretch">
      <QueryInput onSearch={onSearch} />
      <Tabs className="flex-1" items={items} size="large" centered />
    </div>
  );
}
