<script setup lang="ts">
  import { computed, ref, onMounted, onBeforeUnmount, watchEffect } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { Move, Resize , Magnet, SpeedometerOutline } from '@vicons/ionicons5'
  import { Md3DRotationFilled } from '@vicons/material'
  // 场景视图
  import Scene from '@/components/Scene.vue'
  // 左侧编辑面板
  import LeftEditPanel from '@/components/LeftEditPanel.vue'
  // 底部资产面板
  import BottomAssetPanel from '@/components/BottomAssetPanel.vue'
  // 数值输入控件
  import NumberInput from '@/components/panels/NumberInput.vue'
  import DialogOverlayHost from '@/dialog/DialogOverlayHost.vue'
  // 性能面板
  import StatsPanel from '@/components/panels/StatsPanel.vue'
  
  const sceneStore = useSceneStore()

  const route = useRoute()
  const router = useRouter()
  
  // 性能面板显示控制
  const showStatsPanel = ref(false)
  // 用户是否手动操作过（手动操作后不再自动切换）
  const userToggledStats = ref(false)

  // 从 URL 获取场景ID，传递给 Scene 组件
  const sceneId = computed(() => {
    const id = route.query.sceneId
    return id ? Number(id) : null
  })

  // 从 URL 获取模式：preview（预览）或 edit（编辑），默认为编辑模式
  const isEditMode = computed(() => {
    return route.query.mode !== 'preview'
  })

  // 当前模式字符串，传递给 Scene 组件
  const currentMode = computed<'preview' | 'edit'>(() => {
    return route.query.mode === 'preview' ? 'preview' : 'edit'
  })

  // 从预览模式切换到编辑模式
  function enterEditMode() {
    router.replace({
      path: '/engine',
      query: {
        sceneId: sceneId.value,
        mode: 'edit'
      }
    })
  }

  // 从编辑模式切换到预览模式
  function enterPreviewMode() {
    router.replace({
      path: '/engine',
      query: {
        sceneId: sceneId.value,
        mode: 'preview'
      }
    })
  }

  // 返回场景列表
  function goBack() {
    router.push('/')
  }

  // 切换性能面板显示
  function toggleStatsPanel() {
    userToggledStats.value = true  // 标记用户手动操作
    showStatsPanel.value = !showStatsPanel.value
  }

  // 根据编辑/预览模式自动控制性能面板（用户手动操作前）
  watchEffect(() => {
    if (!userToggledStats.value) {
      showStatsPanel.value = isEditMode.value
    }
  })

  // 快捷键处理
  function handleKeyDown(event: KeyboardEvent) {
    // 忽略输入框内的按键
    const tag = (event.target as HTMLElement)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

    // 按 ` 或 ~ 键切换性能面板
    if (event.key === '`' || event.key === '~') {
      event.preventDefault()
      toggleStatsPanel()
    }
  }

  onMounted(() => {
    window.addEventListener('keydown', handleKeyDown)
  })

  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeyDown)
  })
</script>

<template>
  <div class="engine-container" :class="{ 'edit-mode': isEditMode }">
    <!-- 主内容区：场景 + 底部资产面板 -->
    <div class="main-area">
      <div class="scene-area">
        <Scene :scene-id="sceneId" :mode="currentMode" />
        <DialogOverlayHost />
        <!-- 性能监控面板 -->
        <StatsPanel v-if="showStatsPanel" />
      </div>
      <!-- 底部资产面板 - 仅编辑模式显示 -->
      <BottomAssetPanel v-show="isEditMode" />
    </div>

    <!-- 右侧编辑面板 - 仅编辑模式显示 -->
    <div v-show="isEditMode" class="edit-panel-area">
      <LeftEditPanel />
    </div>

    <!-- 顶部步幅控制 - 仅编辑模式显示 -->
    <div v-show="isEditMode" class="top-snap-controls">
      <!-- 磁铁图标 - 总体启用/禁用 -->
      <n-tooltip trigger="hover" placement="bottom">
        <template #trigger>
          <n-button
            quaternary
            size="small"
            :type="sceneStore.transformSnap.enabled ? 'primary' : 'default'"
            @click="sceneStore.transformSnap.enabled = !sceneStore.transformSnap.enabled"
            class="magnet-button"
            :class="{ active: sceneStore.transformSnap.enabled }"
          >
            <template #icon>
              <n-icon><Magnet /></n-icon>
            </template>
          </n-button>
        </template>
        步幅吸附 (Shift+Tab)
      </n-tooltip>
      
      <n-divider vertical style="margin: 0 4px" />
      
      <!-- 位移步幅 -->
      <div class="snap-item">
        <n-tooltip trigger="hover" placement="bottom">
          <template #trigger>
            <n-button
              quaternary
              size="tiny"
              :type="sceneStore.transformSnap.translationEnabled && sceneStore.transformSnap.enabled ? 'primary' : 'default'"
              @click="sceneStore.transformSnap.translationEnabled = !sceneStore.transformSnap.translationEnabled"
              :disabled="!sceneStore.transformSnap.enabled"
              class="snap-toggle"
            >
              <template #icon>
                <n-icon><Move /></n-icon>
              </template>
            </n-button>
          </template>
          位移步幅
        </n-tooltip>
        <NumberInput
          :value="sceneStore.transformSnap.translation"
          :min="0"
          :max="100"
          :step="0.1"
          :precision="2"
          :disabled="!sceneStore.transformSnap.enabled || !sceneStore.transformSnap.translationEnabled"
          placeholder="0.0"
          class="snap-input"
          @update:value="sceneStore.transformSnap.translation = $event ?? 0"
        />
      </div>
      
      <!-- 旋转步幅 -->
      <div class="snap-item">
        <n-tooltip trigger="hover" placement="bottom">
          <template #trigger>
            <n-button
              quaternary
              size="tiny"
              :type="sceneStore.transformSnap.rotationEnabled && sceneStore.transformSnap.enabled ? 'primary' : 'default'"
              @click="sceneStore.transformSnap.rotationEnabled = !sceneStore.transformSnap.rotationEnabled"
              :disabled="!sceneStore.transformSnap.enabled"
              class="snap-toggle"
            >
              <template #icon>
                <n-icon><Md3DRotationFilled /></n-icon>
              </template>
            </n-button>
          </template>
          旋转步幅
        </n-tooltip>
        <NumberInput
          :value="sceneStore.transformSnap.rotation"
          :min="0"
          :max="Math.PI * 2"
          :step="Math.PI / 180"
          :precision="3"
          :disabled="!sceneStore.transformSnap.enabled || !sceneStore.transformSnap.rotationEnabled"
          placeholder="0.0"
          class="snap-input"
          @update:value="sceneStore.transformSnap.rotation = $event ?? 0"
        />
      </div>
      
      <!-- 缩放步幅 -->
      <div class="snap-item">
        <n-tooltip trigger="hover" placement="bottom">
          <template #trigger>
            <n-button
              quaternary
              size="tiny"
              :type="sceneStore.transformSnap.scaleEnabled && sceneStore.transformSnap.enabled ? 'primary' : 'default'"
              @click="sceneStore.transformSnap.scaleEnabled = !sceneStore.transformSnap.scaleEnabled"
              :disabled="!sceneStore.transformSnap.enabled"
              class="snap-toggle"
            >
              <template #icon>
                <n-icon><Resize /></n-icon>
              </template>
            </n-button>
          </template>
          缩放步幅
        </n-tooltip>
        <NumberInput
          :value="sceneStore.transformSnap.scale"
          :min="0"
          :max="10"
          :step="0.1"
          :precision="2"
          :disabled="!sceneStore.transformSnap.enabled || !sceneStore.transformSnap.scaleEnabled"
          placeholder="0.0"
          class="snap-input"
          @update:value="sceneStore.transformSnap.scale = $event ?? 0"
        />
      </div>
    </div>

    <!-- 悬浮工具栏 - 始终显示 -->
    <div class="floating-toolbar">
      <n-space>
        <n-button @click="goBack">
          <template #icon>
            <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg></n-icon>
          </template>
          返回列表
        </n-button>
        <!-- 预览模式：显示进入编辑按钮 -->
        <n-button v-if="!isEditMode" type="primary" @click="enterEditMode">
          <template #icon>
            <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg></n-icon>
          </template>
          进入编辑
        </n-button>
        <!-- 编辑模式：显示预览按钮 -->
        <n-button v-else @click="enterPreviewMode">
          <template #icon>
            <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></n-icon>
          </template>
          预览
        </n-button>
        <!-- 性能面板开关 -->
        <n-tooltip trigger="hover" placement="bottom">
          <template #trigger>
            <n-button 
              :type="showStatsPanel ? 'primary' : 'default'" 
              @click="toggleStatsPanel"
            >
              <template #icon>
                <n-icon><SpeedometerOutline /></n-icon>
              </template>
            </n-button>
          </template>
          性能监控 (`)
        </n-tooltip>
      </n-space>
    </div>
  </div>
</template>

<style scoped>
.engine-container {
  width: 100%;
  height: 100%;
  overflow: hidden;
  display: flex;
  position: relative;
}

/* 主内容区（场景 + 资产面板） */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.scene-area {
  flex: 1;
  overflow: hidden;
  position: relative;
}

/* 右侧编辑面板区域 */
.edit-panel-area {
  width: 18%;
  height: 100%;
  overflow: hidden;
  border-left: 1px solid var(--n-border-color, #e0e0e0);
}

/* 顶部步幅控制 */
.top-snap-controls {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: var(--n-color, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--n-border-color, rgba(0, 0, 0, 0.12));
  padding: 4px 8px;
  border-radius: 6px;
  backdrop-filter: blur(10px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  display: flex;
  align-items: center;
  gap: 4px;
}

.magnet-button {
  min-width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.magnet-button.active {
  background-color: var(--n-primary-color, #18a058);
  color: #fff;
}

.magnet-button.active:hover {
  background-color: var(--n-primary-color-hover, #36ad6a);
}

.magnet-button.active:active {
  background-color: var(--n-primary-color-pressed, #0c7a43);
}

.snap-item {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 4px;
  transition: background-color 0.2s;
}

.snap-item:hover {
  background-color: var(--n-hover-color, rgba(0, 0, 0, 0.06));
}

.snap-toggle {
  min-width: 24px;
  height: 24px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.snap-input {
  min-width: 60px;
  flex: 0 0 auto;
}

.snap-input :deep(.number-input-content) {
  height: 22px;
  padding: 2px 6px;
  font-size: 11px;
}

.snap-input :deep(.number-input-display) {
  font-size: 11px;
  text-align: center;
}

/* 悬浮工具栏 */
.floating-toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.6);
  padding: 8px 12px;
  border-radius: 8px;
  backdrop-filter: blur(8px);
}
</style>
