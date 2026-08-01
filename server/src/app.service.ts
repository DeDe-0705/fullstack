import { Injectable, NotFoundException } from '@nestjs/common';

export interface Post {
  id: number;
  title: string;
  content: string;
  createdAt: string;
}

// 模拟网络延迟，便于前端观察 loading / isFetching 状态
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

@Injectable()
export class AppService {
  private posts: Post[] = [
    {
      id: 1,
      title: '为什么需要 TanStack Query',
      content:
        '服务端数据（来自 API 的数据）有缓存、过期、去重、重试等需求，手写 useEffect + useState 很容易遗漏。TanStack Query 把这类"服务端状态"统一管理起来。',
      createdAt: '2026-07-18T08:00:00.000Z',
    },
    {
      id: 2,
      title: '服务端状态 vs 客户端状态',
      content:
        'Zustand 管客户端状态（主题、弹窗、表单草稿等本地 UI 状态），TanStack Query 管服务端状态（接口数据），两者分工明确，互不替代。',
      createdAt: '2026-07-19T08:00:00.000Z',
    },
    {
      id: 3,
      title: 'React Router loader 预取数据',
      content:
        '通过 loader + queryClient.ensureQueryData，可以在路由跳转的同时预取数据，组件渲染时缓存已就绪，避免瀑布式请求。',
      createdAt: '2026-07-20T08:00:00.000Z',
    },
  ];
  private nextId = 4;

  getHealth() {
    return { status: 'ok' };
  }

  async getPosts(): Promise<Post[]> {
    await sleep(400);
    return [...this.posts].reverse(); // 新帖子排在前面
  }

  async getPost(id: number): Promise<Post> {
    await sleep(200);
    const post = this.posts.find((p) => p.id === id);
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    return post;
  }

  async createPost(dto: { title: string; content: string }): Promise<Post> {
    await sleep(400);
    const post: Post = {
      id: this.nextId++,
      title: dto.title,
      content: dto.content,
      createdAt: new Date().toISOString(),
    };
    this.posts.push(post);
    return post;
  }
}
