import { Alert, Button, Card, Input, Space, Switch, Typography } from "antd";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "./cartStore";
import { setShouldFailNextOrder } from "./mockApi";
import { resetOrderStatus, submitOrderThunk } from "./orderSlice";
import { useShopDispatch, useShopSelector, shopStore } from "./store";
import { useCartLines } from "./useCartLines";

export function CheckoutPage() {
  const lines = useCartLines();
  const clear = useCartStore((s) => s.clear);
  const navigate = useNavigate();
  const dispatch = useShopDispatch();
  // 只订阅需要用到的切片，避免整棵树重渲染
  const orderStatus = useShopSelector((s) => s.orders.status);
  const orderError = useShopSelector((s) => s.orders.error);
  const currentOrder = useShopSelector((s) => s.orders.currentOrder);

  console.log("CheckoutPage render", shopStore.getState().orders);

  // 地址是「仅本组件关心的临时表单状态」，用 useState 即可，不放进全局 store
  const [address, setAddress] = useState("北京市朝阳区");
  const [failNext, setFailNext] = useState(false);
  const total = lines.reduce((sum, l) => sum + l.subtotal, 0);

  const submit = async () => {
    // 下单流程交给 Redux：pending / fulfilled / rejected 三种状态自动流转。
    // unwrap() 把 fulfilled 结果「解包」出来；失败会 throw，这里 catch 掉让页面由 Redux 状态渲染
    setShouldFailNextOrder(failNext);
    try {
      await dispatch(
        submitOrderThunk({ items: lines, totalPrice: total, address }),
      ).unwrap();
      clear();
    } catch {
      // rejected 分支由 extraReducers 写入 state.error，页面据此渲染，无需在此处理
    }
  };

  if (orderStatus === "success" && currentOrder) {
    return (
      <Card title="下单成功（Redux fulfilled 状态）">
        <Alert type="success" message={`订单号：${currentOrder.id}`} showIcon />
        <div style={{ marginTop: 16 }}>
          <Typography.Text>地址：{currentOrder.address}</Typography.Text>
          <br />
          <Typography.Text strong>
            实付：¥{currentOrder.totalPrice}
          </Typography.Text>
        </div>
        <Button
          style={{ marginTop: 16 }}
          onClick={() => {
            dispatch(resetOrderStatus());
            navigate("/shop");
          }}
        >
          继续购物
        </Button>
      </Card>
    );
  }

  return (
    <Card title="结算下单（Redux Toolkit 状态机）">
      <Space direction="vertical" style={{ width: "100%" }}>
        {lines.map((l) => (
          <div key={l.productId}>
            {l.name} × {l.quantity} = ¥{l.subtotal}
          </div>
        ))}
        <Typography.Title level={5}>合计：¥{total}</Typography.Title>
        <Input.TextArea
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          rows={2}
          placeholder="收货地址"
        />
        <Space>
          <span>模拟下单失败（观察 rejected 分支）</span>
          <Switch checked={failNext} onChange={setFailNext} />
        </Space>
        {orderStatus === "failed" && (
          <Alert type="error" message={orderError} showIcon />
        )}
        <Button
          type="primary"
          loading={orderStatus === "processing"}
          disabled={lines.length === 0}
          onClick={submit}
        >
          {orderStatus === "processing" ? "提交中..." : "提交订单"}
        </Button>
      </Space>
    </Card>
  );
}
