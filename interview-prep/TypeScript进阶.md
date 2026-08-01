# TypeScript 进阶

> 你的主栈是 Vue3 + TS，这块面试必问。本文覆盖类型体操、泛型、条件类型、类型守卫等高级话题——都是高级前端 TS 面试的高频考点。

---

## 一、interface vs type

**面试第一题——什么时候用 interface、什么时候用 type？**

```ts
// interface — 描述对象/类的形状
interface User {
  name: string
  age: number
}

// type — 描述任何类型（联合、交叉、原始类型等）
type ID = string | number
type Pair<T> = [T, T]
type UserWithEmail = User & { email: string }
```

| 维度 | interface | type |
|------|-----------|------|
| 描述对象/类形状 | ✅ | ✅ |
| 联合类型 | ❌ | ✅ |
| 交叉类型 | ❌ | ✅ |
| 元组/字面量 | ❌ | ✅ |
| 声明合并（同名自动合并） | ✅ | ❌ |
| 扩展（extends） | ✅ | ✅（用 &） |

**面试话术：** "对象形状用 interface（支持声明合并，适合库的扩展）；联合/交叉/元组用 type。React 组件 Props 习惯用 interface（可被业务方 extends 扩展），Vue3 defineProps 用 type（更简洁）。"

---

## 二、泛型（Generics）

### 2.1 泛型函数

```ts
// <T> 是类型参数，调用时确定
function identity<T>(value: T): T {
  return value
}

identity<string>('hello')  // 显式指定
identity(42)               // 类型推断为 number
```

### 2.2 泛型约束（extends）

```ts
// 约束 T 必须有 length 属性
function getLength<T extends { length: number }>(arr: T): number {
  return arr.length
}

getLength('hello')   // ✅
getLength([1, 2, 3]) // ✅
getLength(123)       // ❌ number 没有 length
```

### 2.3 泛型默认值

```ts
interface PaginatedResponse<T, Meta = { total: number; page: number }> {
  data: T[]
  meta: Meta
}

const res: PaginatedResponse<User> = { ... }  // Meta 用默认类型
const res2: PaginatedResponse<User, { count: number }> = { ... }  // 自定义 Meta
```

### 2.4 实战：你项目中的泛型

```ts
// API 请求封装
async function request<T>(url: string): Promise<T> {
  const res = await fetch(url)
  return res.json()
}

const users = await request<User[]>('/api/users')  // 类型推断为 User[]
const user = await request<User>('/api/users/1')

// 组件库 Props 泛型（结合你的组件库经验）
interface TableProps<T> {
  data: T[]
  columns: Array<{
    key: keyof T
    title: string
    render?: (row: T) => VNode
  }>
}

const columns = [
  { key: 'name', title: '姓名' },
  { key: 'age', title: '年龄' }
]  // key 自动限制为 'name' | 'age'，写错就报错
```

---

## 三、条件类型（Conditional Types）

### 3.1 基础语法

```ts
// 类似三元运算符：T extends U ? X : Y
type IsString<T> = T extends string ? true : false

type A = IsString<'hello'>  // true
type B = IsString<123>      // false
```

### 3.2 infer 关键字 — 类型推断

```ts
// 提取 Promise 的内部类型
type UnwrapPromise<T> = T extends Promise<infer U> ? U : T

type Result = UnwrapPromise<Promise<string>>  // string

// 提取数组元素类型
type ElementType<T> = T extends (infer U)[] ? U : never

type Item = ElementType<string[]>  // string

// 提取函数返回值
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never

type R = MyReturnType<() => string>  // string

// 提取函数参数
type MyParameters<T> = T extends (...args: infer P) => any ? P : never

type P = MyParameters<(a: string, b: number) => void>  // [string, number]
```

**面试重点：** `infer` 是 TS 类型体操的核心——能"反向推导"出某个位置应该是什么类型。

### 3.3 分布式条件类型

```ts
// 联合类型会"分发"逐个判断
type ToArray<T> = T extends any ? T[] : never

type Result = ToArray<string | number>  // string[] | number[]
// 不是 (string | number)[]，而是分别处理
```

---

## 四、映射类型（Mapped Types）

### 4.1 基础语法

```ts
// 遍历类型的所有 key
type Readonly<T> = {
  readonly [K in keyof T]: T[K]
}

type Optional<T> = {
  [K in keyof T]?: T[K]
}

interface User { name: string; age: number }
type ReadonlyUser = Readonly<User>  // { readonly name: string; readonly age: number }
```

### 4.2 修改键名（key remapping）

```ts
// 把所有 key 加上 Get 前缀
type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K]
}

type UserGetters = Getters<User>
// { getName: () => string; getAge: () => number }
```

### 4.3 过滤键

```ts
// 只保留函数类型的属性
type FunctionProperties<T> = {
  [K in keyof T as T[K] extends Function ? K : never]: T[K]
}

type UserFunctions = FunctionProperties<User>
// User 没有 Function 属性 → {} 空对象
```

---

## 五、TS 内置工具类型实现原理

**面试爱问"手写 Partial/Omit/Record/Pick"——能写出来证明你懂底层。**

### 5.1 Partial — 所有属性可选

```ts
// 内置：Partial<T>
type MyPartial<T> = {
  [K in keyof T]?: T[K]
}

// 使用
const patch: Partial<User> = { name: 'Alice' }  // age 可不传
```

### 5.2 Required — 所有属性必填

```ts
type MyRequired<T> = {
  [K in keyof T]-?: T[K]  // -? 移除可选标记
}
```

### 5.3 Pick — 选取部分属性

```ts
type MyPick<T, K extends keyof T> = {
  [P in K]: T[P]
}

type UserName = Pick<User, 'name'>  // { name: string }
```

### 5.4 Omit — 排除部分属性

```ts
type MyOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>

type UserWithoutAge = Omit<User, 'age'>  // { name: string }
```

### 5.5 Record — 构造键值对类型

```ts
type MyRecord<K extends keyof any, V> = {
  [P in K]: V
}

const map: Record<string, number> = { a: 1, b: 2 }
const weeks: Record<'Mon' | 'Tue' | 'Wed', number> = { Mon: 1, Tue: 2, Wed: 3 }
```

### 5.6 Exclude / Extract

```ts
// Exclude — 排除联合类型中的某些成员
type MyExclude<T, U> = T extends U ? never : T

type T1 = Exclude<'a' | 'b' | 'c', 'a'>  // 'b' | 'c'

// Extract — 提取联合类型中的某些成员
type MyExtract<T, U> = T extends U ? T : never

type T2 = Extract<string | number | boolean, string | boolean>  // string | boolean
```

### 5.7 ReturnType / Parameters

```ts
// 你已经手写过——用 infer 推导
type MyReturnType<T> = T extends (...args: any[]) => infer R ? R : never
type MyParameters<T> = T extends (...args: infer P) => any ? P : never

function greet(name: string, age: number): string { return '' }
type R = ReturnType<typeof greet>      // string
type P = Parameters<typeof greet>      // [string, number]
```

---

## 六、类型守卫（Type Guards）

### 6.1 typeof

```ts
function padLeft(value: string | number) {
  if (typeof value === 'string') {
    return value.padStart(10, ' ')  // 类型收窄为 string
  }
  return ' '.repeat(value) + value  // 类型收窄为 number
}
```

### 6.2 instanceof

```ts
class Cat { meow() {} }
class Dog { bark() {} }

function speak(animal: Cat | Dog) {
  if (animal instanceof Cat) {
    animal.meow()
  } else {
    animal.bark()
  }
}
```

### 6.3 in 操作符

```ts
interface Fish { swim(): void }
interface Bird { fly(): void }

function move(animal: Fish | Bird) {
  if ('swim' in animal) {
    animal.swim()
  } else {
    animal.fly()
  }
}
```

### 6.4 自定义类型谓词（is）

```ts
// 关键字 is — 类型谓词
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function process(value: unknown) {
  if (isString(value)) {
    value.toUpperCase()  // 这里 TS 知道 value 是 string
  }
}

// 实战：判断是不是某个特定结构
function isUser(obj: any): obj is User {
  return obj && typeof obj.name === 'string' && typeof obj.age === 'number'
}
```

---

## 七、类型断言 vs 类型守卫

```ts
const value: unknown = 'hello'

// 类型断言 — 你告诉 TS "我比你更懂"
const len1 = (value as string).length
// ⚠️ 危险：如果 value 不是 string，运行时崩溃

// 类型守卫 — TS 帮你证明
if (typeof value === 'string') {
  const len2 = value.length  // 安全
}
```

**面试话术：** "类型断言是开发者主动声明，TS 不会校验——危险。类型守卫是让 TS 在运行时验证后才收窄类型——安全。能用守卫就不要用断言，断言只在 TS 推断不出来但你确信类型时用。"

---

## 八、声明文件（.d.ts）

### 8.1 给 JS 库写声明

```ts
// jquery.d.ts — 给没有 TS 类型的库补声明
declare function $(selector: string): HTMLElement
declare namespace $ {
  function ajax(config: { url: string; method?: string }): Promise<any>
}

// 使用
$('div').addEventListener('click', () => {})
$.ajax({ url: '/api', method: 'GET' })
```

### 8.2 模块声明

```ts
// 声明一个虚拟模块（如 import '*.css'）
declare module '*.css' {
  const classes: { [key: string]: string }
  export default classes
}

// 声明一个 .vue 文件
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

### 8.3 全局变量声明

```ts
// global.d.ts
declare global {
  interface Window {
    __POWERED_BY_WUJIE__: boolean  // 你的微前端项目里就有这个
    $wujie: {
      props: any
      bus: { $on: Function; $emit: Function }
    }
  }
}

// 使用时不会报错
if (window.__POWERED_BY_WUJIE__) { ... }
```

---

## 九、函数重载

```ts
// 重载签名（多个）
function greet(name: string): string
function greet(names: string[]): string[]

// 实现签名（兼容所有重载）
function greet(name: string | string[]): string | string[] {
  if (typeof name === 'string') {
    return `Hello, ${name}`
  }
  return name.map(n => `Hello, ${n}`)
}

// 调用
greet('Alice')        // string
greet(['A', 'B'])     // string[]
```

**面试重点：** 重载时实现签名对外不可见——只能用重载签名调用。

---

## 十、协变与逆变（高级）

**这题不常见，但被问到能答出来非常加分。**

```ts
// 协变（Covariant）：子类型可以赋值给父类型
class Animal { name: string }
class Dog extends Animal { bark(): void }

let a: Animal = new Dog()  // ✅ Dog 是 Animal 的子类型

// 函数返回值是协变的
type Producer<T> = () => T
let p1: Producer<Dog> = () => new Dog()
let p2: Producer<Animal> = p1  // ✅ Producer<Dog> 可以赋给 Producer<Animal>

// 函数参数是逆变的
type Consumer<T> = (arg: T) => void
let c1: Consumer<Animal> = (a: Animal) => {}
let c2: Consumer<Dog> = c1  // ✅ Consumer<Animal> 可以赋给 Consumer<Dog>
// 反过来：let c2: Consumer<Animal> = cDogFunc ❌ 不安全
```

**通俗解释：** 函数参数用父类型的地方，传一个能处理父类型的函数是安全的（"能处理动物的函数"一定能处理"狗"）。函数返回值用子类型的地方，返回一个更具体的子类型是安全的（"需要动物"的地方给"狗"也行）。

---

## 十一、枚举

### 11.1 数字枚举 vs 字符串枚举

```ts
// 数字枚举（默认）
enum Direction { Up, Down, Left, Right }
const d: Direction = Direction.Up  // 0

// 字符串枚举（推荐 — 可读性好）
enum Direction {
  Up = 'UP',
  Down = 'DOWN',
  Left = 'LEFT',
  Right = 'RIGHT'
}
console.log(Direction.Up)  // 'UP'
```

### 11.2 const enum — 编译时消除

```ts
const enum Color { Red, Green, Blue }

const c = Color.Red
// 编译后：const c = 0  ← 直接替换为字面量，没有 Color 对象

// 普通 enum 编译后会生成实际对象，const enum 不会
```

**面试重点：** `const enum` 在编译时被完全替换为字面量，运行时不存在；普通 enum 编译后会生成可双向映射的对象。

---

## 十二、type vs enum 代替枚举

```ts
// 现代推荐：用 union type 代替 enum
type Direction = 'up' | 'down' | 'left' | 'right'

function move(d: Direction) { ... }
move('up')  // 自动补全 + 拼写错误时编译报错
```

**优势：** 比 enum 更轻量，编译后不存在，bundle 体积更小。但失去 enum 的反向映射能力（`Direction[0]` 这种）。

---

## 十三、strict 模式

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,            // 总开关，开启以下所有：
    "noImplicitAny": true,     // 禁止隐式 any
    "strictNullChecks": true,  // 严格 null 检查
    "strictFunctionTypes": true,
    "strictBindCallApply": true,
    "strictPropertyInitialization": true,
    "noImplicitThis": true,
    "alwaysStrict": true
  }
}
```

**面试话术：** "项目必须开 strict。strictNullChecks 让 undefined/null 不能赋给其他类型，逼你显式处理边界。noImplicitAny 杜绝 JS 风格的隐式 any——所有 any 必须显式声明，逼开发者要么写清楚类型，要么用 unknown。"

---

## 十四、面试速查

| 问题 | 要点 |
|------|------|
| interface vs type | interface 描述形状+声明合并；type 描述任意类型 |
| keyof T 是什么 | 取 T 的所有 key 的联合类型 |
| infer 干嘛的 | 在条件类型里反向推导某个位置的类型 |
| Partial 实现原理 | `[K in keyof T]?: T[K]` 映射类型 |
| Pick vs Omit | Pick 选部分 key；Omit 排除部分 key |
| 类型守卫有几种 | typeof / instanceof / in / is 谓词 |
| 断言 vs 守卫 | 断言开发者声明（危险）；守卫 TS 验证（安全） |
| 协变逆变 | 协变：子类型 → 父类型；逆变：父类型 → 子类型（函数参数） |
| const enum vs enum | const enum 编译时消除；普通 enum 编译为对象 |
| 什么时候用 unknown | 代替 any——必须先类型守卫才能用 |
