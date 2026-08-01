import { Button, Descriptions, Result, Tag } from 'antd'
import { useNavigate, useParams } from 'react-router-dom'
import { getSubApp } from '../config/subApps'
import WujieContainer from '../micro/WujieContainer'

export default function MicroAppContainer() {
  const { name } = useParams()
  const navigate = useNavigate()
  const app = getSubApp(name)

  if (!app) {
    return (
      <Result
        status="404"
        title="子应用未注册"
        subTitle={`没有在 subApps 注册表中找到 name=${name ?? '-'} 的子应用`}
        extra={
          <Button type="primary" onClick={() => navigate('/')}>
            回总览
          </Button>
        }
      />
    )
  }

  if (app.status === 'ready' && app.url) {
    return <WujieContainer key={app.name} app={app} />
  }

  return (
    <Result
      status="info"
      title={`${app.title} 占位容器`}
      subTitle="该子应用仍是占位注册；status=ready 且配置 url 的子应用会直接渲染 WujieReact。"
      extra={
        <div className="mx-auto max-w-3xl text-left">
          <Descriptions
            bordered
            column={1}
            size="small"
            items={[
              { key: 'name', label: 'name', children: app.name },
              { key: 'path', label: 'host path', children: app.path },
              { key: 'url', label: '子应用入口', children: app.url || '未配置（VITE_SUB_*）' },
              {
                key: 'roles',
                label: '菜单权限',
                children: app.roles.map((role) => (
                  <Tag key={role} color="blue">
                    {role}
                  </Tag>
                )),
              },
              {
                key: 'flags',
                label: 'preload / alive',
                children: `${app.preload ? 'preload' : 'no-preload'} / ${app.alive ? 'alive' : 'no-alive'}`,
              },
              { key: 'desc', label: '说明', children: app.description },
            ]}
          />
          <Button className="mt-4" type="primary" onClick={() => navigate('/')}>
            回总览
          </Button>
        </div>
      }
    />
  )
}
