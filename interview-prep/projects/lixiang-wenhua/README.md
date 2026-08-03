# 理想文化 — 面试要点

> 项目时间：2025.02 - 2025.03 | 角色：项目 Owner
> 技术栈：Vue3 + TypeScript + 瀑布流布局 + 百度云 BOS 分片上传 + xgplayer
> 组件库：PC 端用公司组件库（基于 Element Plus 封装），移动端用 Vant

---

## 一、项目一句话介绍

> "理想文化是理想汽车企业文化宣贯平台，员工可上传图片/视频分享践行价值观的工作实践。我负责瀑布流布局、大文件上传、视频播放组件等核心能力建设。"

---

## 二、项目背景与核心挑战

```
业务定位：
  - 员工 UGC 图片分享平台
  - 企业文化传播核心项目
  - 支持点赞、评论、转发等社交互动

技术挑战：
  1. UGC 内容列表：图片尺寸不一，如何优雅展示？
  2. 大文件上传：视频几百 MB，如何保证稳定上传？
  3. 视频播放：需要定制 UI 和交互，满足公司设计规范
```

---

## 三、核心能力建设

### 3.1 瀑布流布局

**问题：** UGC 内容列表主要是图片，用户上传的图片尺寸不一，如何优雅展示？

**方案：** **Absolute 定位 + 动态计算位置 + 移动动画过渡**——固定两种比例（4:3 横图、3:4 竖图），图片取中间区域裁剪；JS 计算每个 item 的位置，用 CSS `transition` 实现位置变化的平滑动画

```vue
<!-- components/WaterfallList.vue（精简示意） -->
<template>
  <div class="waterfall-container" ref="containerRef">
    <div
      v-for="item in items"
      :key="item.id"
      class="waterfall-item"
      :class="{ 'is-vertical': item.ratio === '3:4' }"
      :style="{
        transform: `translate(${item.x}px, ${item.y}px)`,
        transition: 'transform 0.3s ease',
      }"
    >
      <!-- 图片：渐进式加载，先低清占位，可见时替换高清 -->
      <div class="image-wrapper">
        <img
          :src="item.lowQualityCover"
          :data-src="item.cover"
          :alt="item.title"
          class="progressive-image"
        />
      </div>

      <!-- 内容信息 -->
      <div class="item-info">
        <div class="title">{{ item.title }}</div>
        <div class="meta">
          <span class="author">{{ item.author }}</span>
          <span class="likes">❤️ {{ item.likeCount }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";

const props = defineProps<{ items: WaterfallItem[] }>();

const containerRef = ref<HTMLElement>();
const columnCount = ref(3);
const columnWidth = 300;
const gap = 16;
const columnHeights = ref<number[]>([]);

let imageObserver: IntersectionObserver | null = null;

// 计算每个 item 的位置：新 item 放到最短的列
function layout() {
  columnHeights.value = Array(columnCount.value).fill(0);

  props.items.forEach((item) => {
    const minHeight = Math.min(...columnHeights.value);
    const columnIndex = columnHeights.value.indexOf(minHeight);

    item.x = columnIndex * (columnWidth + gap);
    item.y = minHeight;

    const imageHeight =
      item.ratio === "3:4"
        ? columnWidth * (4 / 3) // 竖图 3:4
        : columnWidth * (3 / 4); // 横图 4:3
    columnHeights.value[columnIndex] += imageHeight + 80 + gap; // 80 为信息区高度
  });

  nextTick(() => observeImages());
}

// 图片渐进式加载：进入视口时加载高清图并替换
function observeImages() {
  const images =
    containerRef.value?.querySelectorAll(".progressive-image") ?? [];
  images.forEach((img) => imageObserver?.observe(img));
}

onMounted(() => {
  imageObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const img = entry.target as HTMLImageElement;
        const src = img.dataset.src;
        if (src && img.src !== src) {
          const preload = new Image();
          preload.src = src;
          preload.onload = () => {
            img.src = src; // 高清图加载完成后再替换，避免白屏
            img.classList.add("loaded"); // 触发模糊 -> 清晰过渡
          };
        }
        imageObserver?.unobserve(img);
      });
    },
    { rootMargin: "50px" },
  ); // 提前 50px 开始加载

  updateColumnCount();
  layout();
  window.addEventListener("resize", updateColumnCount);
});

onUnmounted(() => {
  window.removeEventListener("resize", updateColumnCount);
  imageObserver?.disconnect();
});

function updateColumnCount() {
  if (!containerRef.value) return;
  const w = containerRef.value.offsetWidth;
  columnCount.value = w >= 1024 ? 4 : w >= 768 ? 3 : 2; // PC 4列 / 平板 3列 / 移动端 2列
  nextTick(() => layout());
}

watch(
  () => props.items.length,
  () => nextTick(() => layout()),
);
</script>

<style scoped>
.waterfall-container {
  position: relative;
  padding: 16px;
}

.waterfall-item {
  position: absolute; /* 绝对定位，transform 定位 + 过渡动画在模板绑定 */
  width: 300px;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* 图片容器：固定比例，取中间区域裁剪 */
.image-wrapper {
  width: 100%;
  aspect-ratio: 4 / 3; /* 默认横图 */
  overflow: hidden;
}
.waterfall-item.is-vertical .image-wrapper {
  aspect-ratio: 3 / 4; /* 竖图 */
}
.image-wrapper img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

/* 渐进式加载：低清模糊 -> 高清清晰 */
.progressive-image:not(.loaded) {
  filter: blur(5px);
}
.progressive-image.loaded {
  filter: blur(0);
  transition: filter 0.3s ease;
}
</style>
```

**核心逻辑：**

1. **固定比例**：图片只有 4:3（横图）和 3:4（竖图）两种比例，`aspect-ratio` + `object-fit: cover` 取中间区域裁剪
2. **动态计算位置**：维护一个 `columnHeights` 数组记录每列当前高度，新 item 放到最短的列，计算 `x/y` 坐标
3. **Absolute 定位**：每个 item 通过 `position: absolute` + `transform: translate(x, y)` 定位
4. **移动动画**：`transition: transform 0.3s ease` 实现位置变化的平滑过渡——当新内容插入或窗口 resize 时，已有 item 会平滑移动到新位置
5. **渐进式加载**：图片先加载低清占位图，进入视口时通过 `data-src` 加载高清图并替换（详见 3.4）

**面试追问：为什么不用 CSS Grid/Flexbox？**

> "三个原因：1) **动画需求**：业务要求新内容插入时，已有 item 要有平滑的移动动画——CSS Grid/Flexbox 是文档流布局，位置变化是瞬时的，无法实现平滑过渡；2) **精确控制**：Absolute 定位可以精确计算每个 item 的位置，实现真正的瀑布流（最短列优先）；3) **性能可控**：用 `transform` 而非 `top/left`，触发 GPU 加速，动画更流畅。代价是需要 JS 计算位置，但固定比例让计算逻辑很简单。"

### 3.2 大文件分片上传

**问题：** 视频文件几百 MB，如何保证稳定上传？

**方案：** 基于**百度云 BOS 对象存储**的 JavaScript SDK（`@baiducloud/sdk`）做分片上传——SDK 不会自动分片，需要按 BOS 的 Multipart Upload 三段式 API 手动编排：前端自己切片、控制并发，逐片上传，最后合并

```typescript
// utils/bosUpload.ts（精简示意）
import { BosClient } from "@baiducloud/sdk";

const client = new BosClient({
  credentials: { ak, sk }, // 临时凭证，由后端下发
  endpoint: "https://bj.bcebos.com",
});

const PART_SIZE = 5 * 1024 * 1024; // 每片 5MB
const CONCURRENT = 3; // 并发 3 片

export async function uploadToBOS(
  bucket: string,
  key: string,
  file: File,
  onProgress?: (p: number) => void,
) {
  // 1. 初始化分片上传，拿到 uploadId
  const { body } = await client.initiateMultipartUpload(bucket, key);
  const uploadId = body.uploadId;

  // 2. 切片并并发上传（uploadPartFromBlob），记录每片 eTag
  const partCount = Math.ceil(file.size / PART_SIZE);
  const partList: { partNumber: number; eTag: string }[] = [];

  const tasks = Array.from({ length: partCount }, (_, i) => i + 1);
  const queue = [...tasks];
  await Promise.all(
    Array(CONCURRENT)
      .fill(null)
      .map(async () => {
        while (queue.length) {
          const partNumber = queue.shift()!;
          const start = (partNumber - 1) * PART_SIZE;
          const blob = file.slice(start, start + PART_SIZE);
          const res = await client.uploadPartFromBlob(
            bucket,
            key,
            uploadId,
            partNumber,
            PART_SIZE,
            blob,
          );
          partList.push({ partNumber, eTag: res.http_headers.etag });
          onProgress?.((partList.length / partCount) * 100);
        }
      }),
  );

  // 3. 全部分片完成后，按 partNumber 排序提交合并
  partList.sort((a, b) => a.partNumber - b.partNumber);
  await client.completeMultipartUpload(bucket, key, uploadId, partList);
}
```

**核心逻辑：**

1. **三段式 API**：`initiateMultipartUpload`（拿 uploadId）→ `uploadPartFromBlob`（浏览器端逐片上传，记录 eTag）→ `completeMultipartUpload`（提交 partList 由 BOS 服务端合并）
2. **前端自己切片**：`file.slice()` 按 5MB 切片，并发数自己控制（如 3），失败的分片单独重试——SDK 不替你切片
3. **断点续传**：基于 `listParts(uploadId)` 查询已上传的分片，跳过已完成的，只传缺失的；中途放弃可调 `abortMultipartUpload` 清理
4. **uploadId 是续传关键**：上传中断后重新发起时，用同一个 uploadId 续传而不是重新初始化

**面试追问：为什么用 BOS 而不是完全自己实现分片上传？**

> "三个原因：1) **分片合并和存储是服务端重活**：BOS 的 Multipart Upload 是存储服务端原生能力，合并、完整性校验、临时分片存储都由 BOS 保证，自己实现需要后端开发 check/merge 接口和临时存储；2) **稳定性**：BOS 有 SLA 保障，上传链路走 CDN 加速；3) **前端依然保留了工程能力体现**：切片、并发控制、失败重试、断点续传这些核心逻辑还是前端自己做的，SDK 只是替我们完成了与 BOS 服务端的协议交互。面试时可以讲清楚三段式流程和续传原理。"

**面试追问：断点续传怎么实现？**

> "基于 uploadId：1) 上传前记录 uploadId 和已上传分片（本地存储或后端记录）；2) 重新上传时用 `listParts(uploadId)` 查询 BOS 上该任务已上传的分片编号和 eTag；3) 只上传缺失的分片；4) 全部完成后调 `completeMultipartUpload` 合并。即使刷新页面，只要拿到原 uploadId 就能续传。"

### 3.3 定制视频播放组件

**问题：** 需要符合公司设计规范，支持点赞、评论、转发

**方案：** 基于 xgplayer 二次封装

```vue
<!-- components/VideoPlayer.vue（精简示意） -->
<template>
  <div class="video-player-container">
    <div ref="playerRef" class="video-player" />

    <!-- 自定义控制栏：播放/暂停 + 点赞/评论/分享 -->
    <div class="custom-controls">
      <div class="left">
        <company-icon :name="playing ? 'pause' : 'play'" @click="togglePlay" />
        <span class="time">{{ currentTime }} / {{ duration }}</span>
      </div>
      <div class="right">
        <company-icon name="heart" :class="{ liked }" @click="onLike" />
        <company-icon name="comment" @click="showComments = true" />
        <company-icon name="share" @click="onShare" />
      </div>
    </div>

    <!-- 评论弹窗 -->
    <company-popup v-model:visible="showComments" position="bottom">
      <CommentList :video-id="videoId" />
    </company-popup>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import Player from "xgplayer";
import "xgplayer/dist/index.min.css";

const props = defineProps<{
  videoUrl: string;
  videoId: string;
  poster?: string;
}>();

const playerRef = ref<HTMLElement>();
const playing = ref(false);
const currentTime = ref("00:00");
const duration = ref("00:00");
const liked = ref(false);
const showComments = ref(false);

let player: Player | null = null;

onMounted(() => {
  player = new Player({
    el: playerRef.value!,
    url: props.videoUrl,
    poster: props.poster,
    controls: false, // 禁用默认控制栏，用自定义控制栏
    theme: "#ff6600",
    playsinline: true, // 移动端内联播放
  });

  player.on("play", () => (playing.value = true));
  player.on("pause", () => (playing.value = false));
  player.on(
    "timeupdate",
    () => (currentTime.value = formatTime(player.currentTime)),
  );
  player.on(
    "loadedmetadata",
    () => (duration.value = formatTime(player.duration)),
  );
});

onUnmounted(() => player?.destroy());

const togglePlay = () => (playing.value ? player?.pause() : player?.play());

async function onLike() {
  liked.value
    ? await unlikeVideo(props.videoId)
    : await likeVideo(props.videoId);
  liked.value = !liked.value;
}

function onShare() {
  navigator.share
    ? navigator.share({ title: "理想文化视频", url: location.href })
    : navigator.clipboard.writeText(location.href);
}
</script>
```

### 3.4 多端适配与性能优化

**主要针对 UGC 内容列表：多端主要是瀑布流列数响应式，性能主要是图片渐进式加载。**

```typescript
// components/WaterfallList.vue：根据屏幕宽度动态计算列数
function updateColumnCount() {
  if (!containerRef.value) return;
  const containerWidth = containerRef.value.offsetWidth;

  // PC：4列，平板：3列，移动端：2列
  if (containerWidth >= 1024) {
    columnCount.value = 4;
  } else if (containerWidth >= 768) {
    columnCount.value = 3;
  } else {
    columnCount.value = 2;
  }

  nextTick(() => layout());
}
```

**要点：**

1. **瀑布流列数响应式**：PC 4列、平板 3列、移动端 2列，根据容器宽度动态计算，窗口 resize 时重新布局
2. **图片渐进式加载**：先加载低清晰度占位图（几 KB）快速渲染页面轮廓，再用 `IntersectionObserver` 监听图片元素，进入视口时通过 `data-src` 预加载高清图并替换，避免白屏；低清图带模糊效果（`filter: blur`），高清加载完成后平滑过渡到清晰状态——移动端网络环境下体验明显更好

**渐进式加载实现：**

```typescript
// composables/useProgressiveImage.ts：图片渐进式加载
export function useProgressiveImage(containerRef: Ref<HTMLElement | undefined>) {
  let imageObserver: IntersectionObserver | null = null

  onMounted(() => {
    imageObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return

        const img = entry.target as HTMLImageElement
        const highQualitySrc = img.dataset.src

        if (highQualitySrc && img.src !== highQualitySrc) {
          // 创建新 Image 预加载高清图，加载完成后再替换，避免白屏
          const preload = new Image()
          preload.src = highQualitySrc
          preload.onload = () => {
            img.src = highQualitySrc
            img.classList.add('loaded')  // 触发 模糊 -> 清晰 过渡
          }
        }

        imageObserver?.unobserve(img)  // 替换后停止观察
      })
    }, { rootMargin: '50px' })  // 提前 50px 开始加载，滚动更顺滑

    observeImages()
  })

  // 观察容器内所有渐进式图片（新内容加载后需重新调用）
  function observeImages() {
    const images = containerRef.value?.querySelectorAll('.progressive-image') ?? []
    images.forEach((img) => imageObserver?.observe(img))
  }

  onUnmounted(() => imageObserver?.disconnect())

  return { observeImages }
}
```

```vue
<!-- 模板中使用：src 是低清占位图，data-src 是高清图 -->
<div class="image-wrapper">
  <img 
    :src="item.lowQualityCover"
    :data-src="item.cover"
    :alt="item.title"
    class="progressive-image"
  />
</div>

<style>
/* 低清模糊 -> 高清清晰过渡 */
.progressive-image:not(.loaded) { filter: blur(5px); }
.progressive-image.loaded { filter: blur(0); transition: filter 0.3s ease; }
</style>
```

**核心逻辑：**

1. **低清晰度占位**：初始加载低清晰度图（几 KB），快速渲染页面轮廓
2. **可见性检测**：用 `IntersectionObserver` 监听图片元素，进入视口时触发高清图加载（`rootMargin: 50px` 提前加载，滚动更顺滑）
3. **预加载替换**：创建新 `Image` 对象预加载高清图，加载完成后才替换 `src`——避免直接换 src 导致的白屏等待
4. **过渡动画**：低清图带 `filter: blur(5px)` 模糊效果，替换后加 `loaded` 类平滑过渡到清晰状态

**面试追问：为什么不用浏览器原生懒加载 `loading="lazy"`？**

> "原生懒加载只解决了'延迟加载'的问题，但没解决'渐进式加载'的体验问题。我们的方案：1) **首屏更快**：低清晰度图体积小，首屏渲染快；2) **体验更好**：用户先看到模糊的图片轮廓，再平滑过渡到清晰图，而不是从空白到清晰；3) **流量更省**：低清晰度图只有几 KB，高清图按需加载。原生懒加载可以作为补充，但渐进式加载是更完整的方案。"

---

## 四、高频面试题

### Q1: 瀑布流布局有哪些方案？为什么选 Absolute 定位？

> "三种方案：1) **Absolute 定位 + 动态计算位置**：可以实现真正的瀑布流（最短列优先），且支持平滑的移动动画（新内容插入时已有 item 平滑过渡到新位置）；2) **CSS Grid + 动态 span**：是文档流布局，位置变化是瞬时的，无法实现平滑动画；3) **CSS 多列布局**（column-count）：顺序是列优先，不符合阅读习惯。我们选 Absolute 定位，因为业务要求移动动画效果，且固定比例（4:3/3:4）让位置计算逻辑很简单。"

### Q2: 大文件上传是怎么做的？

> "基于百度云 BOS 对象存储的 JavaScript SDK（`@baiducloud/sdk`）做分片上传。SDK 不会自动分片，需要按 BOS 的 Multipart Upload 三段式 API 手动编排：`initiateMultipartUpload` 拿 uploadId → 前端自己 `file.slice()` 切片、控制并发调 `uploadPartFromBlob` 逐片上传并记录 eTag → 全部完成后 `completeMultipartUpload` 提交 partList 由 BOS 服务端合并。断点续传基于 uploadId——重新上传时用 `listParts(uploadId)` 查询已上传的分片，只传缺失的。选 BOS 是因为分片合并、临时存储这些服务端重活由 BOS 保证，而切片、并发、重试、续传这些工程逻辑还是前端自己掌控。"

### Q3: 分片上传的断点续传原理是什么？

> "三个关键：1) **uploadId 唯一标识**：`initiateMultipartUpload` 返回的 uploadId 代表一次上传任务，中断后凭它续传；2) **listParts 查进度**：重新上传时用 `listParts(uploadId)` 查询 BOS 上已上传的分片编号和 eTag，只传缺失的分片；3) **completeMultipartUpload 合并**：全部分片完成后提交 partList（partNumber + eTag），BOS 校验完整性后合并成完整文件。自己实现非 BOS 的分片上传也是同样的思路：文件 hash 唯一标识 + 服务端记录已传分片 + 合并接口。"

### Q4: 视频播放组件为什么要二次封装？

> "三个原因：1) 统一 UI：公司设计规范要求定制控制栏样式；2) 业务集成：需要集成点赞、评论、转发等社交功能；3) 多端兼容：移动端需要特殊处理（如 playsinline、禁用全屏）。基于 xgplayer 封装，屏蔽底层差异，业务方只需要传入 videoUrl 就能用。"

---

## 五、项目亮点总结

| 亮点           | 说明                                                                             | 面试价值                |
| -------------- | -------------------------------------------------------------------------------- | ----------------------- |
| 瀑布流布局     | Absolute 定位 + 动态计算位置 + 移动动画过渡（固定 4:3/3:4 比例）                 | 体现 CSS 功底和动画能力 |
| 图片渐进式加载 | 低清晰度占位 + IntersectionObserver 可见性检测 + 预加载替换                      | 体现性能优化思维        |
| 大文件分片上传 | 百度云 BOS Multipart Upload 三段式 API（initiate/uploadPart/complete）+ 断点续传 | 体现文件处理经验        |
| 视频播放组件   | xgplayer 二次封装 + 社交功能集成                                                 | 体现组件封装能力        |
