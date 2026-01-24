<script setup lang="ts">
import { useSceneStore } from '@/stores/modules/useScene.store'
import { usePropertyBinding } from '@/composables/usePropertyBinding'
import { PropertyNumber, PropertySwitch } from './properties'

const sceneStore = useSceneStore()
const { updateBatch, getSelectedData } = usePropertyBinding()

/**
 * 设置水平旋转（将旋转角度对齐到 90 度倍数）
 */
function setHorizontalRotation() {
  const data = getSelectedData()
  if (!data) return

  const current = data.transform.rotation ?? [0, 0, 0]
  const snap = (value: number) => {
    const step = Math.PI / 2
    return Math.round(value / step) * step
  }
  const nextRotation: [number, number, number] = [
    snap(current[0]),
    snap(current[1]),
    snap(current[2])
  ]
  const xIsVertical = Math.abs(nextRotation[0]) === Math.PI / 2
  nextRotation[0] = xIsVertical ? 0 : -Math.PI / 2
  
  updateBatch({
    'transform.rotation[0]': nextRotation[0],
    'transform.rotation[1]': nextRotation[1],
    'transform.rotation[2]': nextRotation[2]
  })
}
</script>

<template>
  <span>属性面板</span>
  <br />
  <br />
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
    <n-flex class="n-flex" vertical>
      <!-- ID -->
      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">ID</n-gi>
        <n-gi class="gid-item" :span="6">
          <n-input :value="sceneStore.selectedObjectData?.id" type="text" placeholder="ID" disabled />
        </n-gi>
      </n-grid>

      <!-- 类型 -->
      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">类型</n-gi>
        <n-gi class="gid-item" :span="6">
          <n-input :value="sceneStore.selectedObjectData?.type" type="text" placeholder="类型" disabled />
        </n-gi>
      </n-grid>

      <br />

      <!-- 位置 -->
      <n-grid x-gap="6" :cols="11">
        <n-gi class="gid-item" :span="2">位置</n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.position[0]" label="X" :step="0.1" :min="-1000" :max="1000" />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.position[1]" label="Y" :step="0.1" :min="-1000" :max="1000" />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.position[2]" label="Z" :step="0.1" :min="-1000" :max="1000" />
        </n-gi>
      </n-grid>

      <br />

      <!-- 旋转 -->
      <n-grid x-gap="6" :cols="11">
        <n-gi class="gid-item" :span="2">旋转</n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.rotation[0]" label="X" :step="0.1" :min="-Math.PI * 4" :max="Math.PI * 4" />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.rotation[1]" label="Y" :step="0.1" :min="-Math.PI * 4" :max="Math.PI * 4" />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.rotation[2]" label="Z" :step="0.1" :min="-Math.PI * 4" :max="Math.PI * 4" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="11">
        <n-gi class="gid-item" :span="2"></n-gi>
        <n-gi class="gid-item" :span="9">
          <n-button size="tiny" @click="setHorizontalRotation">水平</n-button>
        </n-gi>
      </n-grid>

      <br />

      <!-- 缩放 -->
      <n-grid x-gap="6" :cols="11">
        <n-gi class="gid-item" :span="2">缩放</n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.scale[0]" label="X" :step="0.1" :min="0" :max="100" :default-value="1" />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.scale[1]" label="Y" :step="0.1" :min="0" :max="100" :default-value="1" />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertyNumber path="transform.scale[2]" label="Z" :step="0.1" :min="0" :max="100" :default-value="1" />
        </n-gi>
      </n-grid>

      <br />

      <!-- 可见性 -->
      <n-grid x-gap="6" :cols="16">
        <n-gi class="gid-item" :span="4">可见</n-gi>
        <n-gi class="gid-item" :span="4">
          <PropertySwitch path="visible" :default-value="true" />
        </n-gi>
        <n-gi class="gid-item" :span="5">视锥体剔除</n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertySwitch path="frustumCulled" :default-value="true" />
        </n-gi>
      </n-grid>

      <br />

      <!-- 阴影 -->
      <n-grid x-gap="6" :cols="16">
        <n-gi class="gid-item" :span="4">投射阴影</n-gi>
        <n-gi class="gid-item" :span="4">
          <PropertySwitch path="castShadow" :default-value="false" />
        </n-gi>
        <n-gi class="gid-item" :span="5">接收阴影</n-gi>
        <n-gi class="gid-item" :span="3">
          <PropertySwitch path="receiveShadow" :default-value="false" />
        </n-gi>
      </n-grid>

      <br />

      <!-- 渲染顺序 -->
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">渲染顺序</n-gi>
        <n-gi class="gid-item" :span="7">
          <n-input-number
            placeholder="从低到高"
            :value="sceneStore.selectedObjectData?.renderOrder"
            :validator="(x: number) => x >= 0"
            @update:value="(v:number) => sceneStore.updateSceneObjectData(sceneStore.selectedObjectId!, { renderOrder: v } as any)"
          />
        </n-gi>
      </n-grid>

      <!-- 可选中 -->
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">选中</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertySwitch path="selectable" :default-value="true" />
        </n-gi>
      </n-grid>
    </n-flex>
  </n-scrollbar>
</template>

<style scoped>
.n-flex {
  padding-bottom: 5vw;
}
.gid-item {
  margin-block: auto;
  font-weight: bold;
  margin-right: 0.3vw;
}
</style>
