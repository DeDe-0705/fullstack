import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { postDetailOptions } from '../lib/posts'

export function PostDetail() {
  const { id } = useParams<{ id: string }>()
  // 路由 loader 已经预取了同一份 queryKey 的数据，这里直接命中缓存，通常不会看到 loading
  const { data: post, isPending, isError, error } = useQuery(
    postDetailOptions(Number(id)),
  )

  return (
    <div className="space-y-6">
      <Link to="/posts" className="text-sm text-indigo-600 hover:underline">
        ← 返回列表
      </Link>

      {isPending ? (
        <p className="text-gray-500">加载中...</p>
      ) : isError ? (
        <p className="text-red-600">加载失败：{error.message}</p>
      ) : (
        <article className="p-6 bg-white rounded-lg border border-gray-200 space-y-4">
          <h1 className="text-2xl font-bold text-gray-900">{post.title}</h1>
          <p className="text-xs text-gray-400">
            {new Date(post.createdAt).toLocaleString()}
          </p>
          <p className="text-gray-700 leading-relaxed">{post.content}</p>
        </article>
      )}
    </div>
  )
}
