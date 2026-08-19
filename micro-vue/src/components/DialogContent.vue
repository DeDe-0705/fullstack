<template>
  <div class="dialog-content">
    <p>弹窗内容（异步加载）</p>
    <p class="hint">
      由 defineAsyncComponent + Suspense 加载：每次打开都会先显示 fallback， 约
      0.8s 后渲染真实内容
    </p>
    <button @click="emit('close')">关闭</button>
  </div>
</template>

<script lang="ts" setup>
const emit = defineEmits(["close"]);

// 顶层 await 使本组件成为 Suspense 的异步依赖：
// Suspense 会等待它 resolve 后才渲染真实内容，等待期间显示 fallback
await new Promise((resolve) => setTimeout(resolve, 800));
</script>

<style scoped>
.dialog-content p {
  margin-bottom: 8px;
}
.hint {
  color: #646a73;
  font-size: 12px;
  margin-bottom: 16px;
}
.dialog-content button {
  padding: 6px 14px;
  border: 1px solid #d0d3d6;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.dialog-content button:hover {
  border-color: #3370ff;
  color: #3370ff;
}
</style>
