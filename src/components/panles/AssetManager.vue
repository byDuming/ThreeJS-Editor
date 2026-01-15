<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { assetApi } from '@/services/assetApi'
  import { useMessage, useDialog, type UploadFileInfo } from 'naive-ui'
  import { CloudUploadOutline, AddOutline, ImageOutline } from '@vicons/ionicons5'
  import { DeleteFilled } from '@vicons/material'
  import type { AssetRef } from '@/types/asset'

  const sceneStore = useSceneStore()
  const message = useMessage()
  const dialog = useDialog()

  const uploading = ref(false)
  const modelUploadList = ref<UploadFileInfo[]>([])
  const loading = ref(false)

  // 只显示云端模型资产
  const modelAssets = computed(() => {
    return sceneStore.assets.filter(a => a.type === 'model' && a.source === 'remote')
  })

  // 格式化文件大小
  function formatFileSize(bytes?: number): string {
    if (!bytes) return '-'
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  }

  // 加载模型列表（从 store 获取）
  onMounted(() => {
    // 资产已经在 store 中，这里可以触发刷新
  })

  // 上传模型文件到云端
  async function handleModelUpload(fileList: UploadFileInfo[]) {
    modelUploadList.value = fileList
    const file = fileList[0]?.file
    if (!file) return

    if (!assetApi.isStorageAvailable()) {
      message.error('Supabase Storage 未配置，无法上传模型')
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
      // 上传到云端
      await sceneStore.uploadAsset(file, 'model', sceneStore.currentSceneId)
      message.success(`模型 "${file.name}" 上传成功`)
    } catch (error: any) {
      console.error('上传模型失败:', error)
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
      
      // 创建场景对象
      const parentId = sceneStore.selectedObjectId ?? 'Scene'
      const created = sceneStore.addSceneObjectData({
        type: 'model',
        name: asset.name,
        parentId,
        assetId: asset.id
      })

      // 从 URL 加载模型
      const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js')
      const loader = new GLTFLoader()
      const gltf = await loader.loadAsync(asset.uri)
      
      // 将模型添加到场景对象
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

  // 删除模型
  async function handleDeleteModel(asset: AssetRef) {
    dialog.warning({
      title: '确认删除',
      content: `确定要删除模型 "${asset.name}" 吗？此操作不可恢复。`,
      positiveText: '确定',
      negativeText: '取消',
      onPositiveClick: async () => {
        try {
          const success = await assetApi.deleteAsset(asset)
          if (success) {
            // 从 store 中移除
            const index = sceneStore.assets.findIndex(a => a.id === asset.id)
            if (index > -1) {
              sceneStore.assets.splice(index, 1)
            }
            message.success('删除成功')
          } else {
            message.error('删除失败')
          }
        } catch (error: any) {
          console.error('删除模型失败:', error)
          message.error(`删除失败: ${error.message || '未知错误'}`)
        }
      }
    })
  }
</script>

<template>
  <div style="padding: 12px; height: 100%; display: flex; flex-direction: column;">
    <!-- 标题和上传按钮 -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
      <div style="font-weight: 500; font-size: 14px;">模型库</div>
      <n-upload
        :default-upload="false"
        :show-file-list="false"
        accept=".glb,.gltf"
        :file-list="modelUploadList"
        @update:file-list="handleModelUpload"
        :disabled="uploading || !assetApi.isStorageAvailable()"
      >
        <n-button size="small" type="primary" :loading="uploading">
          <template #icon>
            <n-icon><CloudUploadOutline /></n-icon>
          </template>
          上传模型
        </n-button>
      </n-upload>
    </div>

    <!-- 模型网格列表 -->
    <div style="flex: 1; overflow-y: auto;">
      <n-spin :show="loading">
        <n-grid
          v-if="modelAssets.length > 0"
          x-gap="12"
          y-gap="12"
          :cols="2"
          style="padding-bottom: 12px;"
        >
          <n-gi v-for="asset in modelAssets" :key="asset.id">
            <n-card
              hoverable
              style="cursor: pointer;"
              @click="handleImportModel(asset)"
            >
              <!-- 预览图区域 -->
              <template #cover>
                <div
                  style="
                    width: 100%;
                    height: 120px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                  "
                >
                  <img
                    v-if="asset.thumbnail"
                    :src="asset.thumbnail"
                    :alt="asset.name"
                    style="width: 100%; height: 100%; object-fit: cover;"
                  />
                  <n-icon
                    v-else
                    size="48"
                    color="rgba(255, 255, 255, 0.8)"
                  >
                    <ImageOutline />
                  </n-icon>
                  <!-- 悬停遮罩 -->
                  <div
                    style="
                      position: absolute;
                      top: 0;
                      left: 0;
                      right: 0;
                      bottom: 0;
                      background: rgba(0, 0, 0, 0.5);
                      display: flex;
                      align-items: center;
                      justify-content: center;
                      opacity: 0;
                      transition: opacity 0.2s;
                    "
                    class="hover-overlay"
                  >
                    <n-button size="small" type="primary">
                      <template #icon>
                        <n-icon><AddOutline /></n-icon>
                      </template>
                      导入
                    </n-button>
                  </div>
                </div>
              </template>

              <!-- 模型信息 -->
              <div style="padding: 8px 0;">
                <n-ellipsis style="font-size: 13px; font-weight: 500; margin-bottom: 4px;">
                  {{ asset.name }}
                </n-ellipsis>
                <div style="font-size: 11px; color: #999; margin-bottom: 8px;">
                  {{ formatFileSize(asset.meta?.size) }}
                </div>
              </div>

              <!-- 操作按钮 -->
              <template #action>
                <n-space :size="4" style="width: 100%; justify-content: space-between;">
                  <n-button
                    size="tiny"
                    type="primary"
                    @click.stop="handleImportModel(asset)"
                  >
                    导入
                  </n-button>
                  <n-button
                    size="tiny"
                    type="error"
                    @click.stop="handleDeleteModel(asset)"
                  >
                    <template #icon>
                      <n-icon><DeleteFilled /></n-icon>
                    </template>
                    删除
                  </n-button>
                </n-space>
              </template>
            </n-card>
          </n-gi>
        </n-grid>

        <!-- 空状态 -->
        <n-empty
          v-else
          description="暂无模型"
          :show-icon="false"
          style="padding: 60px 20px;"
        >
          <template #extra>
            <div style="font-size: 12px; color: #999; margin-bottom: 16px;">
              点击上方按钮上传模型文件 (.glb, .gltf)
            </div>
            <n-upload
              :default-upload="false"
              :show-file-list="false"
              accept=".glb,.gltf"
              :file-list="modelUploadList"
              @update:file-list="handleModelUpload"
              :disabled="uploading || !assetApi.isStorageAvailable()"
            >
              <n-button type="primary" :loading="uploading">
                <template #icon>
                  <n-icon><CloudUploadOutline /></n-icon>
                </template>
                上传第一个模型
              </n-button>
            </n-upload>
          </template>
        </n-empty>
      </n-spin>
    </div>
  </div>
</template>

<style scoped>
.n-card:hover .hover-overlay {
  opacity: 1;
}
</style>
