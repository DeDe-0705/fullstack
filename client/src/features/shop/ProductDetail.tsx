import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Spin, Tag } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { useCartStore } from './cartStore'
import { productDetailOptions } from './queries'

export function ProductDetail() {
  const { id } = useParams()
  const productId = Number(id)
  // 详情数据同样走 TanStack Query，key 精确到 id。
  // 由于路由 loader 已预取，这里大概率直接命中缓存，几乎看不到 loading
  const { data, isPending, isError, error } = useQuery(productDetailOptions(productId))
  const addItem = useCartStore((s) => s.addItem)

  if (isPending) return <Spin tip="加载中..." />
  if (isError) return <Alert type="error" message={(error as Error).message} />

  return (
    <div>
      <Descriptions
        title="商品详情（Router 动态参数 + Query 预取）"
        bordered
        column={1}
        style={{ maxWidth: 600 }}
      >
        <Descriptions.Item label="名称">{data.name}</Descriptions.Item>
        <Descriptions.Item label="分类">
          <Tag color="blue">{data.category}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="价格">¥{data.price}</Descriptions.Item>
        <Descriptions.Item label="库存">{data.stock}</Descriptions.Item>
        <Descriptions.Item label="描述">{data.description}</Descriptions.Item>
      </Descriptions>
      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <Button type="primary" onClick={() => addItem(data.id)}>加入购物车</Button>
        <Link to="/shop"><Button>返回列表</Button></Link>
      </div>
    </div>
  )
}
