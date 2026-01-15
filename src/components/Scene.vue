<script setup lang="ts">
  import { onMounted, nextTick, watch } from 'vue'
  import { useRenderer } from '@/composables/useRenderer'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { useDialog, useNotification } from 'naive-ui'

  /**
   * 3D 视图容器组件：
   * - 负责把 three.js 渲染 canvas 挂载到 DOM（#mainContainer）
   * - 初始化通知 / 对话框注入到 sceneStore，供全局操作使用（保存成功 / 删除确认等）
   * - 调用 useRenderer 初始化 three 场景和渲染器
   */
  const sceneStore = useSceneStore()
  const { container, initSceneBackground } = useRenderer()
  // container 在模板中使用 ref="container"
  // @ts-expect-error - container 在模板中使用，TypeScript 无法识别
  void container

  // 监听 objectDataList 变化，当数据加载后同步到 three.js
  watch(() => sceneStore.objectDataList.length, async (length, oldLength) => {
    // 当数据从空变为有数据时，同步到 three.js
    if (length > 0 && oldLength === 0 && sceneStore.threeScene) {
      await nextTick()
      sceneStore.setThreeScene(sceneStore.threeScene)
    }
  })

  onMounted(async () => {
    sceneStore.notification = useNotification()
    sceneStore.dialogProvider = useDialog()
    
    // 先初始化渲染器和场景背景（这会创建 threeScene）
    initSceneBackground()
    
    await nextTick()
    
    // 如果已经有场景数据（从 URL 参数加载的），确保数据同步到 three.js
    if (sceneStore.objectDataList.length > 0 && sceneStore.threeScene) {
      // 等待一下确保 threeScene 已经被 initSceneBackground 创建
      await new Promise(resolve => setTimeout(resolve, 100))
      sceneStore.setThreeScene(sceneStore.threeScene)
    } else if (!sceneStore.currentSceneId) {
      // 没有数据且没有指定场景ID，加载默认场景
      await sceneStore.initScene().catch((e: any) => console.error('Scene init failed', e))
    }
  })
</script>

<template>
  <!-- <n-button @click="sceneStore.clearScene()" type="primary">
    释放内存
  </n-button> -->

  <div id="mainContainer" ref="container"></div>
</template>

<style scoped>
  #mainContainer {
    width: 100%;
    height: 100%;
  }
</style>
