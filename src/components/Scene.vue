<script setup lang="ts">
  import { onMounted, watch } from 'vue'
  import { useRenderer } from '@/composables/useRenderer'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { sceneApi } from '@/services/sceneApi'
  import { useDialog, useNotification, useMessage } from 'naive-ui'

  /**
   * 3D 视图容器组件：
   * - 负责把 three.js 渲染 canvas 挂载到 DOM（#mainContainer）
   * - 初始化通知 / 对话框注入到 sceneStore，供全局操作使用（保存成功 / 删除确认等）
   * - 调用 useRenderer 初始化 three 场景和渲染器
   * - 统一处理场景数据加载（从 URL 参数或默认场景）
   */

  const props = defineProps<{
    sceneId?: number | null
  }>()

  const sceneStore = useSceneStore()
  const message = useMessage()
  const { container, initSceneBackground, captureScreenshot } = useRenderer()
  // container 在模板中使用 ref="container"
  // @ts-ignore - Vue 模板中的 ref 绑定，TypeScript 无法识别
  void container

  /**
   * 加载指定场景数据
   */
  async function loadSceneById(id: number) {
    try {
      const sceneData = await sceneApi.getSceneById(id)
      if (sceneData && sceneData.id) {
        // 设置当前场景ID
        sceneStore.currentSceneId = sceneData.id
        // 加载场景数据到 store
        sceneStore.name = sceneData.name
        sceneStore.version = sceneData.version
        sceneStore.aIds = sceneData.aIds
        sceneStore.rendererSettings = {
          ...sceneStore.rendererSettings,
          ...(sceneData.rendererSettings ?? {})
        }
        sceneStore.assets = (sceneData.assets ?? []) as any[]
        sceneStore.objectDataList = sceneData.objectDataList ?? []
        
        // 同步数据到 three.js
        if (sceneStore.threeScene) {
          sceneStore.setThreeScene(sceneStore.threeScene)
        }
        
        // 清空历史栈并标记场景准备就绪
        sceneStore.historyManager.clear()
        sceneStore.isSceneReady = true
        message.success('场景加载成功')
        return true
      } else {
        message.warning('场景不存在，已加载默认场景')
        return false
      }
    } catch (error) {
      console.error('加载场景失败:', error)
      message.error('加载场景失败，已加载默认场景')
      return false
    }
  }

  /**
   * 初始化场景（统一入口）
   */
  async function initializeScene() {
    // 先初始化渲染器和场景背景（这会创建 threeScene）
    initSceneBackground()
    
    // 根据是否有 sceneId 决定加载方式
    if (props.sceneId) {
      const loaded = await loadSceneById(props.sceneId)
      if (!loaded) {
        // 加载失败，回退到默认场景
        sceneStore.currentSceneId = null
        await sceneStore.initScene()
      }
    } else {
      // 没有指定场景ID，加载默认场景
      sceneStore.currentSceneId = null
      await sceneStore.initScene()
    }
  }

  // 监听 sceneId 变化，支持动态切换场景
  watch(() => props.sceneId, async (newId, oldId) => {
    // 只在 sceneId 真正变化时处理（排除初始化）
    if (newId !== oldId && oldId !== undefined) {
      if (newId) {
        const loaded = await loadSceneById(newId)
        if (!loaded) {
          sceneStore.currentSceneId = null
          await sceneStore.initScene()
        }
      } else {
        sceneStore.currentSceneId = null
        await sceneStore.initScene()
      }
    }
  })

  onMounted(async () => {
    // 注入通知和对话框到 store，供全局使用
    sceneStore.notification = useNotification()
    sceneStore.dialogProvider = useDialog()
    
    // 设置截图函数到 store，供 saveScene 使用
    sceneStore.setCaptureScreenshotFn(captureScreenshot)
    
    // 初始化场景
    await initializeScene()
  })
</script>

<template>
  <div id="mainContainer" ref="container"></div>
</template>

<style scoped>
  #mainContainer {
    width: 100%;
    height: 100%;
  }
</style>
