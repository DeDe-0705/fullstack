import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Col, Row, Segmented, Spin, Tag, Typography } from 'antd'
import { Link, useSearchParams } from 'react-router-dom'
import { useCartStore } from './cartStore'
import { MOCK_PRODUCTS } from './mockApi'
import { productListOptions } from './queries'

const CATEGORIES = ['全部', ...Array.from(new Set(MOCK_PRODUCTS.map((p) => p.category)))]

export function ProductList() {
  // 筛选条件放进 URL searchParams，而不是 useState：
  // 这样「筛选状态」可分享、可回退、可刷新保持，符合 React Router 的 URL 即状态理念
  const [searchParams, setSearchParams] = useSearchParams()
  const category = searchParams.get('category') ?? undefined

  // TanStack Query 负责商品数据的加载/缓存/失败重试。
  // 切分类时 queryKey 变化触发新请求；切回旧分类时直接命中缓存（staleTime 内不发请求）
  const { data, isPending, isError, error, refetch } = useQuery(productListOptions(category))
  const addItem = useCartStore((s) => s.addItem)

  return (
    <div>
      <Typography.Title level={4}>商品列表（TanStack Query + Router searchParams）</Typography.Title>
      <Segmented
        value={category ?? '全部'}
        options={CATEGORIES}
        onChange={(value) => {
          const next: Record<string, string> =
            value === '全部' ? {} : { category: String(value) }
          setSearchParams(next)
        }}
        style={{ marginBottom: 16 }}
      />

      {isPending && <Spin tip="加载中..." />}
      {isError && (
        <Alert
          type="error"
          message="加载失败"
          description={(error as Error).message}
          action={<Button onClick={() => refetch()}>重试</Button>}
        />
      )}

      {data && (
        <Row gutter={[16, 16]}>
          {data.map((product) => (
            <Col key={product.id} xs={24} sm={12} md={8} lg={6}>
              <Card
                title={product.name}
                extra={<Tag color="blue">{product.category}</Tag>}
                actions={[
                  <Link key="detail" to={`/shop/product/${product.id}`}>详情</Link>,
                  <Button key="add" type="link" onClick={() => addItem(product.id)}>
                    加入购物车
                  </Button>,
                ]}
              >
                <Typography.Text type="danger" strong>¥{product.price}</Typography.Text>
                <div style={{ color: '#888', fontSize: 13 }}>
                  库存 {product.stock} · {product.description}
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}
    </div>
  )
}
