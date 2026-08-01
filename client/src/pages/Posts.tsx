import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createPost, postListOptions } from '../lib/posts'

export function Posts() {
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  // useQuery 的常用状态：isPending(首次加载) / isFetching(任何请求中，含后台刷新) / isError
  const { data: posts, isPending, isError, error, isFetching } =
    useQuery(postListOptions)

  const mutation = useMutation({
    mutationFn: createPost,
    onSuccess: () => {
      // 写入成功后让列表缓存失效，自动触发重新拉取（面试高频：invalidateQueries）
      queryClient.invalidateQueries({ queryKey: ['posts', 'list'] })
      setTitle('')
      setContent('')
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    mutation.mutate({ title, content })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">帖子列表</h1>
        {/* isFetching：缓存仍可用但后台正在刷新，可给用户一个轻提示 */}
        {isFetching && (
          <span className="text-xs text-gray-400">后台刷新中...</span>
        )}
      </div>

      {/* useMutation 示例：新增帖子 */}
      <form
        onSubmit={handleSubmit}
        className="p-4 bg-white rounded-lg border border-gray-200 space-y-3"
      >
        <p className="text-sm text-gray-500">useMutation 示例：新增帖子</p>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="标题"
          className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="内容"
          rows={3}
          className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          disabled={mutation.isPending}
          className="px-4 py-2 text-sm font-medium rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          {mutation.isPending ? '提交中...' : '发布'}
        </button>
        {mutation.isError && (
          <p className="text-sm text-red-600">发布失败：{mutation.error.message}</p>
        )}
      </form>

      {/* 列表：isPending / isError / 成功 三态 */}
      {isPending ? (
        <p className="text-gray-500">加载中...</p>
      ) : isError ? (
        <p className="text-red-600">加载失败：{error.message}</p>
      ) : (
        <ul className="space-y-3">
          {posts.map((post) => (
            <li key={post.id}>
              <Link
                to={`/posts/${post.id}`}
                className="block p-4 bg-white rounded-lg border border-gray-200 hover:border-indigo-300 transition-colors"
              >
                <p className="font-semibold text-gray-900">{post.title}</p>
                <p className="mt-1 text-sm text-gray-500 line-clamp-2">
                  {post.content}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(post.createdAt).toLocaleString()}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
