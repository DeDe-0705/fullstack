import { Button, Card, Input, Result, Steps, Typography } from 'antd'
import { useState } from 'react'
import { useFormStore } from './formStore'

const STEP_ITEMS = ['基本信息', '地址信息', '确认提交']

export function MultiStepForm() {
  // 当前步骤是「UI 状态」，放组件内 useState，不进全局 store
  const [current, setCurrent] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const data = useFormStore((s) => s.data)
  const reset = useFormStore((s) => s.reset)

  // 每步的必填校验：通过才允许下一步
  const canNext = (step: number) => {
    if (step === 0) return data.name.trim() !== '' && data.email.trim() !== ''
    if (step === 1) return data.address.trim() !== '' && data.city.trim() !== ''
    return true
  }

  const handleNext = () => {
    if (canNext(current)) setCurrent((c) => c + 1)
  }

  const handleSubmit = () => {
    setSubmitted(true)
    reset() // 提交后清空，回到初始状态
  }

  if (submitted) {
    return (
      <Card>
        <Result
          status="success"
          title="提交成功"
          subTitle="多步骤表单演示完成，数据已提交"
          extra={
            <Button
              type="primary"
              onClick={() => {
                setSubmitted(false)
                setCurrent(0)
              }}
            >
              再来一次
            </Button>
          }
        />
      </Card>
    )
  }

  return (
    <Card title="多步骤表单（Zustand + persist + 步骤状态机）">
      <Steps
        current={current}
        items={STEP_ITEMS.map((title) => ({ title }))}
        style={{ marginBottom: 24 }}
      />

      {current === 0 && <BasicInfoStep />}
      {current === 1 && <AddressStep />}
      {current === 2 && <ReviewStep />}

      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={current === 0} onClick={() => setCurrent((c) => c - 1)}>
          上一步
        </Button>
        {current < 2 ? (
          <Button type="primary" disabled={!canNext(current)} onClick={handleNext}>
            下一步
          </Button>
        ) : (
          <Button type="primary" onClick={handleSubmit}>
            提交
          </Button>
        )}
      </div>
    </Card>
  )
}

// 第 1 步：基本信息
function BasicInfoStep() {
  const data = useFormStore((s) => s.data)
  const updateField = useFormStore((s) => s.updateField)

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 360 }}>
      <Field label="姓名">
        <Input
          value={data.name}
          placeholder="请输入姓名"
          onChange={(e) => updateField('name', e.target.value)}
        />
      </Field>
      <Field label="邮箱">
        <Input
          value={data.email}
          placeholder="请输入邮箱"
          onChange={(e) => updateField('email', e.target.value)}
        />
      </Field>
    </div>
  )
}

// 第 2 步：地址信息
function AddressStep() {
  const data = useFormStore((s) => s.data)
  const updateField = useFormStore((s) => s.updateField)

  return (
    <div style={{ display: 'grid', gap: 16, maxWidth: 360 }}>
      <Field label="地址">
        <Input
          value={data.address}
          placeholder="请输入地址"
          onChange={(e) => updateField('address', e.target.value)}
        />
      </Field>
      <Field label="城市">
        <Input
          value={data.city}
          placeholder="请输入城市"
          onChange={(e) => updateField('city', e.target.value)}
        />
      </Field>
    </div>
  )
}

// 第 3 步：确认提交（只读展示，数据来自 store）
function ReviewStep() {
  const data = useFormStore((s) => s.data)

  return (
    <div style={{ maxWidth: 360 }}>
      <Typography.Paragraph>
        <Typography.Text strong>姓名：</Typography.Text>
        {data.name}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <Typography.Text strong>邮箱：</Typography.Text>
        {data.email}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <Typography.Text strong>地址：</Typography.Text>
        {data.address}
      </Typography.Paragraph>
      <Typography.Paragraph>
        <Typography.Text strong>城市：</Typography.Text>
        {data.city}
      </Typography.Paragraph>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <Typography.Text>{label}</Typography.Text>
      {children}
    </label>
  )
}
