import {
  Button,
  Card,
  Empty,
  InputNumber,
  Space,
  Table,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { Link } from "react-router-dom";
import { useCartStore } from "./cartStore";
import { useCartLines } from "./useCartLines";
import type { CartLine } from "./useCartLines";

export function CartPage() {
  const lines = useCartLines();
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);

  const columns: ColumnsType<CartLine> = [
    { title: "商品", dataIndex: "name" },
    { title: "单价", dataIndex: "price", render: (v: number) => `¥${v}` },
    {
      title: "数量",
      dataIndex: "quantity",
      render: (v: number, row) => (
        <InputNumber
          min={1}
          value={v}
          onChange={(next) => updateQuantity(row.productId, next ?? 1)}
        />
      ),
    },
    { title: "小计", dataIndex: "subtotal", render: (v: number) => `¥${v}` },
    {
      title: "操作",
      render: (_, row) => (
        <Button danger type="link" onClick={() => removeItem(row.productId)}>
          删除
        </Button>
      ),
    },
  ];

  return (
    <Card title="购物车（Zustand 客户端状态，持久化）">
      {lines.length === 0 ? (
        <Empty description="购物车还是空的，去列表页逛逛吧" />
      ) : (
        <>
          <Table<CartLine>
            rowKey="productId"
            columns={columns}
            dataSource={lines}
            pagination={false}
            size="small"
          />
          <Space
            style={{
              marginTop: 16,
              width: "100%",
              justifyContent: "space-between",
            }}
          >
            <Typography.Title level={5}>合计：¥{total}</Typography.Title>
            <Link to="/shop/checkout">
              <Button type="primary">去结算</Button>
            </Link>
          </Space>
        </>
      )}
    </Card>
  );
}
