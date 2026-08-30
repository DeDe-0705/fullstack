import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface FormData {
  name: string
  email: string
  address: string
  city: string
}

const initialData: FormData = {
  name: '',
  email: '',
  address: '',
  city: '',
}

interface FormState {
  data: FormData
  updateField: <K extends keyof FormData>(field: K, value: FormData[K]) => void
  reset: () => void
}

// 为什么表单数据用 Zustand + persist？
// 多步骤表单的数据要「跨步骤共享」+「刷新不丢」，属于客户端状态；
// persist 自动同步到 localStorage，回退/刷新都能恢复。
export const useFormStore = create<FormState>()(
  persist(
    (set) => ({
      data: initialData,
      updateField: (field, value) =>
        set((state) => ({ data: { ...state.data, [field]: value } })),
      reset: () => set({ data: initialData }),
    }),
    { name: 'multi-step-form' },
  ),
)
