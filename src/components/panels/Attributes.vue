<script setup lang="ts">
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import NumberInput from './NumberInput.vue'

  const sceneStore = useSceneStore()

  type TransformKey = 'position' | 'rotation' | 'scale'

  function updateTransform(key: TransformKey, axis: 0 | 1 | 2, value: number | null) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    const current = sceneStore.currentObjectData?.transform[key] ?? [0, 0, 0]
    const next = [...current] as [number, number, number]
    next[axis] = Number(value ?? 0)
    sceneStore.updateSceneObjectData(id, { transform: { [key]: next } } as any)
  }

  function updateVisible(visible: boolean) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    sceneStore.updateSceneObjectData(id, { visible } as any)
  }

  function updateFrustumCulled(frustumCulled: boolean) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    sceneStore.updateSceneObjectData(id, { frustumCulled } as any)
  }

  function setHorizontalRotation() {
    const id = sceneStore.selectedObjectId
    if (!id) return
    const current = sceneStore.currentObjectData?.transform.rotation ?? [0, 0, 0]
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
    sceneStore.updateSceneObjectData(id, { transform: { rotation: nextRotation } } as any)
  }
</script>

<template>
  <span>属性面板</span>
  <br />
  <br />
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
    <n-flex class="n-flex" vertical>
      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">
          ID
        </n-gi>
        <n-gi class="gid-item" :span="6">
          <n-input :value="sceneStore.currentObjectData?.id" type="text" placeholder="ID" disabled />
        </n-gi>
      </n-grid>
      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">
          类型
        </n-gi>
        <n-gi class="gid-item" :span="6">
          <n-input :value="sceneStore.currentObjectData?.type" type="text" placeholder="类型" disabled />
        </n-gi>
      </n-grid>

      <br />
      <!-- 位置 -->
      <n-grid x-gap="6" :cols="11">
        <n-gi class="gid-item" :span="2">
          位置
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="X"
            :value="sceneStore.currentObjectData?.transform.position[0]"
            @update:value="(v:number | null) => updateTransform('position', 0, v ?? 0)"
            :step="0.1"
            :min="-1000"
            :max="1000"
            :precision="3"
          />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="Y"
            :value="sceneStore.currentObjectData?.transform.position[1]"
            @update:value="(v:number | null) => updateTransform('position', 1, v ?? 0)"
            :step="0.1"
            :min="-1000"
            :max="1000"
            :precision="3"
          />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="Z"
            :value="sceneStore.currentObjectData?.transform.position[2]"
            @update:value="(v:number | null) => updateTransform('position', 2, v ?? 0)"
            :step="0.1"
            :min="-1000"
            :max="1000"
            :precision="3"
          />
        </n-gi>
      </n-grid>

      <br />
      <!-- 旋转 -->
      <n-grid x-gap="6" :cols="11">
        <n-gi class="gid-item" :span="2">
          旋转
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="X"
            :value="sceneStore.currentObjectData?.transform.rotation[0]"
            @update:value="(v:number | null) => updateTransform('rotation', 0, v ?? 0)"
            :step="0.1"
            :min="-Math.PI * 4"
            :max="Math.PI * 4"
            :precision="3"
          />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="Y"
            :value="sceneStore.currentObjectData?.transform.rotation[1]"
            @update:value="(v:number | null) => updateTransform('rotation', 1, v ?? 0)"
            :step="0.1"
            :min="-Math.PI * 4"
            :max="Math.PI * 4"
            :precision="3"
          />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="Z"
            :value="sceneStore.currentObjectData?.transform.rotation[2]"
            @update:value="(v:number | null) => updateTransform('rotation', 2, v ?? 0)"
            :step="0.1"
            :min="-Math.PI * 4"
            :max="Math.PI * 4"
            :precision="3"
          />
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
        <n-gi class="gid-item" :span="2">
          缩放
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="X"
            :value="sceneStore.currentObjectData?.transform.scale[0]"
            @update:value="(v:number | null) => updateTransform('scale', 0, v ?? 1)"
            :step="0.1"
            :min="0"
            :max="100"
            :precision="3"
          />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="Y"
            :value="sceneStore.currentObjectData?.transform.scale[1]"
            @update:value="(v:number | null) => updateTransform('scale', 1, v ?? 1)"
            :step="0.1"
            :min="0"
            :max="100"
            :precision="3"
          />
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <NumberInput
            label="Z"
            :value="sceneStore.currentObjectData?.transform.scale[2]"
            @update:value="(v:number | null) => updateTransform('scale', 2, v ?? 1)"
            :step="0.1"
            :min="0"
            :max="100"
            :precision="3"
          />
        </n-gi>
      </n-grid>

      <br />
      <!-- 可见性 -->
      <n-grid x-gap="6" :cols="16">
        <n-gi class="gid-item" :span="4">
          可见
        </n-gi>
        <n-gi class="gid-item" :span="4">
          <n-switch
            :value="sceneStore.currentObjectData?.visible"
            @update:value="(v:boolean) => updateVisible(v)"
          />
        </n-gi>

        <n-gi class="gid-item" :span="5">
          视锥体剔除
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <n-switch
            :value="sceneStore.currentObjectData?.frustumCulled"
            @update:value="(v:boolean) => updateFrustumCulled(v)"
          />
        </n-gi>
      </n-grid>
      <br />
      <!-- 阴影 -->
      <n-grid x-gap="6" :cols="16">
        <n-gi class="gid-item" :span="4">
          投射阴影
        </n-gi>
        <n-gi class="gid-item" :span="4">
          <n-switch
            :value="sceneStore.currentObjectData?.castShadow"
            @update:value="(v:boolean) => sceneStore.updateSceneObjectData(sceneStore.selectedObjectId!, { castShadow: v } as any)"
          />
        </n-gi>

        <n-gi class="gid-item" :span="5">
          接收阴影
        </n-gi>
        <n-gi class="gid-item" :span="3">
          <n-switch
            :value="sceneStore.currentObjectData?.receiveShadow"
            @update:value="(v:boolean) => sceneStore.updateSceneObjectData(sceneStore.selectedObjectId!, { receiveShadow: v } as any)"
          />
        </n-gi>
      </n-grid>
      <br />
      <!-- 渲染顺序 -->
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">
          渲染顺序
        </n-gi>
        <n-gi class="gid-item" :span="7">
          <n-input-number
            placeholder="从低到高"
            :value="sceneStore.currentObjectData?.renderOrder"
            :validator="(x: number) => x >= 0"
            @update:value="(v:number) => sceneStore.updateSceneObjectData(sceneStore.selectedObjectId!, { renderOrder: v } as any)"
          />
        </n-gi>
      </n-grid>

      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">
          选中
        </n-gi>
        <n-gi class="gid-item" :span="7">
          <n-switch
            :value="sceneStore.currentObjectData?.selectable ?? true"
            @update:value="(v:boolean) => sceneStore.updateSceneObjectData(sceneStore.selectedObjectId!, { selectable: v } as any)"
          />
        </n-gi>
      </n-grid>
    </n-flex>
  </n-scrollbar>
</template>

<style scoped>
  .n-flex{
    padding-bottom: 5vw;
  }
  .gid-item {
    margin-block: auto;
    font-weight: bold;
    margin-right: 0.3vw;
  }
</style>
