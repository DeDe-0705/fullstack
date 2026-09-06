# 前端测试：BDD 与 E2E 自动化

> 核心结论一句话：
>
> **BDD 用业务语言（Gherkin）把「需求文档、测试用例、回归清单」三合一；2026 年的标准落地是 playwright-bdd——只借 Cucumber 的 Gherkin 解析零件，编译成原生 Playwright 测试，不吃 cucumber-js 自带 runner 的亏。**
>
> 本文同时是 client/ 项目的 E2E 自动化流程文档。

---

## 一、E2E 在测试体系中的位置

```
        ╱  E2E  ╲         少而精：核心用户旅程（登录、下单、支付）
       ╱ 集成测试 ╲        组件间交互、路由、状态管理
      ╱  单元测试   ╲      多而快：工具函数、hooks、纯逻辑（见 TDD 篇）
     ───────────────
     贯穿三层的纵向维度：视觉测试（用户「看到的」对不对）
```

E2E 的本质：模拟真实用户走完整链路（浏览器 → API → DB），回答「用户视角下能不能用」。单测全绿但支付流程断了的惨案，只有 E2E 能拦。

**2026 新共识**：金字塔向「菱形」演变——Playwright 把 E2E 执行从分钟级压到秒级，AI 把编写/维护成本降了一个数量级，「E2E 要少写」的老经验已过时。但单测依然是地基。

---

## 二、工具演进史（面试必考时间线）

```
Selenium (2004)  →  Cypress (2017)     →  Playwright (2020, 微软)
WebDriver 协议      跑在浏览器内部         CDP 直连浏览器
跨语言但慢、脆      DX 好但架构有硬伤      当前事实标准
```

| | Selenium | Cypress | **Playwright** |
|---|---|---|---|
| 架构 | WebDriver 协议中转 | JS 注入浏览器内运行 | Chrome DevTools Protocol 直连 |
| 跨浏览器 | ✅ 全部 | ❌ 长期只支持 Chromium 系 | ✅ Chromium/Firefox/WebKit |
| 自动等待 | ❌ 手动 sleep | ✅ | ✅ 更完善 |
| 真并行 | 靠 Selenium Grid | 收费（Cloud） | ✅ 免费原生 |
| 多标签页/iframe | ✅ | ❌ 架构硬伤 | ✅ |
| 调试 | 日志 | 时间旅行 UI | Trace Viewer 完整回放 |
| 2026 地位 | 存量老项目 | 存量 + 小团队 | **新项目默认选择** |

**一句话**：Cypress 靠 DX 赢了 Selenium，但「跑在浏览器内部」的架构天然做不了多标签页和跨浏览器；Playwright 用 CDP 直连解决，且自动等待、隔离、并行、trace 全部一等公民。

---

## 三、Cucumber 是什么？我们项目用了吗？

Cucumber 是 BDD 开山框架（2008，Ruby 起家），定义了 Gherkin 语言规范。分三层：

```
Gherkin 语言规范（假如/当/那么 这套语法的标准）
    ↓
@cucumber/gherkin 官方解析器（零件）
    ↓
@cucumber/cucumber 完整框架（整车）：解析 + step 注册 + 自己的 runner
```

**client/ 项目实测**（查 node_modules 依赖）：playwright-bdd 依赖了 `@cucumber/gherkin`（解析 .feature）、`@cucumber/cucumber-expressions`（step 的 `{string}` 参数匹配）、`@cucumber/tag-expressions`（标签过滤）等**零件**，但**不依赖 `@cucumber/cucumber` 本体**。

三条路线对比：

```
路线 A：cucumber-js —— Cucumber 解析 + Cucumber runner + 里面调 Playwright
        两层框架套娃，PW 的 trace/并行/fixture/报告需额外集成且残缺
路线 B：playwright-bdd（本项目）—— Cucumber 零件 + 编译成原生 PW 测试 + PW runner
        一层框架，高级特性零损耗
路线 C：纯 Playwright —— 不用 Gherkin 直接写 test()，适合纯技术团队
```

---

## 四、client/ 项目实战记录（2026-09-06）

### 4.1 基建

```bash
cd client
pnpm add -D @playwright/test playwright-bdd   # 1.63.0 / 9.2.0
npx playwright install chromium               # 浏览器二进制，全局缓存在
                                              # ~/Library/Caches/ms-playwright/，所有项目共用
```

**常见误解澄清**：headless（无头）不是另一种浏览器，是同一个浏览器的运行模式（不弹窗、内存渲染），有头/无头只是启动参数区别，不需要「单独下载无头浏览器应用」。

### 4.2 三层文件结构（BDD 的骨架）

```
client/
├── features/
│   ├── navigation.feature          # ① 人写：业务场景（Gherkin），需求契约
│   └── steps/navigation.steps.ts   # ② 人写（或 AI 起草）：step 实现，翻译胶水
├── .features-gen/                  # ③ 机器产物：bddgen 生成的 PW 测试（已 gitignore）
└── playwright.config.ts
```

**关键认知**：`bddgen` 只能把 ① 翻译成 ③ 的骨架，**无法生成 ②**——feature 里只有业务语义没有技术语义，机器不知道「用户打开首页」是 `page.goto('/')` 还是别的。steps 是契约的「履约代码」，删除后 bddgen 只能生成空壳提醒。

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

```json
// package.json
{
  "scripts": {
    "test:e2e": "bddgen && playwright test",      // 先翻译再执行，一条命令
    "test:e2e:ui": "bddgen && playwright test --ui"  // UI 模式可视化调试
  }
}
```

### 4.4 feature 文件（中文 Gherkin）

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

### 4.5 step 定义

```ts
// features/steps/navigation.steps.ts
import { expect } from '@playwright/test'
import { createBdd } from 'playwright-bdd'

const { Given, When, Then } = createBdd()

Given('用户打开首页', async ({ page }) => {
  await page.goto('/')
})

When('用户点击导航菜单 {string}', async ({ page }, menuLabel: string) => {
  // 语义化定位器：模拟用户找元素的方式，而非脆弱的 CSS 选择器
  await page.getByRole('menuitem', { name: menuLabel }).click()
})

Then('页面应显示标题 {string}', async ({ page }, title: string) => {
  await expect(page.getByRole('heading', { name: title })).toBeVisible()
})

Then('地址栏路径应变为 {string}', async ({ page }, path: string) => {
  await expect(page).toHaveURL(new RegExp(`${path}$`))
})
```

### 4.6 三个产物目录的分工

| 目录 | 谁产出 | 干什么 | 生命周期 |
|------|--------|--------|----------|
| `.features-gen/` | bddgen | Gherkin 翻译成的 PW 测试 | 每次跑前重新生成 |
| `test-results/` | playwright test | 排障现场：trace.zip/失败截图/录屏 | 失败永久保留；成功仅本次运行 |
| `playwright-report/` | playwright test | HTML 测试报告 | 每次运行覆盖 |

三者全部 gitignore。排障链路：

```bash
npx playwright show-report     # 1. HTML 报告总览
npx playwright show-trace test-results/某目录/trace.zip  # 2. 回放完整操作时间线
```

### 4.7 踩坑记录

- **vitest 误扫 `.features-gen/**/*.spec.js`**：两个框架的测试文件后缀相同，必须用 `vitest.config.ts` 的 `include` 收窄到 `tests/**`，划清地盘
- **trace 产物时间戳只到分钟**：本地短时间连跑多轮全过的测试，新 trace 会覆盖旧的；CI 上 `on-first-retry` 只录重试那次

---

## 五、feature 编写规范

### 5.1 硬性规范

1. **一个 feature 文件 = 一个功能，一个场景 = 一个行为**——一个场景只验证一件事，红了才知道是什么挂了
2. **Given/When/Then 语义不能乱**：Given = 前置状态（无操作）；When = 触发动作（一场景一个）；Then = 可观察结果（只断言）
3. **场景间必须独立**：场景 2 不依赖场景 1 的状态。PW 每个 test 新开 browser context，天然隔离

### 5.2 最重要：陈述式，不要命令式

```gherkin
# ❌ 命令式：UI 细节写进需求，UI 一改 feature 就失效
当 用户在 id 为 username 的输入框输入 "dede"
而且 用户点击 class 为 btn-primary 的按钮

# ✅ 陈述式：只写业务意图，UI 细节下沉到 steps
当 用户使用有效账号登录
```

判断标准：**产品能读懂，且 UI 重构时 feature 不需要改。**

### 5.3 进阶武器

```gherkin
功能: 帖子管理

  背景:                        # Background：每个场景自动先执行的公共前置
    假如 用户已登录
    而且 用户在帖子列表页

  @smoke                       # Tag：分类执行（CI 冒烟：--grep @smoke）
  场景大纲: 千分位格式化          # Scenario Outline：数据驱动
    假如 输入数字 <输入>
    那么 格式化结果应为 "<结果>"

    例子:
      | 输入     | 结果       |
      | 1234567  | 1,234,567  |
      | 999      | 999        |
```

词汇要用业务语言（与 PRD 对齐的 Ubiquitous Language），不要出现 `localStorage`、`browser context` 这类技术词。

---

## 六、AI 协作流（2026 工作方式）

### 6.1 人机分工总原则

```
人：写/评审 .feature（需求契约，业务意图只有人知道，必须人把关）
  ↓
AI：根据 feature 生成 step 实现（翻译工作，AI 擅长）
  ↓
人：review 生成的 steps（重点看定位器稳不稳、断言对不对）
  ↓
跑 pnpm test:e2e，绿了收工；红了把报错丢给 AI 修
```

**为什么不能全交给 AI**：feature 是验收标准。AI 既写需求又写测试 = 自己出题自己答，测试通过只证明「符合 AI 的理解」，不证明「符合业务需求」。

**人管契约、AI 管实现、人再 review**——这个模式也是 AI 工程化的核心范式，面试聊 AI 提效可直接用。

---

## 七、双 MCP 调试体系：操作手 + 诊断医生

### 7.1 定位对比（2026 共识：不是二选一，是接力）

| | Playwright MCP | Chrome DevTools MCP |
|---|---|---|
| 出品 | Playwright 官方（微软） | Chrome 官方（Google） |
| 视角 | 像用户一样**操作**页面 | 像 DevTools 一样**观察**浏览器内部 |
| 强项 | 导航、点击、填表、截图、跨浏览器（Chromium/Firefox/WebKit） | 性能 trace、Network 载荷、Console、Lighthouse、内存分析 |
| 会话模型 | 默认全新隔离 profile（干净无 cookie，适合测试） | 可 `--autoConnect` 挂到**当前登录的 Chrome**（Chrome 144+） |
| token 开销 | 每次操作后返回整页 a11y 树（起步约 13.7k token），长流程较贵 | 按需精确查询，诊断时反而省 |
| 一句话 | **操作手** | **诊断医生** |

MCP 不产生可回归的测试资产（调试完就完了），替代不了进 CI 的测试套件。

### 7.2 Codex 配置（本机已配置，~/.codex/config.toml）

```toml
# Playwright MCP：页面自动化操作
# --isolated：内存态会话，不落盘污染本机浏览器 profile
[mcp_servers.playwright]
command = "npx"
args = ["-y", "@playwright/mcp@latest", "--isolated"]
startup_timeout_sec = 120

# Chrome DevTools MCP：深度调试
# --slim：平时只加载 3 个核心工具省 token，需要深度诊断时去掉
[mcp_servers.chrome-devtools]
command = "npx"
args = ["-y", "chrome-devtools-mcp@latest", "--slim"]
startup_timeout_sec = 120
```

### 7.3 交接棒（handoff）实战模式

「帮我看看登录后仪表盘为什么慢」——表面是操作任务，载荷是诊断任务，拆成两棒：

1. **Playwright MCP**：复现路径（打开登录页 → 输账号密码 → 点登录 → 进仪表盘）
2. **Chrome DevTools MCP 接管诊断**：跑 performance trace、读 LCP 分解、查 Network 慢请求
3. AI 根据证据改代码 → Playwright MCP 重跑验证 → 固化成新 .feature 场景进回归

**登录态处理**：Playwright MCP 默认无 cookie（适合干净测试场景）；要复用已登录会话，用 DevTools MCP 的 `--autoConnect` 或 Playwright MCP 的 Bridge 扩展。

**token 成本意识**：两个 MCP 都装但不同时重载——DevTools MCP 用 `--slim` 平时只占零头，Playwright MCP 长流程注意 a11y 树膨胀；提示词里显式点名工具更稳（「用 Playwright 打开…截图」「用 chrome-devtools 分析 Network」）。

---

## 八、完整 AI 工作流闭环

```
【开发阶段】
你口述需求 → AI 起草 .feature → 你 review（人管契约）
  → AI 生成 steps（AI 管实现）→ 你 review
  → pnpm test:e2e 进 CI

【调试阶段：双 MCP 接力】
E2E 挂了 / 页面不对劲
  → ① Playwright MCP 复现用户路径
  → ② 发现异常 → Chrome DevTools MCP 接管（Network/性能 trace/Console）
  → ③ AI 根据证据改代码
  → ④ Playwright MCP 重跑验证
  → ⑤ 稳定后固化成新的 .feature 场景，进回归套件

【线上排障阶段】
你在自己 Chrome 里发现线上问题
  → Chrome DevTools MCP --autoConnect 挂到当前会话
  → AI 直接分析你正在看的页面（session、选中的 Network 请求都能继承）
```

闭环的关键：**每次调试的最终产出不是「修好了」，而是「修好 + 多了一条回归场景」**——测试套件随每次 bug 修复而生长。

---

## 九、面试高频问答

**Q：你们 E2E 怎么做的？**
> BDD 写 feature 文件（中文 Gherkin，产品/QA 能 review），playwright-bdd 桥接编译成原生 Playwright 测试，CI 里 headless 跑，配 retry + trace 防抖动留现场。失败排查先看 trace 回放，复杂线上问题用 Chrome DevTools MCP 让 AI 辅助分析。

**Q：为什么不直接用 cucumber-js？**
> cucumber-js 自带 runner，和 Playwright 是两套体系，trace、并行、fixture、HTML 报告都要额外集成且残缺；playwright-bdd 只复用 Cucumber 官方的 Gherkin 解析器和表达式引擎零件，编译产物就是原生 PW 测试，零损耗。

**Q：BDD 框架能根据 feature 自动生成实现吗？**
> 不能也没必要。feature 只有业务语义没有技术语义，「用户打开首页」背后是什么操作机器无从知晓。step 定义是必须人维护的翻译契约。bddgen 的极限是检测缺失 step 并生成空壳提醒——2026 年 AI 可以起草 steps，但仍需人 review。

**Q：你的 AI 前端工作流是什么样的？**
> 三层：需求层用 BDD（人写 feature，AI 生成 steps，人 review）；执行层 Playwright 进 CI；调试层双 MCP 接力——Playwright MCP 复现用户路径，Chrome DevTools MCP 深度诊断（Network/性能 trace/Lighthouse），证据驱动改代码，修复后固化成新 BDD 场景进回归。核心原则：人管契约、AI 管实现和跑腿。

**Q：E2E 测试不稳定（flaky）怎么治？**
> ① 禁 `waitForTimeout` 硬等，改为等待具体条件；② 用语义化定位器（role/text）不用 CSS 选择器；③ 测试数据自造自清，场景零依赖；④ CI 配 `retries: 2` + `trace: 'on-first-retry'`；⑤ 只测核心旅程，30-50 个精心维护好过几百个没人管。

---

## 参考来源

- [playwright-bdd 官方文档（vs cucumber-js 对比）](https://playwright-bdd.github.io/)
- [Playwright vs Cypress 2026 对比（DEV）](https://dev.to/flowary/playwright-vs-cypress-the-complete-guide-to-e2e-testing-frameworks-in-2026-2d9j)
- [cucumber-js vs playwright-bdd 迁移分析（Medium）](https://medium.com/@christian.tedjokusumo/running-cucumber-js-vs-playwright-bdd-for-playwright-tests-my-experience-0f7116d3a01b)
- [Playwright E2E 最佳实践 2026（medium）](https://medium.com/@koteswardev/from-setup-to-ci-cd-playwright-e2e-testing-best-practices-for-2026-e6627263fa27)
- [AI 驱动 E2E 趋势 2026（frasersdev）](https://frasersdev.automationpanda.com/2025/12/02/how-ai-is-rewriting-e2e-test-automation/)
- [Playwright MCP vs Chrome DevTools MCP 2026 指南（testleaf）](https://www.testleaf.com/blog/playwright-mcp-server-vs-chrome-devtools-mcp-2026-guide/)
- [Chrome DevTools MCP 官方博客（autoConnect / --slim）](https://developer.chrome.com/blog/chrome-devtools-mcp)
