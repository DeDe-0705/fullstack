<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import MarkdownRender from "markstream-vue";
import "markstream-vue/index.css";
import { fullMarkdown } from "./sample";
import GlobalModal from "./components/GlobalModal.vue";

const content = ref("");
const done = ref(false);

let timer: ReturnType<typeof setInterval> | undefined;
let cursor = 0;
const CHUNK_SIZE = 6;
const INTERVAL = 30;

// 模拟 LLM 流式输出：按固定节奏追加 token，展示 markstream 的流式渲染能力
function startStream() {
  content.value = "";
  done.value = false;
  cursor = 0;
  timer = setInterval(() => {
    cursor += CHUNK_SIZE;
    content.value = fullMarkdown.slice(0, cursor);
    if (cursor >= fullMarkdown.length) {
      done.value = true;
      clearInterval(timer);
    }
  }, INTERVAL);
}

const target = {
  name: "App",
  get fullName() {
    return this.name + "get";
  },
  say() {
    console.log("say: " + this.name);
  },
};

const proxyTarget = new Proxy(target, {
  get(target, prop, receiver) {
    console.log(`Getting property "${String(prop)}"`);
    console.log(receiver);
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    console.log(`Setting property "${String(prop)}" to "${value}"`);
    return Reflect.set(target, prop, value, receiver);
  },
});

function myNew(this: Function, ...args: any[]) {
  // 防御：箭头函数、普通对象等没有 [[Construct]] 的会在这里提前暴露
  if (typeof this !== "function") {
    throw new TypeError("Constructor is not a constructor");
  }

  // 第 1+2 步：创建空对象，并把原型链连到构造函数的 prototype
  // Object.create 等价于：obj = {}; obj.__proto__ = Constructor.prototype
  const obj = Object.create(this.prototype);

  // 第 3 步：执行构造函数，用 apply 把 this 绑定到新对象
  const result = this.apply(obj, args);

  // 第 4 步：返回值判定——对象/函数覆盖新对象，基本类型忽略
  return (typeof result === "object" && result !== null) ||
    typeof result === "function"
    ? result
    : obj;
}

Function.prototype.myBind = function (
  this: Function,
  context: any,
  ...args: any[]
) {
  const fn = this; // 当前this指向的函数
  const boundFn = function (this: Function, ...newArgs: any[]) {
    // 如果当前是new调用，this就指向实例对象，否则指向绑定的context
    return fn.apply(this instanceof boundFn ? this : context, [
      ...args,
      ...newArgs,
    ]);
  };
  // 接上fn的原型链
  if (fn.prototype) {
    boundFn.prototype = Object.create(fn.prototype);
  }
  return boundFn;
};

// const fn = function () {};
// fn.prototype.say = function () {
//   console.log("say");
// };
// const newFn = fn.myBind(null);

// const target = new newFn();
// target.say(); // 输出 "say"
// console.log(target instanceof newFn); // 输出 true
// console.log(Object.getPrototypeOf(target) === newFn.prototype); // 输出 true

const a = {
  name: "App",
  get fullName() {
    return this.name + "get";
  },
};

const b = ref(a);

// b.value.name = "b";
// console.log(b.value.fullName); // 输出 "bget"

watch(
  () => b.value.name,
  (newName) => {
    console.log("b.name changed to:", newName);
  },
  {
    flush: "post", // 确保在 DOM 更新前同步触发
  },
);

onMounted(startStream);
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>Markdown 渲染</h1>
      <p>Vue 3 子应用 · markstream-vue 流式渲染</p>
      <button class="replay" type="button" @click="startStream">
        重新播放
      </button>
    </header>
    <main class="content">
      <MarkdownRender
        mode="chat"
        :content="content"
        code-renderer="monaco"
        :final="done"
        :fade="false"
      />
    </main>
    <GlobalModal></GlobalModal>
  </div>
</template>

<style scoped>
.page {
  margin: 0 auto;
  padding: 12px;
  height: 100%;
  overflow: auto;
  box-sizing: border-box;
}

.header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 16px;
}

.header h1 {
  font-size: 20px;
}

.header p {
  color: #646a73;
  font-size: 13px;
  flex: 1;
}

.replay {
  padding: 6px 14px;
  border: 1px solid #d0d3d6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}

.replay:hover {
  border-color: #3370ff;
  color: #3370ff;
}

.content {
  background: #fff;
  border: 1px solid #e5e6eb;
  border-radius: 8px;
  padding: 24px;
}
</style>
