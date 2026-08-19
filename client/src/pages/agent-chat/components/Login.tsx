import { getUserByName, createUser } from "@/lib/agent";
import { useAgentStore } from "@/stores/agent";
import { useMutation } from "@tanstack/react-query";
import { Flex, Card, Typography, Form, Input, Alert, Button } from "antd";

function isNotFound(error: unknown): boolean {
  return (error as { status?: number } | undefined)?.status === 404;
}

export function LoginComponent() {
  const { setSession } = useAgentStore();
  // 登录/注册：先按用户名查询，404 再走注册，避免把网络错误误判成"用户不存在"
  const loginMutation = useMutation({
    mutationFn: async (name: string) => {
      try {
        return await getUserByName(name);
      } catch (error) {
        if (isNotFound(error)) return createUser(name);
        throw error;
      }
    },
    onSuccess: (user) => setSession(user.id, user.name),
  });

  function handleLogin(values: { name: string }) {
    if (!loginMutation.isPending) loginMutation.mutate(values.name);
  }

  return (
    <Flex justify="center" align="center" style={{ minHeight: "60vh" }}>
      <Card style={{ width: 360 }}>
        <Typography.Title level={4}>登录 / 注册</Typography.Title>
        <Typography.Paragraph type="secondary">
          输入用户名，已注册则直接进入，未注册则自动创建
        </Typography.Paragraph>
        <Form onFinish={handleLogin} layout="vertical" requiredMark={false}>
          <Form.Item
            name="name"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input placeholder="用户名" maxLength={64} />
          </Form.Item>
          {loginMutation.isError && (
            <Alert
              type="error"
              showIcon
              message={
                loginMutation.error instanceof Error
                  ? loginMutation.error.message
                  : "登录失败"
              }
              style={{ marginBottom: 16 }}
            />
          )}
          <Button
            type="primary"
            htmlType="submit"
            loading={loginMutation.isPending}
            block
          >
            进入
          </Button>
        </Form>
      </Card>
    </Flex>
  );
}
