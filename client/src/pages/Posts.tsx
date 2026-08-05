import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  App,
  Button,
  Card,
  Flex,
  Form,
  Input,
  List,
  Typography,
} from 'antd'
import { useNavigate } from 'react-router-dom'
import { createPost, postListOptions } from '../lib/posts'

export function Posts() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [form] = Form.useForm()

  // useQuery 的常用状态：isPending(首次加载) / isFetching(任何请求中，含后台刷新) / isError
  const { data: posts, isPending, isError, error, isFetching } =
    useQuery(postListOptions)

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      // 写入成功后让列表缓存失效，自动触发重新拉取（面试高频：invalidateQueries）
      queryClient.invalidateQueries({ queryKey: ['posts', 'list'] })
      message.success('发布成功')
      form.resetFields()
    },
    onError: (err) => message.error(`发布失败：${err.message}`),
  })

  return (
    <Flex vertical gap={24}>
      <Flex justify="space-between" align="center">
        <Typography.Title level={3} style={{ margin: 0 }}>
          帖子列表
        </Typography.Title>
        {/* isFetching：缓存仍可用但后台正在刷新，可给用户一个轻提示 */}
        {isFetching && (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            后台刷新中...
          </Typography.Text>
        )}
      </Flex>

      {/* useMutation 示例：新增帖子 */}
      <Card title="useMutation 示例：新增帖子">
        <Form
          form={form}
          layout="vertical"
          onFinish={(values: { title: string; content?: string }) =>
            mutation.mutate({ title: values.title, content: values.content ?? '' })
          }
        >
          <Form.Item
            name="title"
            label="标题"
            rules={[{ required: true, message: '请输入标题' }]}
          >
            <Input placeholder="标题" />
          </Form.Item>
          <Form.Item name="content" label="内容">
            <Input.TextArea placeholder="内容" rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={mutation.isPending}>
            发布
          </Button>
        </Form>
      </Card>

      {isError ? (
        <Alert type="error" message={`加载失败：${error.message}`} />
      ) : (
        <List
          loading={isPending}
          dataSource={posts ?? []}
          renderItem={(post) => (
            <List.Item>
              <Card
                hoverable
                style={{ width: '100%' }}
                onClick={() => navigate(`/posts/${post.id}`)}
              >
                <Typography.Title level={5} style={{ marginTop: 0 }}>
                  {post.title}
                </Typography.Title>
                <Typography.Paragraph type="secondary" ellipsis={{ rows: 2 }}>
                  {post.content}
                </Typography.Paragraph>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {new Date(post.createdAt).toLocaleString()}
                </Typography.Text>
              </Card>
            </List.Item>
          )}
        />
      )}
    </Flex>
  )
}
