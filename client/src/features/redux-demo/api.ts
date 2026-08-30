import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { DEMO_TOKEN } from '@/lib/api'

// 与 server 端 ResponseInterceptor 的统一响应体对齐
interface ApiResponse<T> {
  code: number
  data: T
  message: string
  trace_id: string
}

interface Post {
  id: number
  title: string
  content: string
  createdAt: string
}

// RTK Query：把「服务端状态」交给 Redux 管理，自动缓存 + 失效 + loading/error
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers) => {
      headers.set('Authorization', `Bearer ${DEMO_TOKEN}`)
      return headers
    },
  }),
  tagTypes: ['Post'],
  endpoints: (builder) => ({
    getPosts: builder.query<Post[], void>({
      query: () => '/posts',
      providesTags: ['Post'], // 声明提供 Post 标签，方便失效
      // server 返回 { code, data, message, trace_id }，这里用 transformResponse 解包 data
      transformResponse: (response: ApiResponse<Post[]>) => response.data,
    }),
    getPost: builder.query<Post, number>({
      query: (id) => `/posts/${id}`,
      transformResponse: (response: ApiResponse<Post>) => response.data,
    }),
  }),
})

export const { useGetPostsQuery, useGetPostQuery } = api
