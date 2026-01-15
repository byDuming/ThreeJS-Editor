<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRoute } from 'vue-router'
  // 场景视图
  import Scene from '@/components/Scene.vue'
  // 左侧编辑面板
  import LeftEditPanel from '@/components/LeftEditPanel.vue'
  // 底部资产面板
  import BottomAssetPanel from '@/components/BottomAssetPanel.vue'

  const route = useRoute()

  // 分割比例（右侧属性面板宽度占比）
  const split = ref<number>(0.86)

  // 从 URL 获取场景ID，传递给 Scene 组件
  const sceneId = computed(() => {
    const id = route.query.sceneId
    return id ? Number(id) : null
  })
</script>

<template>
  <div class="engine-container">
    <NSplit v-model:watch-size="split" v-model:size="split">
      <!-- 左侧：场景 + 底部资产面板 -->
      <template #1>
        <div class="left-container">
          <div class="scene-area">
            <Scene :scene-id="sceneId" />
          </div>
          <BottomAssetPanel />
        </div>
      </template>
      <!-- 右侧：属性面板（不受底部面板影响） -->
      <template #2>
        <LeftEditPanel />
      </template>
    </NSplit>
  </div>
</template>

<style scoped>
.engine-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
}

.left-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.scene-area {
  flex: 1;
  overflow: hidden;
}
</style>
