# 前端面试知识体系

> 面向高级前端岗位的系统化面试准备，基于王德师（德德）的技术栈和项目经验定制。

---

## 一、基础理论

- [浏览器原理](./浏览器原理.md) — 渲染流程、回流重绘、Event Loop、GC、进程线程
- [网络与HTTP](./网络与HTTP.md) — HTTP版本对比、HTTPS/TLS、缓存策略、CORS、安全
- [浏览器存储与缓存](./浏览器存储与缓存.md) — Cookie/localStorage/sessionStorage/IndexedDB、缓存层级、选型
- [迭代器与生成器](./迭代器与生成器.md) — 迭代器协议、Generator、yield双向通信
- [Promise与异步](./Promise与异步.md) — 状态机、链式调用、手写Promise、async/await

## 二、框架原理

- [Vue3 深度原理](./Vue3深度原理.md) — 响应式系统(Proxy)、虚拟DOM diff、Compiler优化、Composition API、调度机制
- [React 核心机制](./React核心机制.md) — Fiber架构、Hooks原理、并发模式、Virtual DOM reconciliation、与Vue对比

## 三、工程与性能

- [前端工程化](./前端工程化.md) — Webpack/Vite原理、HMR、TreeShaking、CI/CD、组件库建设、Monorepo
- [前端工程化-组件库实战](./前端工程化-组件库实战.md) — ui-kit 实操：组件库打包、git tag、CI/CD、npm 发布全链路（2026-08）
- [性能优化体系](./性能优化体系.md) — 网络/构建/渲染/运行时四层优化、Core Web Vitals、虚拟列表

## 四、进阶专题

- [微前端专题](./微前端专题.md) — 概念与价值、qiankun/无界/Micro-app/Module Federation对比、无界实战、通信/鉴权/路由方案
- [算法基础](./算法基础.md) — 排序(快排/归并)、树遍历、链表操作、动态规划入门、经典场景题
- [手写代码](./手写代码.md) — 防抖节流、深拷贝、Promise.all/并发控制、LRU、bind/call/apply、虚拟列表、柯里化、继承

## 五、项目与面试

- [项目复盘与面试话术](./项目复盘与面试话术.md) — Li People/理想同事/组织信息管理/出入预约 四大项目STAR话术、系统设计题

---

## 交互式 Demo（浏览器打开即可运行）

### 基础 Demo
- [Event Loop 可视化](./event-loop-demo.html) — 逐步看调用栈、微任务、宏任务
- [Promise 执行流程](./promise-demo.html) — Promise 状态变化 + 队列切换
- [Generator 执行流程](./generator-demo.html) — yield 暂停和 next() 恢复
- [HTTP 缓存决策流程](./http-cache-demo.html) — 强缓存/协商缓存判断链路
- [浏览器存储对比](./storage-demo.html) — 直接操作 Cookie/localStorage/sessionStorage/IndexedDB
- [浏览器渲染流程](./render-demo.html) — 6阶段渲染管线交互图

---

## 推荐学习路线

```
第1周：基础理论复习（浏览器原理 → 网络与HTTP → 存储与缓存 → 异步/Promise）
第2周：框架原理深挖（Vue3 深度原理 → React 核心机制）
第3周：工程与性能（工程化 → 性能优化 → 微前端专题）
第4周：手写 + 算法（手写代码每天2题 → 算法基础刷题）
第5周：项目复盘 + 模拟面试（四大项目STAR话术 → 系统设计 → 查漏补缺）
```
