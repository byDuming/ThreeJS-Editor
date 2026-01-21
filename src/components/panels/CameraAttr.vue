<script setup lang="ts">
  import { computed } from 'vue'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import type { CameraSettings } from '@/interfaces/sceneInterface'
  import NumberInput from './NumberInput.vue'

  const sceneStore = useSceneStore()
  const cameraSettings = computed(() => sceneStore.currentObjectData?.camera as CameraSettings | undefined)

  function updateCameraSettings(patch: Partial<CameraSettings>) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    const current = sceneStore.currentObjectData?.camera ?? {}
    sceneStore.updateSceneObjectData(id, { camera: { ...current, ...patch } } as any)
  }
</script>

<template>
  <span>相机属性</span>
  <br/>
  <br/>
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
    <n-flex class="n-flex" vertical>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">视角</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="cameraSettings?.fov ?? 50"
            @update:value="(v:number | null) => updateCameraSettings({ fov: v ?? 50 })"
            :step="0.1"
            :min="1"
            :max="180"
            :precision="2"
          />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">近裁剪</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="cameraSettings?.near ?? 0.01"
            @update:value="(v:number | null) => updateCameraSettings({ near: v ?? 0.01 })"
            :step="0.01"
            :min="0.001"
            :max="100"
            :precision="3"
          />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">远裁剪</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="cameraSettings?.far ?? 2000"
            @update:value="(v:number | null) => updateCameraSettings({ far: v ?? 2000 })"
            :step="1"
            :min="1"
            :max="100000"
            :precision="0"
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
    margin-bottom: 0.5vw;
  }
</style>
