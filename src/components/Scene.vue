<script setup lang="ts">
  import { onMounted, watch, watchEffect } from 'vue'
  import { useRenderer } from '@/composables/useRenderer'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { sceneApi } from '@/services/sceneApi'
  import { useDialog, useNotification, useMessage } from 'naive-ui'
  import { pluginManager } from '@/core'
  import { useAnimationStore } from '@/stores/modules/useAnimation.store'
  import { dialogOverlayPlugin } from '@/plugins/dialogOverlay.plugin'

  /**
   * 3D 视图容器组件：
   * - 负责把 three.js 渲染 canvas 挂载到 DOM
   * - 初始化通知 / 对话框注入到 sceneStore
   * - 统一处理场景数据加载和切换
   * 
   * 场景切换流程：
   * 1. 加载场景数据到 store (objectDataList, assets 等)
   * 2. 调用 useRenderer.switchScene() 完成 three.js 层的切换
   */

  const props = defineProps<{
    sceneId?: number | null
    mode?: 'preview' | 'edit'  // 预览模式 or 编辑模式
  }>()

  const sceneStore = useSceneStore()
  const animationStore = useAnimationStore()
  const message = useMessage()
  const { container, camera, init, switchScene, captureScreenshot } = useRenderer()
  
  // container 在模板中使用 ref="container"
  // @ts-ignore - Vue 模板中的 ref 绑定
  void container

  // 同步 mode prop 到 sceneStore.isEditMode
  watchEffect(() => {
    sceneStore.isEditMode = props.mode !== 'preview'
  })

  /**
   * 加载场景数据到 store（不涉及 three.js 层）
   */
  async function loadSceneData(id: number): Promise<boolean> {
    try {
      const sceneData = await sceneApi.getSceneById(id)
      if (!sceneData || !sceneData.id) {
        message.warning('场景不存在')
        return false
      }

      // 清理旧数据
      sceneStore.objectsMap.clear()
      sceneStore.objectDataList = []
      sceneStore.selectedObjectId = null

      // 加载新数据
      sceneStore.currentSceneId = sceneData.id
      sceneStore.name = sceneData.name
      sceneStore.version = sceneData.version
      sceneStore.aIds = sceneData.aIds
      sceneStore.rendererSettings = {
        ...sceneStore.rendererSettings,
        ...(sceneData.rendererSettings ?? {})
      }
      sceneStore.assets = (sceneData.assets ?? []) as any[]
      sceneStore.objectDataList = sceneData.objectDataList ?? []

      // 加载动画数据
      if (sceneData.animationData) {
        const { useAnimationStore } = await import('@/stores/modules/useAnimation.store')
        const animationStore = useAnimationStore()
        animationStore.setAnimationData(sceneData.animationData)
        console.log('[Scene] 已加载动画数据，剪辑数:', sceneData.animationData.clips?.length ?? 0)
      }

      // 清空历史栈
      sceneStore.historyManager.clear()
      sceneStore.isSceneReady = true

      message.success('场景加载成功')
      return true
    } catch (error) {
      console.error('加载场景失败:', error)
      message.error('加载场景失败')
      return false
    }
  }

  /**
   * 加载默认场景数据
   */
  async function loadDefaultScene() {
    // 清理旧数据
    sceneStore.objectsMap.clear()
    sceneStore.objectDataList = []
    sceneStore.selectedObjectId = null
    sceneStore.currentSceneId = null

    // 清理动画数据
    const { useAnimationStore } = await import('@/stores/modules/useAnimation.store')
    const animationStore = useAnimationStore()
    animationStore.setAnimationData(null)

    // 从本地数据库加载默认场景
    await sceneStore.initScene()
  }

  /**
   * 完整的场景切换流程
   */
  async function doSwitchScene(sceneId: number | null | undefined) {
    if (sceneId) {
      const loaded = await loadSceneData(sceneId)
      if (!loaded) {
        await loadDefaultScene()
      }
    } else {
      await loadDefaultScene()
    }
    
    // 通知 useRenderer 切换场景（创建新的 three.js 场景并同步所有对象）
    // 现在会等待所有网络资产加载完成
    await switchScene()
    
    // 场景切换和资产加载完成后，检查是否有自动播放的剪辑
    const { useAnimationStore } = await import('@/stores/modules/useAnimation.store')
    const animationStore = useAnimationStore()
    
    // 获取所有启用且自动播放的剪辑
    const enabledAutoPlayClips = animationStore.clips.filter(
      clip => clip.playMode === 'auto' && (clip.enabled ?? true)
    )
    
    if (enabledAutoPlayClips.length === 0) {
      return
    }
    
    // 检查是否排队播放（以第一个剪辑的设置为准）
    const firstClip = enabledAutoPlayClips[0]
    if (!firstClip) return
    
    const shouldQueue = firstClip.queueOnAutoPlay ?? true
    
    if (!shouldQueue) {
      // 不排队：同时播放所有启用的自动播放剪辑（使用后台播放）
      console.log(`[Scene] 同时播放 ${enabledAutoPlayClips.length} 个自动播放剪辑（不排队）`)
      for (const clip of enabledAutoPlayClips) {
        console.log(`[Scene] 启动剪辑: ${clip.name}`)
        // 第一个剪辑作为前台播放（用于时间轴显示），其他使用后台播放
        if (clip === firstClip) {
          animationStore.playClip(clip.id)
        } else {
          animationStore.playClip(clip.id, { background: true })
        }
      }
      return
    }
    
    // 排队播放：收集所有设置了排队的自动播放剪辑
    const queuedClips = enabledAutoPlayClips.filter(clip => clip.queueOnAutoPlay !== false)
    
    if (queuedClips.length === 0) {
      // 如果没有排队的剪辑，只播放第一个
      console.log('[Scene] 自动播放剪辑（无排队剪辑，只播放第一个）:', firstClip.name)
      animationStore.playClip(firstClip.id)
      return
    }
    
    // 递归函数：依次播放所有排队的自动播放剪辑
    function playNextAutoClip(index: number) {
      if (index >= queuedClips.length) {
        console.log('[Scene] 所有排队的自动播放剪辑已播放完成')
        return
      }
      
      const clip = queuedClips[index]
      if (!clip) {
        console.warn(`[Scene] 索引 ${index} 的剪辑不存在`)
        return
      }
      
      const clipName = clip.name
      const clipId = clip.id
      
      console.log(`[Scene] 自动播放剪辑 [${index + 1}/${queuedClips.length}]:`, clipName)
      
      // 播放当前剪辑，并在完成时播放下一个
      animationStore.playClip(clipId, {
        onComplete: () => {
          console.log(`[Scene] 剪辑 "${clipName}" 播放完成，准备播放下一个`)
          // 播放下一个排队的自动播放剪辑
          playNextAutoClip(index + 1)
        }
      })
    }
    
    // 从第一个开始播放
    playNextAutoClip(0)
    console.log(`[Scene] 开始播放 ${queuedClips.length} 个排队的自动播放剪辑`)
  }

  // 监听 sceneId 变化，支持动态切换场景
  watch(() => props.sceneId, async (newId, oldId) => {
    // 只在 sceneId 真正变化时处理（排除初始化）
    if (newId !== oldId && oldId !== undefined) {
      await doSwitchScene(newId)
    }
  })

  onMounted(async () => {
    // 注入通知和对话框到 store
    sceneStore.notification = useNotification()
    sceneStore.dialogProvider = useDialog()

    // 初始化渲染器（只执行一次）
    init()

    // 设置插件系统上下文（只设置一次；three 引用会在渲染循环里同步）
    if (!pluginManager.getContext()) {
      const ctx = pluginManager.createContext(
        { scene: sceneStore as any, animation: animationStore as any },
        { scene: sceneStore.threeScene as any, camera: camera.value as any, renderer: sceneStore.renderer as any }
      )
      pluginManager.setContext(ctx)
      // 安装弹窗插件
      await pluginManager.register(dialogOverlayPlugin)
    }
    
    // 设置截图函数到 store
    sceneStore.setCaptureScreenshotFn(captureScreenshot)

    // 加载初始场景
    await doSwitchScene(props.sceneId)
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
