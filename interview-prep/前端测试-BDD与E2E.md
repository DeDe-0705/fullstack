# 前端测试：BDD 与 E2E 自动化

> 核心结论：
>
> **BDD 用业务语言（Gherkin）把「需求文档、测试用例、回归清单」三合一；落地用 playwright-bdd——复用 Cucumber 官方的 Gherkin 解析零件，编译成原生 Playwright 测试；双 MCP（Playwright 操作 + Chrome DevTools 诊断）作为开发辅助，不进 CI、不作验收标准。**

---

## 一、本项目标准工作流

```
1.【BDD 业务契约】人写 / AI 起草 .feature Gherkin 场景
   → 人工审核业务场景完整性（契约必须人把关）
2.【TDD 逻辑层】人定义输入输出测试契约 → 红
   → AI 生成组件/hook/工具函数实现 → Vitest 全绿
   （详见《前端测试-TDD实战》）
3.【开发辅助】playwright-mcp 拉起干净浏览器跑业务流程
   → 快速验证页面符合预期，产出参考代码片段
   （前提：页面已能跑起来；零代码阶段先让 AI 搭页面骨架）
4.【固化用例】@playwright/test + playwright-bdd
   → 把验证过的逻辑手写/润色成稳定 steps，进版本库，CI 跑 BDD-E2E 回归
5.【页面调试】chrome-devtools-mcp（--autoConnect 可挂本机 Chrome）
   → AI 直接分析开发/线上环境的 DOM、接口、性能
```

> **边界红线**：
> - 所有要版本管理、要 CI 跑的测试，必须落到 Vitest / @playwright/test
> - 两个 MCP 只作为**开发辅助工具**，MCP 跑的结果**不能当做项目的验收标准**

**为什么契约必须人把关**：feature 是验收标准。AI 既写需求又写测试 = 自己出题自己答，测试通过只证明「符合 AI 的理解」，不证明「符合业务需求」。原则一句话：**人管契约、AI 管实现和跑腿、人再 review**。

---

## 二、测试体系全景

```
        ╱  E2E  ╲         核心用户旅程（登录、下单、支付）
       ╱ 集成测试 ╲        组件间交互、路由、状态管理
      ╱  单元测试   ╲      工具函数、hooks、纯逻辑（TDD 主战场）
     ───────────────
     纵向维度：视觉测试（用户「看到的」对不对）
```

- **E2E 的本质**：模拟真实用户走完整链路（浏览器 → API → DB），回答「用户视角下能不能用」。单测全绿但支付流程断了的惨案，只有 E2E 能拦
- **数量原则**：E2E 只测核心旅程，30-50 个精心维护好过几百个没人管；优先级：登录 > 核心业务流程 > 支付 > 其他
- **2026 趋势**：Playwright 把 E2E 执行压到秒级、AI 把编写维护成本降了一个数量级，E2E 占比可以比传统金字塔建议的更高——但单测依然是地基

**xDD 分工**（面试常考辨析）：

| 缩写 | 全称 | 管什么 |
|------|------|--------|
| TDD | Test-Driven Development | 写代码的节奏（红绿重构） |
| BDD | Behavior-Driven Development | 需求的表达（Gherkin 业务语言） |
| CDD | Component-Driven Development | 组件开发组织（Storybook） |
| CDD | Contract-Driven Development | 前后端契约（OpenAPI/Pact）⚠️ 一词多义 |
| ATDD | Acceptance TDD | 验收标准先行（BDD 的业务侧） |

三者不冲突：TDD 管逻辑怎么写，BDD 管需求怎么描述，CDD 管组件怎么搭。

---

## 三、工具选型结论

### 3.1 E2E 框架：Playwright

| | Selenium | Cypress | **Playwright** |
|---|---|---|---|
| 架构 | WebDriver 协议中转 | JS 注入浏览器内运行 | Chrome DevTools Protocol 直连 |
| 跨浏览器 | ✅ 全部 | ❌ 长期只支持 Chromium 系 | ✅ Chromium/Firefox/WebKit |
| 自动等待 | ❌ 手动 sleep | ✅ | ✅ 更完善 |
| 真并行 | 靠 Grid | 收费（Cloud） | ✅ 免费原生 |
| 多标签页/iframe | ✅ | ❌ 架构硬伤 | ✅ |
| 调试 | 日志 | 时间旅行 UI | Trace Viewer 完整回放 |
| 2026 地位 | 存量老项目 | 存量 + 小团队 | **新项目默认选择** |

Playwright 核心能力：**自动等待**（消灭 80% flaky）、**语义化定位器**（getByRole/getByText，不用脆弱 CSS 选择器）、**Browser Context 隔离**（每个测试全新环境，微秒级创建，天然并行）、**网络拦截**（`page.route()` mock API，E2E 不依赖后端）、**trace/截图/录屏**（失败完整回放）、**codegen**（录制生成脚本）。

### 3.2 BDD 桥接：playwright-bdd（不是 cucumber-js）

Cucumber 是 BDD 开山框架（2008），定义了 Gherkin 语言规范，其官方实现分两层：

```
@cucumber/gherkin 解析器（零件）
@cucumber/cucumber 完整框架（整车）：解析 + step 注册 + 自己的 runner
```

playwright-bdd 复用 Cucumber 的**零件**（gherkin 解析器、cucumber-expressions 参数匹配、tag-expressions），但执行层编译成**原生 Playwright 测试**；cucumber-js 是自带 runner 的**整车**，和 Playwright 两套体系，trace/并行/fixture/HTML 报告都需额外集成且残缺。

```
路线 A：cucumber-js      —— 两层框架套娃 ❌
路线 B：playwright-bdd   —— 一层框架，PW 特性零损耗 ✅（本项目）
路线 C：纯 Playwright    —— 不用 Gherkin，适合纯技术团队
```

### 3.3 单元测试：Vitest

与 Vite 同生态、配置零成本、ESM 原生、速度快，2026 前端单测主流选择。详见《前端测试-TDD实战》。

---

## 四、client/ 项目落地

### 4.1 目录结构

```
client/
├── src/utils/*.ts                    # 实现
├── tests/utils/*.test.ts             # 单元测试（vitest），目录镜像 src
├── features/                         # BDD 层
│   ├── *.feature                     # 人写：业务场景（Gherkin），需求契约
│   └── steps/*.steps.ts              # 人写/AI 起草：step 实现，翻译胶水
├── .features-gen/                    # 机器产物：bddgen 生成的 PW 测试（gitignore）
├── playwright.config.ts              # E2E 配置
└── vitest.config.ts                  # 单测配置
```

**三层文件模型**（BDD 的骨架）：

- `bddgen` 只能把 feature 翻译成 `.features-gen` 骨架，**无法生成 steps**——feature 只有业务语义没有技术语义，机器不知道「用户打开首页」是 `page.goto('/')`
- steps 是契约的「履约代码」，必须人写（或 AI 起草 + 人 review）
- 缺 step 时 bddgen 会检测出来并生成空壳提醒（`Use snippets above to create missing steps`）

### 4.2 安装与脚本

```bash
pnpm add -D vitest                              # 单元测试
pnpm add -D @playwright/test playwright-bdd     # E2E + BDD
npx playwright install chromium                 # 浏览器二进制
```

浏览器二进制全局缓存在 `~/Library/Caches/ms-playwright/`，所有项目共用，只装一次。headless（无头）是同一浏览器的运行模式（不弹窗、内存渲染），不是独立软件，无需单独下载。

```json
// package.json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "bddgen && playwright test",
    "test:e2e:ui": "bddgen && playwright test --ui"
  }
}
```

### 4.3 配置

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'
import { defineBddConfig } from 'playwright-bdd'

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'features/steps/**/*.ts',
})

export default defineConfig({
  testDir,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',       // CI 重试时录 trace：防抖动又留现场
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {                     // 跑测试前自动起 dev server，已起则复用
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
  },
})
```

```ts
// vitest.config.ts —— 单元测试只看 tests/，与 E2E 划清地盘
// （必须收窄：否则 vitest 会误扫 .features-gen/**/*.spec.js，两个框架后缀相同）
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
```

### 4.4 feature 示例（中文 Gherkin）

```gherkin
# language: zh-CN
功能: 站点导航
  场景: 访问首页能看到站点标题
    假如 用户打开首页
    那么 页面应显示标题 "全栈脚手架"

  场景: 从首页导航到关于页
    假如 用户打开首页
    当 用户点击导航菜单 "关于"
    那么 地址栏路径应变为 "/about"
    而且 页面应显示文本 "技术栈"
```

Gherkin 支持 70+ 语言关键字，英文 `Given/When/Then` 与中文 `假如/当/那么` 完全等价，step 匹配只看文本不看关键字。

### 4.5 step 定义示例

```ts
// features/steps/navigation.steps.ts
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given('用户打开首页', async ({ page }) => {
  await page.goto('/')
})

When('用户点击导航菜单 {string}', async ({ page }, menuLabel: string) => {
  await page.getByRole('menuitem', { name: menuLabel }).click()
})

Then('页面应显示标题 {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

Then('地址栏路径应变为 {string}', async ({ page }, path: string) => {
  await expect(page).toHaveURL(new RegExp(`${path}$`))
})
```

### 4.6 产物目录与排障

| 目录 | 产出方 | 内容 | 生命周期 |
|------|--------|------|----------|
| `.features-gen/` | bddgen | Gherkin 翻译成的 PW 测试 | 每次跑前重新生成 |
| `test-results/` | playwright test | trace.zip、失败截图、录屏 | 失败永久保留；成功仅本次运行 |
| `playwright-report/` | playwright test | HTML 测试报告 | 每次运行覆盖 |

三者全部 gitignore。排障链路：

```bash
npx playwright show-report                          # 1. HTML 报告总览
npx playwright show-trace test-results/某目录/trace.zip  # 2. 回放完整操作时间线
```

---

## 五、feature 编写规范

### 5.1 硬性规范

1. **一个 feature 文件 = 一个功能，一个场景 = 一个行为**
2. **Given/When/Then 语义不能乱**：Given = 前置状态（无操作）；When = 触发动作（一场景一个）；Then = 可观察结果（只断言）
3. **场景间必须独立**：不依赖其他场景的状态（PW 每个 test 新开 browser context，天然隔离）

### 5.2 核心风格：陈述式，不要命令式

```gherkin
# ❌ 命令式：UI 细节写进需求，UI 一改 feature 就失效
当 用户在 id 为 username 的输入框输入 "dede"
而且 用户点击 class 为 btn-primary 的按钮

# ✅ 陈述式：只写业务意图，UI 细节下沉到 steps
当 用户使用有效账号登录
```

判断标准：**产品能读懂，且 UI 重构时 feature 不需要改**。词汇用业务语言（与 PRD 对齐），不出现 localStorage、CSS 类名等技术词。

### 5.3 进阶武器

```gherkin
功能: 帖子管理

  背景:                        # Background：每个场景自动先执行的公共前置
    假如 用户已登录
    而且 用户在帖子列表页

  @smoke                       # Tag：分类执行（CI 冒烟：--grep @smoke）
  场景大纲: 登录校验            # Scenario Outline：数据驱动，一模板跑多组数据
    假如 用户在登录页
    当 用户输入账号 "<账号>" 密码 "<密码>"
    那么 应看到提示 "<提示>"

    例子:
      | 账号 | 密码   | 提示           |
      | dede | 123456 | 登录成功       |
      | dede | wrong  | 账号或密码错误  |
```

---

## 六、双 MCP 开发调试体系

### 6.1 定位：操作手 + 诊断医生，接力使用

| | Playwright MCP | Chrome DevTools MCP |
|---|---|---|
| 出品 | Playwright 官方（微软） | Chrome 官方（Google） |
| 视角 | 像用户一样**操作**页面 | 像 DevTools 一样**观察**浏览器内部 |
| 强项 | 导航、点击、填表、截图、跨浏览器 | 性能 trace、Network 载荷、Console、Lighthouse、内存 |
| 会话模型 | 默认全新隔离 profile（干净无 cookie） | 可 `--autoConnect` 挂到**当前登录的 Chrome**（Chrome 144+） |
| token 开销 | 每次操作返回整页 a11y 树，长流程较贵 | 按需精确查询，诊断时反而省 |

**异常发现是漏斗不是二选一**：Playwright MCP 操作时会顺手报表面信号（如 Console 错误数）；信息不够定位时才升级到 DevTools MCP 做深度分析（哪个接口 500、性能 trace 哪段卡了主线程）。口诀：**操作手顺手报信，报不清楚才喊医生做 CT**。

### 6.2 开发循环

```
写代码 → vite 热更新 → playwright-mcp 跑一遍验证
   ↓ 发现异常
chrome-devtools-mcp 抓日志/抓包/性能分析 → 定位 → 改代码 → 循环
```

人的角色是**裁判**：AI 跑腿和汇报，人判断「这是 bug 还是预期行为」「改还是不改」。

### 6.3 Codex 配置（~/.codex/config.toml）

```toml
# Playwright MCP：页面自动化操作
# --isolated：内存态会话，不落盘污染本机浏览器 profile
[mcp_servers.playwright]
command = "/opt/homebrew/bin/npx"   # ⚠️ GUI 应用不继承 shell PATH，必须写绝对路径
args = ["-y", "@playwright/mcp@latest", "--isolated"]
startup_timeout_sec = 120

# Chrome DevTools MCP：深度调试
# --slim：平时只加载核心工具省 token，需要深度诊断时去掉
[mcp_servers.chrome-devtools]
command = "/opt/homebrew/bin/npx"
args = ["-y", "chrome-devtools-mcp@latest", "--slim"]
startup_timeout_sec = 120
```

**使用技巧**：
- 提示词里显式点名工具更稳（「用 Playwright 打开…」「用 chrome-devtools 分析 Network」）
- Playwright MCP 长流程注意 a11y 树膨胀导致的 token 成本
- 需要已登录会话时：DevTools MCP `--autoConnect` 或 Playwright MCP Bridge 扩展
- 新 MCP 配置后需完全退出 Codex（Cmd+Q）重开，且在新线程生效

---

## 七、完整工作流闭环

```
【开发】人写/审 feature → AI 生成 steps → 人 review → CI 回归
【调试】E2E 挂 → playwright-mcp 复现路径 → chrome-devtools-mcp 诊断
       → 改代码 → 重跑验证 → 固化成新 .feature 场景进回归
【排障】线上问题 → chrome-devtools-mcp --autoConnect 挂本机 Chrome
       → AI 直接分析当前会话的 DOM/Network/性能
```

闭环的关键：**每次调试的最终产出不是「修好了」，而是「修好 + 多了一条回归场景」**——测试套件随每次 bug 修复而生长。

---

## 八、面试高频问答

**Q：你们 E2E 怎么做的？**
> BDD 写 feature 文件（中文 Gherkin，产品/QA 能 review），playwright-bdd 桥接编译成原生 Playwright 测试，CI 里 headless 跑，配 retry + trace 防抖动留现场。失败排查先看 trace 回放，复杂问题用 Chrome DevTools MCP 让 AI 辅助分析。

**Q：为什么不直接用 cucumber-js？**
> cucumber-js 自带 runner，和 Playwright 是两套体系，trace、并行、fixture、HTML 报告都要额外集成且残缺；playwright-bdd 只复用 Cucumber 官方的 Gherkin 解析器和表达式引擎零件，编译产物就是原生 PW 测试，零损耗。

**Q：BDD 框架能根据 feature 自动生成实现吗？**
> 不能也没必要。feature 只有业务语义没有技术语义，机器不知道「用户打开首页」对应什么操作。step 定义是必须人维护的翻译契约；AI 可以起草 steps，但人必须 review。

**Q：E2E 测试不稳定（flaky）怎么治？**
> ① 禁 `waitForTimeout` 硬等，改为等待具体条件；② 语义化定位器（role/text）不用 CSS 选择器；③ 测试数据自造自清，场景零依赖；④ CI 配 `retries: 2` + `trace: 'on-first-retry'`；⑤ 只测核心旅程。

**Q：你的 AI 前端工作流是什么样的？**
> 三层：需求层用 BDD（人写 feature，AI 生成 steps，人 review）；执行层 Playwright 进 CI；调试层双 MCP 接力——Playwright MCP 复现用户路径，Chrome DevTools MCP 深度诊断（Network/性能 trace/Lighthouse），证据驱动改代码，修复后固化成新 BDD 场景进回归。核心原则：人管契约、AI 管实现和跑腿；MCP 结果不作验收标准。

---

## 参考来源

- [playwright-bdd 官方文档](https://playwright-bdd.github.io/)
- [Playwright vs Cypress 2026 对比（DEV）](https://dev.to/flowary/playwright-vs-cypress-the-complete-guide-to-e2e-testing-frameworks-in-2026-2d9j)
- [Playwright E2E 最佳实践 2026](https://medium.com/@koteswardev/from-setup-to-ci-cd-playwright-e2e-testing-best-practices-for-2026-e6627263fa27)
- [Playwright MCP vs Chrome DevTools MCP 2026 指南（testleaf）](https://www.testleaf.com/blog/playwright-mcp-server-vs-chrome-devtools-mcp-2026-guide/)
- [Chrome DevTools MCP 官方博客（autoConnect / --slim）](https://developer.chrome.com/blog/chrome-devtools-mcp)
- [AI 驱动 E2E 趋势 2026](https://frasersdev.automationpanda.com/2025/12/02/how-ai-is-rewriting-e2e-test-automation/)
