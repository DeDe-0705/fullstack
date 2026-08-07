<template>
  <button @click="show = true">打开弹窗</button>
  <!-- 传送至body标签下 -->
  <Teleport to="body">
    <!-- v-if控制销毁，推荐，配合过渡动画更友好 -->
    <div v-if="show" class="mask" @click.self="show = false">
      <div class="dialog">
        <!-- Suspense 边界：异步弹窗内容未加载完成时先渲染 fallback -->
        <Suspense>
          <AsyncDialogContent @close="show = false" />
          <template #fallback>
            <div class="loading">弹窗内容加载中…</div>
          </template>
        </Suspense>
      </div>
    </div>
  </Teleport>
</template>

<script lang="ts" setup>
import { defineAsyncComponent, ref } from "vue";

// 异步组件默认 suspensible：父链上有 <Suspense> 时，
// loading 状态交给 Suspense 统一管理（组件自身的 loading 选项会被忽略）
const AsyncDialogContent = defineAsyncComponent(
  () => import("./DialogContent.vue")
);

const show = ref(false);
</script>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  width: 400px;
  padding: 20px;
  background: #fff;
  border-radius: 8px;
}
.loading {
  padding: 12px 0;
  color: #646a73;
  font-size: 13px;
}
</style>
