<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { useUiEditorStore, type AssetCategory } from '@/stores/modules/uiEditor.store'
  import { assetApi } from '@/services/assetApi'
  import { useMessage, useDialog, type UploadFileInfo } from 'naive-ui'
  import {
    CloudUploadOutline,
    AddOutline,
    ChevronDownOutline,
    ChevronUpOutline,
    CubeOutline,
    ImagesOutline,
    ColorPaletteOutline,
    SunnyOutline
  } from '@vicons/ionicons5'
  import { DeleteFilled } from '@vicons/material'
  import type { AssetRef } from '@/types/asset'

  const sceneStore = useSceneStore()
  const uiEditorStore = useUiEditorStore()
  const message = useMessage()
  const dialog = useDialog()

  const uploading = ref(false)
  const modelUploadList = ref<UploadFileInfo[]>([])
  const loading = ref(false)
  const isDragging = ref(false)
  const dragStartY = ref(0)
  const dragStartHeight = ref(0)

  // 资产类别配置
  const categories: Array<{ key: AssetCategory; label: string; icon: any; accept: string; description: string }> = [
    { key: 'model', label: '模型', icon: CubeOutline, accept: '.glb,.gltf', description: '3D模型文件 (.glb, .gltf)' },
    { key: 'texture', label: '贴图', icon: ImagesOutline, accept: '.png,.jpg,.jpeg,.webp', description: '图片贴图 (.png, .jpg, .webp)' },
    { key: 'material', label: '材质', icon: ColorPaletteOutline, accept: '.json', description: '材质预设 (.json)' },
    { key: 'hdri', label: 'HDRI', icon: SunnyOutline, accept: '.hdr,.exr', description: '环境贴图 (.hdr, .exr)' }
  ]

  // 当前类别配置
  const currentCategory = computed((): { key: AssetCategory; label: string; icon: any; accept: string; description: string } => {
    return categories.find(c => c.key === uiEditorStore.activeAssetCategory) ?? categories[0]!
  })

  // 根据类别筛选资产
  const filteredAssets = computed(() => {
    const category = uiEditorStore.activeAssetCategory
    return sceneStore.assets.filter(a => {
      if (category === 'model') return a.type === 'model' && a.source === 'remote'
      if (category === 'texture') return a.type === 'texture' && a.source === 'remote'
      if (category === 'material') return a.type === 'material'
      if (category === 'hdri') return a.type === 'hdri'
      return false
    })
  })

  // 格式化文件大小
  function formatFileSize(bytes?: number): string {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // 上传资产到云端
  async function handleAssetUpload(fileList: UploadFileInfo[]) {
    modelUploadList.value = fileList
    const file = fileList[0]?.file
    if (!file) return

    if (!assetApi.isStorageAvailable()) {
      message.error('Supabase Storage 未配置，无法上传')
      modelUploadList.value = []
      return
    }

    if (!sceneStore.currentSceneId) {
      message.error('请先创建或打开一个场景')
      modelUploadList.value = []
      return
    }

    uploading.value = true
    try {
      await sceneStore.uploadAsset(file, uiEditorStore.activeAssetCategory, sceneStore.currentSceneId)
      message.success(`"${file.name}" 上传成功`)
    } catch (error: any) {
      console.error('上传失败:', error)
      message.error(`上传失败: ${error.message || '未知错误'}`)
    } finally {
      uploading.value = false
      modelUploadList.value = []
    }
  }

  // 导入模型到场景
  async function handleImportModel(asset: AssetRef) {
    if (!sceneStore.threeScene) {
      message.warning('场景未初始化，请稍候再试')
      return
    }

    try {
      loading.value = true
      const parentId = sceneStore.selectedObjectId ?? 'Scene'
      const created = sceneStore.addSceneObjectData({
        type: 'model',
        name: asset.name,
        parentId,
        assetId: asset.id
      })

      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync(asset.uri)
      
      const target = sceneStore.objectsMap.get(created.id)
      if (target && gltf.scene) {
        target.children.slice().forEach((child: any) => target.remove(child))
        target.add(gltf.scene)
        sceneStore.selectedObjectId = created.id
        message.success(`模型 "${asset.name}" 已导入到场景`)
      }
    } catch (error: any) {
      console.error('导入模型失败:', error)
      message.error(`导入失败: ${error.message || '未知错误'}`)
    } finally {
      loading.value = false
    }
  }

  // 导入资产（根据类型处理）
  async function handleImportAsset(asset: AssetRef) {
    if (asset.type === 'model') {
      await handleImportModel(asset)
    } else if (asset.type === 'texture') {
      // TODO: 应用贴图到选中材质
      message.info('贴图功能开发中')
    } else if (asset.type === 'hdri') {
      // TODO: 应用HDRI到场景环境
      message.info('HDRI功能开发中')
    }
  }

  // 删除资产
  async function handleDeleteAsset(asset: AssetRef) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除 "${asset.name}" 吗？此操作不可恢复。`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          const success = await assetApi.deleteAsset(asset)
          if (success) {
            const index = sceneStore.assets.findIndex(a => a.id === asset.id)
            if (index > -1) {
              sceneStore.assets.splice(index, 1)
            }
            message.success('删除成功')
          } else {
            message.error('删除失败')
          }
        } catch (error: any) {
          console.error('删除失败:', error)
          message.error(`删除失败: ${error.message || '未知错误'}`)
        }
      }
    })
  }

  // 拖拽调整高度
  function startDrag(e: MouseEvent) {
    isDragging.value = true
    dragStartY.value = e.clientY
    dragStartHeight.value = uiEditorStore.assetPanelHeight
    document.addEventListener('mousemove', onDrag)
    document.addEventListener('mouseup', stopDrag)
  }

  function onDrag(e: MouseEvent) {
    if (!isDragging.value) return
    const deltaY = dragStartY.value - e.clientY
    uiEditorStore.setAssetPanelHeight(dragStartHeight.value + deltaY)
  }

  function stopDrag() {
    isDragging.value = false
    document.removeEventListener('mousemove', onDrag)
    document.removeEventListener('mouseup', stopDrag)
  }

  // 本地导入模型（不上传云端）
  async function handleLocalModelImport(fileList: UploadFileInfo[]) {
    const file = fileList[0]?.file
    if (!file) return
    const parentId = sceneStore.selectedObjectId ?? 'Scene'
    await sceneStore.importModelFile(file, parentId)
  }
</script>

<template>
  <div class="bottom-asset-panel" :style="{ height: uiEditorStore.isAssetPanelOpen ? `${uiEditorStore.assetPanelHeight}px` : '40px' }">
    <!-- 拖拽调整手柄 -->
    <div
      v-if="uiEditorStore.isAssetPanelOpen"
      class="resize-handle"
      @mousedown="startDrag"
    />
    
    <!-- 标题栏 -->
    <div class="panel-header" @click="uiEditorStore.toggleAssetPanel">
      <div class="header-left">
        <n-icon size="18">
          <component :is="currentCategory.icon" />
        </n-icon>
        <span class="title">资产管理</span>
        <n-tag v-if="filteredAssets.length > 0" size="small" :bordered="false">
          {{ filteredAssets.length }}
        </n-tag>
      </div>
      <div class="header-right">
        <n-icon size="18">
          <ChevronUpOutline v-if="uiEditorStore.isAssetPanelOpen" />
          <ChevronDownOutline v-else />
        </n-icon>
      </div>
    </div>

    <!-- 面板内容 -->
    <div v-show="uiEditorStore.isAssetPanelOpen" class="panel-content">
      <!-- 左侧类别导航 -->
      <div class="category-nav">
        <n-tooltip
          v-for="cat in categories"
          :key="cat.key"
          trigger="hover"
          placement="right"
        >
          <template #trigger>
            <div
              class="category-item"
              :class="{ active: uiEditorStore.activeAssetCategory === cat.key }"
              @click="uiEditorStore.setAssetCategory(cat.key)"
            >
              <n-icon size="20">
                <component :is="cat.icon" />
              </n-icon>
            </div>
          </template>
          {{ cat.label }}
        </n-tooltip>
      </div>

      <!-- 右侧内容区 -->
      <div class="asset-content">
        <!-- 工具栏 -->
        <div class="toolbar">
          <div class="toolbar-left">
            <span class="category-label">{{ currentCategory.label }}</span>
          </div>
          <div class="toolbar-right">
            <!-- 本地导入（仅模型） -->
            <n-upload
              v-if="currentCategory.key === 'model'"
              :default-upload="false"
              :show-file-list="false"
              :accept="currentCategory.accept"
              @update:file-list="handleLocalModelImport"
            >
              <n-button size="small" quaternary>
                <template #icon>
                  <n-icon><AddOutline /></n-icon>
                </template>
                本地导入
              </n-button>
            </n-upload>
            <!-- 云端上传 -->
            <n-upload
              :default-upload="false"
              :show-file-list="false"
              :accept="currentCategory.accept"
              :file-list="modelUploadList"
              @update:file-list="handleAssetUpload"
              :disabled="uploading || !assetApi.isStorageAvailable()"
            >
              <n-button size="small" type="primary" :loading="uploading">
                <template #icon>
                  <n-icon><CloudUploadOutline /></n-icon>
                </template>
                上传
              </n-button>
            </n-upload>
          </div>
        </div>

        <!-- 资产列表 -->
        <div class="asset-list">
          <n-spin :show="loading">
            <n-scrollbar v-if="filteredAssets.length > 0" style="max-height: calc(100% - 8px);">
              <div class="asset-grid">
                <div
                  v-for="asset in filteredAssets"
                  :key="asset.id"
                  class="asset-item"
                  @click="handleImportAsset(asset)"
                >
                  <!-- 预览图 -->
                  <div class="asset-preview">
                    <img
                      v-if="asset.thumbnail"
                      :src="asset.thumbnail"
                      :alt="asset.name"
                    />
                    <n-icon v-else size="32" color="rgba(255,255,255,0.6)">
                      <component :is="currentCategory.icon" />
                    </n-icon>
                    <!-- 悬停操作 -->
                    <div class="asset-overlay">
                      <n-button size="tiny" type="primary" @click.stop="handleImportAsset(asset)">
                        导入
                      </n-button>
                      <n-button size="tiny" type="error" @click.stop="handleDeleteAsset(asset)">
                        <template #icon>
                          <n-icon><DeleteFilled /></n-icon>
                        </template>
                      </n-button>
                    </div>
                  </div>
                  <!-- 名称 -->
                  <div class="asset-name">
                    <n-ellipsis :line-clamp="1" :tooltip="{ placement: 'top' }">
                      {{ asset.name }}
                    </n-ellipsis>
                  </div>
                  <div class="asset-size">{{ formatFileSize(asset.meta?.size) }}</div>
                </div>
              </div>
            </n-scrollbar>

            <!-- 空状态 -->
            <div v-else class="empty-state">
              <n-icon size="40" color="#666">
                <component :is="currentCategory.icon" />
              </n-icon>
              <div class="empty-text">暂无{{ currentCategory.label }}</div>
              <div class="empty-hint">{{ currentCategory.description }}</div>
            </div>
          </n-spin>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bottom-asset-panel {
  background: #1e1e1e;
  border-top: 1px solid #333;
  display: flex;
  flex-direction: column;
  transition: height 0.2s ease;
  position: relative;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  cursor: ns-resize;
  z-index: 10;
}

.resize-handle:hover {
  background: rgba(64, 158, 255, 0.5);
}

.panel-header {
  height: 40px;
  padding: 0 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  background: #252525;
  user-select: none;
  flex-shrink: 0;
}

.panel-header:hover {
  background: #2a2a2a;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 13px;
  font-weight: 500;
  color: #e0e0e0;
}

.header-right {
  color: #888;
}

.panel-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.category-nav {
  width: 48px;
  background: #1a1a1a;
  border-right: 1px solid #333;
  display: flex;
  flex-direction: column;
  padding: 8px 0;
  gap: 4px;
}

.category-item {
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #888;
  transition: all 0.15s;
}

.category-item:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.category-item.active {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
  border-left: 2px solid #409eff;
}

.asset-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  height: 36px;
  padding: 0 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-label {
  font-size: 12px;
  color: #aaa;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.asset-list {
  flex: 1;
  padding: 8px;
  overflow: hidden;
}

.asset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  padding: 4px;
}

.asset-item {
  width: 100px;
  cursor: pointer;
  border-radius: 6px;
  overflow: hidden;
  background: #252525;
  transition: all 0.15s;
}

.asset-item:hover {
  background: #303030;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.asset-preview {
  width: 100px;
  height: 80px;
  background: linear-gradient(135deg, #2a2a3e 0%, #1a1a2e 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.asset-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.asset-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.asset-item:hover .asset-overlay {
  opacity: 1;
}

.asset-name {
  padding: 6px 8px 2px;
  font-size: 11px;
  color: #e0e0e0;
}

.asset-size {
  padding: 0 8px 6px;
  font-size: 10px;
  color: #888;
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.empty-text {
  font-size: 13px;
  color: #888;
}

.empty-hint {
  font-size: 11px;
  color: #666;
}
</style>
