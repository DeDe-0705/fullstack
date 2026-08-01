 # 网络与 HTTP

 ## 一、HTTP 各版本对比

 | 特性 | HTTP/1.0 | HTTP/1.1 | HTTP/2 | HTTP/3 |
 |------|----------|----------|--------|--------|
 | 连接 | 短连接 | 持久连接(Keep-Alive) | 单连接多路复用 | QUIC(UDP) |
 | 队头阻塞 | 严重 | 有 | 解决HTTP层 | 彻底解决 |
 | 头部压缩 | 无 | 无 | HPACK | QPACK |
 | 服务器推送 | 无 | 无 | 支持 | 支持 |
 | 握手 | TCP+TLS | TCP+TLS | TCP+TLS | QUIC(0-RTT) |

 **HTTP/1.1 队头阻塞：** 一个TCP连接上，上个请求没响应完下个必须等。浏览器开6个并发连接缓解。

 **HTTP/2 多路复用：** 一个TCP连接上帧级别交错传输多个Stream，HTTP层无阻塞。但TCP层丢包仍导致整个连接阻塞。

 **HTTP/3 革命：** QUIC(UDP)丢包只影响对应Stream；0-RTT握手；连接迁移（换网络无需重新握手）。

### 1.1 HTTP/2 头部压缩 — HPACK 原理

**为什么不能直接用 gzip 压缩 Header？**

两个原因：
1. gzip 需要完整连续的上下文才能解压，而 HTTP/2 的多个 Stream 是帧级别交替传输的，无法连续解压
2. gzip 压缩过的 Header 存在 CRIME 攻击风险（攻击者通过反复注入数据观察压缩比变化来窃取 Cookie）

**HPACK 怎么做的？—— 字典表 + 索引号**

```
客户端和服务端各自维护一张"字典表"（静态表 + 动态表）。

静态表：内置了 61 个常见 Header 的索引（如 :method: GET = 索引 2）
动态表：通信过程中新出现的 Header，双方各自加入自己的表

第一次请求：
  客户端 → 服务端：
    index=2  (:method: GET)
    index=5  (:path: /api/users)
    index=62 (:authority: example.com)
    Literal: "authorization: Bearer eyJhbG..."（新字段，完整传，加入动态表索引 63）

第二次请求（同一连接）：
  客户端 → 服务端：
    index=2, index=5, index=62, index=63
  全是索引号！Header 从几百字节变成几十字节。

类比：就像同事之间用代号交流——第一次说"理想汽车Li People门户"，以后说"Li People"就够了。
```

 ---

 ## 二、HTTPS 与 TLS 握手

 HTTPS = HTTP + TLS。TLS 1.2 握手机制(2-RTT)：
```
客户端 --ClientHello(加密套件)-->  服务端
      <--ServerHello+证书+公钥--
      --加密的对称密钥(公钥加密)-->   (此后对称加密通信)
```

### 2.1 TLS 握手详解（两段式设计）

```
第一段：用非对称加密安全协商"对称密钥"（慢但安全）
  1. 客户端 → 服务端：ClientHello（"我支持这些加密套件"）
  2. 服务端 → 客户端：ServerHello + 数字证书(含公钥)
  3. 客户端验证证书有效性（见下方 2.2）
  4. 客户端生成对称密钥 → 用服务端公钥加密 → 发送给服务端
  5. 服务端用私钥解密，拿到对称密钥

第二段：用对称密钥加密所有后续通信（快）
  → AES / ChaCha20 硬件级加密

为什么两段式？
  非对称加密(RSA/ECDSA)安全但太慢 → 只用来传钥匙
  对称加密(AES)块但钥匙没法安全传输 → 用非对称加密传钥匙
  各取所长 = HTTPS 的设计精髓
```

### 2.2 浏览器怎么验证证书？—— 四级关卡

```
关卡 1：证书链验证
  浏览器内置了受信任的根 CA 列表（DigiCert、Let's Encrypt 等）
  用根证书的公钥，逐级验证：根 CA → 中间 CA → 站点证书
  任何一级签名对不上 → 不安全

关卡 2：有效期检查
  证书的开始时间和结束时间，过期 → 不安全

关卡 3：域名匹配
  证书的 CN(Common Name) 或 SAN(Subject Alternative Name) 字段
  证书是 *.baidu.com，但你在访问 google.com → 不匹配 → 不安全

关卡 4：验证私钥持有
  服务端必须证明自己真的拥有与证书公钥配对的私钥
  用私钥签名一段握手数据 → 客户端用证书公钥验证 → 对不上 → 不安全
```

### 2.3 Charles/Fiddler 为什么能抓 HTTPS？

Charles 本质就是**中间人代理**，手法和攻击者一模一样：

```
正常流程：
  浏览器 ←—————— TLS ——————→ 目标服务器

Charles 代理后：
  浏览器 ←— TLS1 —→ Charles ←— TLS2 —→ 目标服务器
           (Charles用自己的       (Charles冒充浏览器
            证书冒充目标)          与真实服务器通信)

为什么浏览器不报警？
  因为你主动安装了 Charles 的根证书 → 浏览器信任了它
  → 证书链验证(关卡1)通过 → 不会提示"不安全"

这正好说明：HTTPS 的安全根基是"浏览器内置的根 CA 不可被篡改"。
一旦用户安装了非信任根证书，整条防线就开了后门。
```

### 2.4 TLS 1.3 改进

 ---

 ## 三、HTTP 缓存（面试重灾区）

 ### 强缓存（不发请求）

 | Header | 值 | 说明 |
 |--------|-----|------|
 | Expires | GMT时间 | HTTP/1.0，绝对时间 |
 | Cache-Control | max-age=3600 | 优先级更高，相对秒数 |

 常用指令：`max-age` / `no-cache`(每次验证) / `no-store`(不缓存) / `public`(代理可缓存) / `private` / `immutable`(永不变化)

 ### 协商缓存（发请求问服务器）

 | 请求头 | 响应头 | 方式 |
 |--------|--------|------|
 | If-None-Match | ETag | 内容哈希，精确 |
 | If-Modified-Since | Last-Modified | 修改时间，秒级精度 |

 ETag 优先于 Last-Modified。

```
GET /app.js  ->  200 OK + ETag: "abc123"
下次: GET /app.js + If-None-Match: "abc123"
  ->  304 Not Modified (无body，用缓存)
```

 ### 决策流程

```
请求 -> no-store? -> 直连服务器
     -> 强缓存未过期? -> 直接用(200 from cache)
     -> 有ETag/Last-Modified? -> 验证 -> 304? -> 用缓存
                                      -> 200? -> 用新内容
     -> 都没有? -> 直连服务器
```

 ### 实战配置

```
HTML:              Cache-Control: no-cache
CSS/JS(带哈希):     Cache-Control: max-age=31536000, immutable
图片:              Cache-Control: max-age=86400
```

 关键：文件名带哈希(app.a1b2c3.js)，内容变哈希变=新URL，完美利用强缓存。

 ---

 ## 四、跨域（CORS）

### 4.1 同源策略

 **同源策略：** 协议+域名+端口 三者相同。

### 4.2 简单请求 vs 非简单请求（决定是否发 OPTIONS 预检）

这是 CORS 最核心的判断规则——不是看"二级域名是否相同"，而是看请求本身是否"简单"：

**简单请求（不发 OPTIONS，直接发）：**
```
必须同时满足以下全部条件：
✅ 方法：GET / HEAD / POST
✅ 仅包含标准头：Accept、Accept-Language、Content-Language、Content-Type
✅ Content-Type 只能是以下三种之一：
    text/plain
    multipart/form-data
    application/x-www-form-urlencoded
✅ 没有 ReadableStream
```

**非简单请求（先发 OPTIONS 预检）：**
```
只要满足以下任意一条，就会触发预检：
❌ 方法：PUT / DELETE / PATCH
❌ 自定义请求头（Authorization、X-Requested-With 等）
❌ Content-Type: application/json  ← 开发中最常见触发预检的原因！
❌ 使用了 ReadableStream
❌ XMLHttpRequest 的 upload 事件监听器
```

```js
// 这是非简单请求 → 先发 OPTIONS
fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },  // ← 这一行触发预检
  body: JSON.stringify({ name: 'Alice' })
})

// 这是简单请求 → 不发 OPTIONS，直接发
fetch('https://api.example.com/data', {
  method: 'POST',
  headers: { 'Content-Type': 'text/plain' },
  body: 'name=Alice'
})
```

### 4.3 OPTIONS 预检缓存 — Access-Control-Max-Age

每个非简单请求都发一次 OPTIONS 太浪费了。服务端可以告诉浏览器"这个预检结果有效多久"：

```
第一次跨域请求：
  OPTIONS /api/data
  → 服务端响应头：
    Access-Control-Allow-Methods: POST, GET, PUT
    Access-Control-Allow-Headers: Content-Type, Authorization
    Access-Control-Max-Age: 86400        ← 缓存 86400 秒（24 小时）

之后 24 小时内，同 URL + 同方法的跨域请求：
  浏览器跳过 OPTIONS，直接发真实请求
```

**注意：** Chrome 最大缓存 7200 秒（2 小时），即使你设了 86400 也会被截断。Firefox 上限是 86400 秒。

### 4.4 带 Cookie 跨域

前端 `credentials: "include"` + 服务端 `Access-Control-Allow-Origin`(不能用*) + `Access-Control-Allow-Credentials: true`。

### 4.5 其他跨域方案

JSONP(仅GET) / devServer proxy / Nginx反向代理 / postMessage(iframe) / WebSocket

 ---

 ## 五、SSO 单点登录

 ### 5.1 什么是 SSO？

 SSO（Single Sign-On）：一次登录，多个系统共享登录态。
 典型场景：公司内部有 OA 系统、HR 系统、财务系统、代码仓库——
 不需要每个系统单独登录一次，登了 OA 就能直接进其他系统。

 ### 5.2 三种主流实现方式

 #### 方案一：共享 Cookie（同域）
```
前提：所有系统在同一父域下（*.example.com）

1. 用户登录 OA (oa.example.com)
2. 服务端设置 Cookie：Domain=.example.com
3. 用户访问 HR (hr.example.com)
4. 浏览器自动带上 .example.com 域的 Cookie
5. HR 系统校验 Cookie 有效 → 直接进入

✅ 最简单，零代码
❌ 仅限同父域
❌ Cookie 有 4KB 大小限制
```

 #### 方案二：JWT Token 透传（无状态，推荐）
```
1. 用户登录 OA → 服务端返回 JWT Token + 用户信息
2. 前端把 Token 存 localStorage
3. 用户点击跳转 HR 系统
4. OA 将 Token 通过 URL 参数或 postMessage 传给 HR
   https://hr.example.com?token=eyJhbGc...
5. HR 前端拿到 Token → 存 localStorage → 用 Token 调接口
6. HR 服务端验证 Token 有效性 → 返回数据

✅ 跨域 无状态 扩展性好
✅ 你 Li People 微前端的 props 注入本质上就是这个思路
```

 #### 方案三：CAS 中心认证（经典方案）
```
        ┌──────────────┐
        │   CAS Server  │  统一认证中心
        │  (sso.com)    │
        └──────┬───────┘
        ┌───────┴───────┐
   ┌────┴────┐    ┌────┴────┐
   │  OA系统  │    │  HR系统  │   业务系统
   └─────────┘    └─────────┘

流程：
1. 用户访问 OA → OA 检查无登录态 → 重定向到 sso.com/login
2. 用户在 sso.com 登录成功 → sso.com 生成 TGT(Ticket Granting Ticket)
3. sso.com 生成 ST(Service Ticket) → 重定向回 OA?ticket=ST-xxx
4. OA 后端拿 ST 去 sso.com 验证 → 验证通过 → 生成自己的 Session
5. 用户再去 HR → HR 检查无登录态 → 重定向到 sso.com
6. sso.com 发现已有 TGT（已登录） → 直接生成新 ST → 重定向回 HR
7. HR 验证 ST → 用户无感进入（未输入密码，第2次开始不再输入）

✅ 跨域、安全、成熟
❌ 依赖重定向，对 SPA 不友好
❌ CAS Server 是单点
```

 ### 5.3 微前端中的 SSO（结合你的项目）

```
你的 Li People 方案（无界 + Props 注入）：

主应用（门户）完成登录 → 拿到 Token
  ↓ 通过无界的 props 注入
子应用 A（人事）← 收到 token，直接调接口
子应用 B（组织）← 收到 token，直接调接口

优势：
- 用户只在主应用登录一次
- 子应用零登录逻辑，透明接入
- Token 刷新由主应用统一管理
- 切换子应用不需要重新鉴权
```

 **面试话术：** "在我们 Li People 微前端架构中，登录态由主应用统一管理。用户登录后主应用拿到 Token，通过无界的 Props 机制注入给各个子应用。子应用拿到 Token 后直接从 localStorage 读取并用在请求头里，不需要自己实现登录流程。Token 过期时主应用负责静默刷新，子应用无感。"

 ### 5.4 OAuth 2.0 / OIDC

 OAuth 2.0 是**授权**协议（我允许 A 应用访问我在 B 应用的数据），OIDC (OpenID Connect) 是在 OAuth 2.0 之上的**认证**层。

```
OAuth 2.0 四种授权模式：
1. 授权码模式 (Authorization Code) — 最安全，有后端
2. 隐式模式 (Implicit) — 纯前端，已不推荐
3. 密码模式 (Resource Owner Password) — 用户直接把密码给应用
4. 客户端凭证 (Client Credentials) — 机器间通信

前端常见是第1种：跳转到授权页 → 用户同意 → 回调带 code → 后端用 code 换 token
```

 ---

 ## 六、网络安全

 ### 6.1 CSP（内容安全策略）— 面试高频

 CSP 是一套**浏览器安全策略**，通过 HTTP 响应头告诉浏览器："只允许从这些来源加载资源，其他的全拦掉"。

 ```
 Content-Security-Policy: 
   default-src 'self';                    ← 默认只允许同源
   script-src 'self' 'nonce-abc123';      ← JS 只能同源或带特定 nonce
   style-src 'self' 'unsafe-inline';      ← 样式允许内联
   img-src 'self' https://cdn.example.com;← 图片允许同源 + CDN
   font-src 'self' data:;                 ← 字体允许同源 + data URI
   connect-src 'self' https://api.example.com; ← API 请求白名单
   frame-ancestors 'none';                ← 禁止被 iframe 嵌入（防点击劫持）
 ```

 **CSP 的核心价值：** 即使攻击者在页面上注入了 `<script>` 标签，只要不在白名单里，浏览器就直接拒绝执行。这是 XSS 的**最后防线**。

 ### 6.2 CSP 常用指令速查

 | 指令 | 控制内容 | 示例值 |
 |------|---------|--------|
 | `default-src` | 默认策略（兜底） | `'self'` |
 | `script-src` | JS 加载和执行 | `'self' 'nonce-xxx' 'strict-dynamic'` |
 | `style-src` | CSS 加载 | `'self' 'unsafe-inline'` |
 | `img-src` | 图片加载 | `'self' https://cdn.example.com` |
 | `font-src` | 字体加载 | `'self' data:` |
 | `connect-src` | fetch/XHR/WebSocket | `'self' https://api.example.com` |
 | `frame-src` | iframe 嵌套来源 | `'self'` |
 | `frame-ancestors` | 谁能嵌入我 | `'none'` |
 | `form-action` | 表单提交目标 | `'self'` |
 | `report-uri` | 违规上报地址 | `/csp-report` |

 ### 6.3 两种配置方式

 ```html
 <!-- 方式1：HTTP 响应头（推荐，覆盖面广） -->
 <!-- Nginx: add_header Content-Security-Policy "default-src 'self'"; -->

 <!-- 方式2：HTML meta 标签（不推荐，有些指令不支持） -->
 <meta http-equiv="Content-Security-Policy" 
       content="default-src 'self'; script-src 'self'">
 ```

 ### 6.4 Report-Only 模式

 ```
 上线前先跑 Report-Only 模式：
 Content-Security-Policy-Report-Only: default-src 'self'; report-uri /csp-report

 效果：不拦截违规行为，但把违规信息上报到 /csp-report。
      收集几周的数据，确认不会误杀正常功能后，再启用正式策略。
 ```

 ### 6.5 XSS（跨站脚本攻击）

 存储型/反射型/DOM型。**防御：**
- 输出转义（最重要）
- Cookie设 HttpOnly + Secure + SameSite
- CSP: `Content-Security-Policy: default-src 'self'`
- React/Vue 默认防XSS（自动转义）
- 不用 innerHTML / document.write / eval

 ### CSRF（跨站请求伪造）

 已登录A站 -> 访问恶意B站 -> B站偷偷向A站发请求（带Cookie）。

 **防御：** SameSite Cookie / CSRF Token / 验证 Referer/Origin / 二次验证

 ---

 ## 八、DNS 与 CDN

 ### 8.1 DNS 域名解析完整链路

 ```
 用户在浏览器输入 example.com
         │
   ┌─────▼─────┐  1. 浏览器 DNS 缓存（几十秒~几分钟）
   │ 浏览器缓存   │     命中 → 直接返回 IP，结束
   └─────┬─────┘
         │ 未命中
   ┌─────▼─────┐  2. 操作系统 DNS 缓存（hosts 文件 + 系统缓存）
   │  OS 缓存    │     命中 → 返回 IP
   └─────┬─────┘
         │ 未命中
   ┌─────▼─────┐  3. 路由器 DNS 缓存
   │  路由器缓存  │
   └─────┬─────┘
         │ 未命中
   ┌─────▼─────┐  4. ISP 的 DNS 服务器（运营商、114.114.114.114 等）
   │ ISP DNS    │     ← 这是递归查询：ISP 代你问遍全网
   │ 递归查询    │
   └─────┬─────┘
         │ ISP 也没有缓存
         ▼
    ISP 发起迭代查询：
    ┌───────┐    ┌──────────┐    ┌──────────┐
    │根DNS服务器│ → │ .com 顶级域 │ → │ example.com │ → 返回 IP: 1.2.3.4
    │  全球13组 │    │  DNS服务器  │    │  权威DNS    │
    └───────┘    └──────────┘    └──────────┘
 ```

 **递归查询 vs 迭代查询：**
 - 递归：你问 ISP，"帮我查 example.com"，ISP 替你跑完全程，最后给你答案
 - 迭代：你问根 DNS，"example.com 在哪？" 根说"去 .com 问"，你去 .com 问，"去 example.com 问"……你得自己一个个跑

 ### 8.2 DNS 记录类型

 | 类型 | 作用 | 示例 |
 |------|------|------|
 | A | 域名 → IPv4 地址 | `example.com → 1.2.3.4` |
 | AAAA | 域名 → IPv6 地址 | `example.com → 2001:db8::1` |
 | CNAME | 域名 → 域名（别名） | `www.example.com → example.cdn.com` |
 | MX | 邮件服务器 | `example.com → mail.example.com` |
 | NS | 权威 DNS 服务器 | `example.com → ns1.dns.com` |
 | TXT | 文本信息（SPF/DKIM验证等） | `example.com → "v=spf1 ..."` |

 **面试中 CNAME 的实战意义：**
 你的静态资源域名 `cdn.example.com` 通过 CNAME 指向 CDN 厂商的域名 `li-auto.example.cdn.com`。CDN 厂商在后台给 `li-auto.example.cdn.com` 做智能 DNS 解析——北京用户解析到北京节点 IP，上海用户解析到上海节点 IP。

 ### 8.3 DNS 优化手段

 ```
 1. DNS 预解析（省掉首次解析时间）
    <link rel="dns-prefetch" href="//api.example.com">
    浏览器在空闲时提前解析，用户真正请求时 IP 已就绪

 2. DNS 预连接（连 TCP+TLS 一起做了）
    <link rel="preconnect" href="//api.example.com">

 3. 减少域名数量
    每多一个域名就多一次 DNS 查询 → 收敛到 2-3 个关键域名

 4. 使用 CDN
    CDN 的智能 DNS 让用户解析到最近的节点
 ```

 ### 8.4 CDN 工作原理

 ```
 用户请求 cdn.example.com/app.js
                │
          ┌─────▼─────┐
          │ 智能DNS(GSLB)│  根据用户 IP 判断地理位置 + 网络状况
          │ 返回最近节点IP│  北京电信用户 → 北京电信机房节点
          └─────┬─────┘
                │
          ┌─────▼─────┐
          │  CDN边缘节点 │  1. 有缓存 → 直接返回（命中率 >95%）
          │  (Edge)     │  2. 无缓存 → 回源拉取 → 缓存 → 返回
          └─────┬─────┘
                │ 未命中，回源
          ┌─────▼─────┐
          │  源站(Origin)│  真正的文件存放处（你的 Nginx/OSS）
          └───────────┘
 ```

 ### 8.5 CDN 缓存策略

 | 策略 | 说明 | 适用场景 |
 |------|------|----------|
 | 强缓存（推荐） | 文件名带 hash，`max-age=31536000` | JS/CSS/图片等静态资源 |
 | 协商缓存 | CDN 节点向源站验证 ETag，304 则复用 | 频繁小更新的文件 |
 | 预热 | 提前把热门文件推到边缘节点 | 大促/发版前 |
 | 刷新 | 主动清除 CDN 缓存，强制回源 | 紧急修复 Bug |

 ### 8.6 你项目中 CDN 的实战架构

 ```
 Li People 微前端的 CDN 部署：

 主应用 (门户)
   index.html → Nginx 源站（no-cache，保证拿最新 HTML）

 子应用 A (人事)
   CDN: cdn.example.com/hr-app/1.2.3/
   ├── app.a1b2c3.js    → max-age=31536000 + filename hash
   ├── style.d4e5f6.css
   └── chunk-vendor.js

 子应用 B (组织)
   CDN: cdn.example.com/org-app/2.1.0/
   └── ...

 版本隔离：
   发新版 → 上传 CDN 新目录 /2.1.1/
   主应用 HTML 更新子应用版本号引用
   旧版本 /2.1.0/ 继续服务（旧 CDN 缓存不被清）
   用户下次刷新 HTML → 拿到新引用 → 加载新版本
 ```

 ### 8.7 面试用的话术

 > "静态资源部署在 CDN 上，文件名带 content hash，配合 `max-age=31536000` 做永久强缓存。CDN 通过 CNAME 接入，厂商的 GSLB 智能 DNS 根据用户 IP 返回最近的边缘节点。发布时构建产物上传 CDN 按版本号分目录，子应用通过精确版本号锁定依赖，实现版本隔离。大促发布前会做 CDN 预热，把新版本文件提前推到全国节点。"

 ---

 ## 九、TCP 简述

 **三次握手：** SYN -> SYN+ACK -> ACK。双方确认对方准备好了。
 为什么不是两次？如果只有两次（SYN → SYN-ACK），服务端无法确认自己的 SYN 客户端收到了。

 **四次挥手：** FIN -> ACK -> FIN -> ACK(等2MSL)。全双工各自关闭。
 **为什么挥手是四次？** TCP是全双工的，两端独立关闭。客户端发FIN只表示"我不发了"，服务端可能还有数据要传。所以服务端的ACK（确认收到）和FIN（我也发完了）不能合并——ACK要立刻回，FIN要等数据传输完再发。
 **为什么最后等2MSL？** 防止最后一个ACK丢失。如果服务端没收到最后的ACK，会重发FIN，客户端需要2MSL时间来处理这个可能的重发。

 ---

 ## 九、状态码速查

 200 OK | 204 No Content | 206 Partial Content | 301 永久重定向 | 302 临时重定向 | 304 Not Modified | 400 Bad Request | 401 Unauthorized | 403 Forbidden | 404 Not Found | 500 Internal Error | 502 Bad Gateway | 503 Unavailable | 504 Gateway Timeout

 ---

 ## 十、面试速查

 | 问题 | 要点 |
|------|------|
| HTTP/1.1 vs 2 vs 3 | 多路复用、头部压缩、服务器推送、QUIC |
| 强缓存 vs 协商缓存 | max-age不请求 / ETag问服务器 |
| 跨域解决 | CORS预检+头 / 代理 / JSONP |
| XSS/CSRF防御 | 转义+HttpOnly+CSP / SameSite+Token+Referer |
| HTTPS过程 | 非对称协商密钥 -> CA证书验证 -> 对称加密通信 |
| DNS解析 | 浏览器缓存 → OS → 路由器 → ISP递归 → 根→顶级→权威，A/CNAME/MX/TXT/NS |
| CDN原理 | GSLB智能DNS + 边缘节点 + 回源，CNAME接入，预热/刷新，版本号分目录 |
| TCP握手挥手 | SYN三次 / FIN四次，2MSL等待 |
| GET vs POST | GET幂等可缓存参数在URL / POST不幂等不可缓存 |
| Cookie vs Token vs JWT | Cookie存储 / Token无状态 / JWT结构化含签名 |
| SSO实现方式 | 同域Cookie / JWT透传 / CAS中心认证 / OAuth2.0+OIDC |
| 微前端SSO | 主应用统一鉴权 → Props注入子应用，子应用零登录逻辑 |
| CSP是什么 | 资源加载白名单，防XSS最后防线，10+指令覆盖所有资源类型 |
| CSP怎么上线 | 先用 Report-Only 模式收集数据，稳定后切正式策略 |
