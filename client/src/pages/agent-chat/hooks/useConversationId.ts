import { useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";


export function useConversationId() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const conversationId = id ?? undefined

  // 写入：导航到新 id，默认 push，追加历史记录，浏览器后退可回退
  const setConversationId = useCallback(
    (newId?: string) => {
      if (newId === undefined) {
        navigate('/agent')          // 清空时回到无参路由
      } else {
        navigate(`/agent/${newId}`) // push 追加历史
      }
    },
    [navigate],
  )

  return [conversationId, setConversationId] as const
}