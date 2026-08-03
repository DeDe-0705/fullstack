<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import MarkdownRender from "markstream-vue";
import "markstream-vue/index.css";
import { fullMarkdown } from "./sample";

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
