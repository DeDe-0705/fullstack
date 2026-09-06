# 前端测试：TDD 实战

> 核心结论一句话：
>
> **TDD 不是「写完代码补测试」，而是「测试先行」——红（写失败测试）→ 绿（最小实现）→ 重构（测试保持绿）。它的本质是设计活动，不是验证活动。**
>
> 本文同时是 client/ 项目的单元测试自动化流程文档。

---

## 一、xDD 全家桶：先分清谁是谁

| 缩写 | 全称 | 一句话 | 管什么 |
|------|------|--------|--------|
| TDD | Test-Driven Development | 红绿重构，测试先行 | **写代码的节奏** |
| BDD | Behavior-Driven Development | Gherkin 业务语言写测试（假如/当/那么） | **需求的表达** |
| CDD | Component-Driven Development | 组件自底向上开发（Storybook） | **组件的开发组织** |
| CDD | Contract-Driven Development | 契约驱动（OpenAPI/Pact） | 前后端协作接口 |
| ATDD | Acceptance TDD | 验收标准先行 | BDD 的业务侧版本 |
| DDD | Domain-Driven Design | 领域驱动设计 | 分层架构，跟测试无关 |

⚠️ **CDD 一词多义**：前端组件语境 = Component-Driven；微服务/前后端协作语境 = Contract-Driven。面试遇到主动问一句「您指组件驱动还是契约驱动」，是加分项。

三者不冲突：TDD 管逻辑怎么写，BDD 管需求怎么描述，CDD 管组件怎么搭。

---

## 二、TDD 核心循环：红 - 绿 - 重构

```
写一个失败的测试（Red）——此时实现还不存在，测试必须红
  → 写刚好够通过测试的代码（Green）——不求优雅，能过就行
    → 重构优化（Refactor）——行为不变，测试保持绿
      → 循环下一个用例
```

**关键认知**：先写测试不是「顺序洁癖」，而是强迫你在写实现前先想清楚**接口设计和使用方式**——得到的是可测试性内建的设计。事后补测试只是验证活动，得不到这个收益。

---

## 三、client/ 项目实战记录（2026-09-06）

### 3.1 基建搭建

```bash
cd client
pnpm add -D vitest   # 5.0.0
```

`package.json` 脚本：

```json
{
  "scripts": {
    "test": "vitest run",        // 单次跑（CI 用）
    "test:watch": "vitest"       // 监听模式，改动自动重跑（TDD 时推荐）
  }
}
```

`vitest.config.ts`（独立配置，与 E2E 划清地盘）：

```ts
import { defineConfig } from 'vitest/config'

// 单元测试只看 tests/ 目录，避免误扫 playwright-bdd 生成的 .features-gen/**/*.spec.js
export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
  },
})
```

### 3.2 目录约定：测试集中管理

```
client/
├── src/utils/
│   ├── format.ts          # 实现
│   └── chunk.ts           # 实现
└── tests/                 # 测试统一放这里，目录结构镜像 src
    └── utils/
        ├── format.test.ts
        └── chunk.test.ts
```

两种风格取舍（面试可能问）：
- **同目录（co-located）**：测试跟着源码走，删模块不留孤儿测试，组件库常用
- **集中 tests/ 目录**：源码目录干净，适合工具库和业务项目

vitest 默认 include 规则是 `**/*.{test,spec}.*`，项目里任何位置都能自动发现，无需额外配置（我们用 include 收窄是为了和 Playwright 隔离）。

### 3.3 完整红绿循环案例：千分位格式化

**Red**：先写测试，`format.ts` 还不存在

```ts
// tests/utils/format.test.ts
import { describe, it, expect } from 'vitest'
import { formatThousands } from '../../src/utils/format'

describe('formatThousands 千分位格式化', () => {
  it('基本整数格式化', () => {
    expect(formatThousands(1234567)).toBe('1,234,567')
  })
  it('不足千位时不加逗号', () => expect(formatThousands(999)).toBe('999'))
  it('保留小数部分', () => expect(formatThousands(1234567.89)).toBe('1,234,567.89'))
  it('负数同样处理', () => expect(formatThousands(-1234567)).toBe('-1,234,567'))
  it('0 和小数', () => {
    expect(formatThousands(0)).toBe('0')
    expect(formatThousands(0.5)).toBe('0.5')
  })
})
```

跑 `pnpm test` → **红**（`Cannot find module './format'`）。

**Green**：最小实现（循环插逗号，不求优雅）→ 6/6 绿。

**Refactor**：行为不变，换成正则一行解决，测试保持绿：

```ts
// src/utils/format.ts
export function formatThousands (num: number): string {
  const [intPart, decimalPart] = String(num).split('.')
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return decimalPart !== undefined ? `${formatted}.${decimalPart}` : formatted
}
```

正则拆解 `/\B(?=(\d{3})+(?!\d))/g`：
- `\B` 非单词边界：避免在数字串最左侧加逗号
- `(?=(\d{3})+)` 前瞻：当前位置右侧必须是 3 的倍数位数字
- `(?!\d)` 负向断言：确保右侧**恰好**是 3 的倍数位（匹配到最后一组）

### 3.4 第二个案例：chunk 数组分块

同样红绿循环，注意两个工程实践：

```ts
export function chunk<T> (arr: T[], size: number): T[][] {
  // 边界防御：非法参数显式抛错，而不是静默返回奇怪结果
  if (!Number.isInteger(size) || size < 1) {
    throw new RangeError(`chunk size 必须是 >= 1 的整数，收到: ${size}`)
  }
  const result: T[][] = []
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size))
  }
  return result
}
```

- **纯函数**：不修改原数组（测试里专门有一条 `不修改原数组` 的用例守住这个契约）
- **边界用例是 TDD 的灵魂**：空数组、size 大于长度、非法 size——这些用例是「先写测试」时最容易想到的，「写完代码再补测试」时最容易漏的

---

## 四、TDD 在前端的适用范围（面试必答）

**适合 TDD**：纯逻辑层——工具函数、数据转换、状态机、hooks、store、领域逻辑。

**不适合硬套 TDD**：声明式 UI。组件的「数据契约」（props 输入 → 渲染输出/事件）可以 TDD，但像素级 UI 变化快，测试维护成本高。

**为什么前端 TDD 难推**（面试追问）：
1. UI 变化快，快照测试滥用导致测试变脆
2. 业务节奏快，短期看 TDD 慢（长期看减少返工和线上 bug）
3. 团队习惯「先实现再说」

**破局思路**：TDD 聚焦数据层/逻辑层，UI 层交给组件测试 + E2E。让开发者脱离「面向 UI 调样式」，转向「面向功能逻辑开发」，避免头重脚轻（UI 塞满逻辑、数据层空心）。

---

## 五、面试高频问答

**Q：TDD 和「先写代码再补测试」的本质区别？**
> 测试先行是设计活动：先想清楚接口和验收标准，得到可测试性内建的设计；补测试是验证活动，代码已经定型，测试只是事后确认。前者影响设计，后者不影响。

**Q：你们项目测试怎么做的？**
> 单元测试用 Vitest 跑纯逻辑层（工具函数、hooks），测试集中在 tests/ 目录镜像 src；开发节奏上逻辑层走 TDD 红绿重构。E2E 层用 Playwright + BDD（见《前端测试-BDD与E2E》）。

**Q：TDD 的红绿重构具体是什么？**
> Red：先写一个必然失败的测试（实现还不存在）；Green：写刚好能过测试的最小实现，不求优雅；Refactor：测试保护下优化实现。每一步都能跑测试验证，永不远离可运行状态。

---

## 参考来源

- [前端单元测试行研：Vitest 成为主流（掘金）](https://juejin.cn/post/7447402095573184552)
- [Vitest vs Jest 2026 对比](https://stephango.com/blog/20260201-vitest-vs-jest-2026)
- [Nx 前端 CDD & TDD 提效实践（掘金）](https://juejin.cn/post/7552122117392724009)
