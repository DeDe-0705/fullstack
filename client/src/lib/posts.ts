import { queryOptions } from '@tanstack/react-query'
import { api } from './api'

export interface Post {
  id: number
  title: string
  content: string
  createdAt: string
}

// queryOptions：让 queryKey/queryFn 在 useQuery 和 loader 预取之间共享同一份定义，类型自动推导
export const postListOptions = queryOptions({
  queryKey: ['posts', 'list'],
  queryFn: () => api.get<Post[]>('/posts'),
})

export const postDetailOptions = (id: number) =>
  queryOptions({
    queryKey: ['posts', 'detail', id],
    queryFn: () => api.get<Post>(`/posts/${id}`),
  })

export const createPost = (input: { title: string; content: string }) =>
  api.post<Post>('/posts', input)
