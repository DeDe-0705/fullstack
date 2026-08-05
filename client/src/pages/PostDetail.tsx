import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Card, Flex, Spin, Typography } from 'antd'
import { postDetailOptions } from '../lib/posts'

export function PostDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  // 路由 loader 已经预取了同一份 queryKey 的数据，这里直接命中缓存，通常不会看到 loading
  const { data: post, isPending, isError, error } = useQuery(
    postDetailOptions(Number(id)),
  )

  return (
    <Flex vertical gap={16}>
      <Button
        type="link"
        style={{ padding: 0, width: 'fit-content' }}
        onClick={() => navigate('/posts')}
      >
        ← 返回列表
      </Button>

      {isPending ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : isError ? (
        <Alert type="error" message={`加载失败：${error.message}`} />
      ) : (
        <Card>
          <Typography.Title level={2}>{post.title}</Typography.Title>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {new Date(post.createdAt).toLocaleString()}
          </Typography.Text>
          <Typography.Paragraph style={{ marginTop: 16 }}>
            {post.content}
          </Typography.Paragraph>
        </Card>
      )}
    </Flex>
  )
}
