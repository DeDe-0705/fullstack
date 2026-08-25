<script setup lang="ts">
// 生成 10000 条测试数据，用来观察 vxe-table 在 wujie（Shadow DOM）下的虚拟滚动表现
const TOTAL = 10000

const tableData = Array.from({ length: TOTAL }, (_, i) => ({
  id: i + 1,
  name: `用户 ${i + 1}`,
  email: `user${i + 1}@example.com`,
  dept: `部门 ${(i % 20) + 1}`,
  status: i % 3 === 0 ? "在职" : i % 3 === 1 ? "休假" : "离职",
}))
</script>

<template>
  <div class="vxe-demo">
    <header class="vxe-header">
      <h1>VxeTable 虚拟滚动</h1>
      <p>共 {{ TOTAL }} 条数据，开启 virtual-y 虚拟滚动，实际渲染的 DOM 行数恒定</p>
    </header>

    <vxe-table
      border
      show-overflow
      height="500"
      :data="tableData"
      :scroll-y="{ enabled: true }"
      :virtual-y-config="{ enabled: true, gt: 100 }"
    >
      <vxe-column type="seq" title="序号" width="70" />
      <vxe-column field="id" title="ID" width="90" />
      <vxe-column field="name" title="姓名" />
      <vxe-column field="email" title="邮箱" />
      <vxe-column field="dept" title="部门" width="120" />
      <vxe-column field="status" title="状态" width="90" />
    </vxe-table>
  </div>
</template>

<style scoped>
.vxe-demo {
  padding: 16px;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.vxe-header {
  margin-bottom: 16px;
}

.vxe-header h1 {
  font-size: 20px;
  margin: 0 0 4px;
}

.vxe-header p {
  color: #646a73;
  font-size: 13px;
  margin: 0;
}
</style>
