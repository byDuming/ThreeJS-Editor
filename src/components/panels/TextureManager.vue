<script setup lang="ts">
/**
 * 贴图资产管理面板
 * 支持贴图上传、ZIP 压缩包批量导入、从资产库选择贴图
 */
import { ref, computed, onMounted } from 'vue'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { assetApi } from '@/services/assetApi'
import { useMessage, useDialog, type UploadFileInfo } from 'naive-ui'
import {
  CloudUploadOutline,
  RefreshOutline,
  FolderOpenOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
} from '@vicons/ionicons5'
import { DeleteFilled } from '@vicons/material'
import type { AssetRef } from '@/types/asset'
import {
  parseTexturePack,
  getTextureSlotLabel,
  isValidTextureFile,
  type TextureSlot,
  type TexturePackResult,
} from '@/utils/texturePackLoader'

const props = defineProps<{
  /** 选择模式：选择贴图应用到指定槽位 */
  selectMode?: boolean
  /** 选择模式下的目标槽位 */
  targetSlot?: TextureSlot
}>()

const emit = defineEmits<{
  /** 选择贴图后触发 */
  (e: 'select', asset: AssetRef, slot?: TextureSlot): void
  /** 关闭面板 */
  (e: 'close'): void
}>()

const sceneStore = useSceneStore()
const message = useMessage()
const dialog = useDialog()

const uploading = ref(false)
const loading = ref(false)
const textureAssets = ref<AssetRef[]>([])
const uploadFileList = ref<UploadFileInfo[]>([])

// 分类和搜索
const searchKeyword = ref('')
const selectedCategory = ref<string>('all')

// 贴图分类配置
const TEXTURE_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'diffuse', label: '漫反射', patterns: [/_diffuse\./i, /_diff\./i, /_color\./i, /_albedo\./i, /_basecolor\./i, /_base_color\./i, /_col\./i] },
  { key: 'normal', label: '法线', patterns: [/_normal\./i, /_nor\./i, /_nrm\./i, /_norm\./i, /_normalgl\./i, /_normaldx\./i] },
  { key: 'roughness', label: '粗糙度', patterns: [/_roughness\./i, /_rough\./i, /_rgh\./i] },
  { key: 'metalness', label: '金属度', patterns: [/_metalness\./i, /_metal\./i, /_metallic\./i, /_mtl\./i] },
  { key: 'ao', label: 'AO', patterns: [/_ao\./i, /_ambient\./i, /_ambientocclusion\./i, /_occlusion\./i, /_occ\./i] },
  { key: 'emissive', label: '自发光', patterns: [/_emissive\./i, /_emission\./i, /_emit\./i, /_glow\./i] },
  { key: 'displacement', label: '位移', patterns: [/_displacement\./i, /_disp\./i, /_height\./i] },
  { key: 'other', label: '其他' },
]

// 根据文件名识别贴图类别
function getTextureCategory(name: string): string {
  const lowerName = name.toLowerCase()
  for (const cat of TEXTURE_CATEGORIES) {
    if (cat.key === 'all' || cat.key === 'other') continue
    if (cat.patterns?.some(p => p.test(lowerName))) {
      return cat.key
    }
  }
  return 'other'
}

// 过滤后的贴图列表
const filteredTextureAssets = computed(() => {
  let result = textureAssets.value
  
  // 按分类过滤
  if (selectedCategory.value !== 'all') {
    result = result.filter(asset => getTextureCategory(asset.name) === selectedCategory.value)
  }
  
  // 按关键词搜索
  if (searchKeyword.value.trim()) {
    const keyword = searchKeyword.value.toLowerCase().trim()
    result = result.filter(asset => asset.name.toLowerCase().includes(keyword))
  }
  
  return result
})

// 各分类数量统计
const categoryCounts = computed(() => {
  const counts: Record<string, number> = { all: textureAssets.value.length }
  
  for (const asset of textureAssets.value) {
    const cat = getTextureCategory(asset.name)
    counts[cat] = (counts[cat] || 0) + 1
  }
  
  return counts
})

// ZIP 导入相关
const showZipDialog = ref(false)
const zipParseResult = ref<TexturePackResult | null>(null)
const zipUploading = ref(false)
const zipUploadProgress = ref(0)

// 加载贴图资产列表
async function loadTextureAssets() {
  if (!assetApi.isStorageAvailable()) {
    return
  }
  loading.value = true
  try {
    textureAssets.value = await assetApi.getGlobalAssets('texture')
  } catch (error) {
    console.error('加载贴图列表失败:', error)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadTextureAssets()
})

// 格式化文件大小
function formatFileSize(bytes?: number): string {
  if (!bytes) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

// 上传单个贴图
async function handleTextureUpload(fileList: UploadFileInfo[]) {
  uploadFileList.value = fileList
  const file = fileList[0]?.file
  if (!file) return

  if (!assetApi.isStorageAvailable()) {
    message.error('Supabase Storage 未配置，无法上传')
    uploadFileList.value = []
    return
  }

  if (!isValidTextureFile(file)) {
    message.error('不支持的图片格式')
    uploadFileList.value = []
    return
  }

  uploading.value = true
  try {
    const result = await assetApi.uploadAsset({ file, type: 'texture' })
    textureAssets.value.unshift(result.asset)
    sceneStore.registerRemoteAsset(result.asset)
    message.success(`贴图 "${file.name}" 上传成功`)
  } catch (error: any) {
    console.error('上传贴图失败:', error)
    message.error(`上传失败: ${error.message || '未知错误'}`)
  } finally {
    uploading.value = false
    uploadFileList.value = []
  }
}

// 处理 ZIP 文件上传
async function handleZipUpload(fileList: UploadFileInfo[]) {
  const file = fileList[0]?.file
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.zip')) {
    message.error('请上传 ZIP 压缩包')
    return
  }

  try {
    loading.value = true
    message.info('正在解析压缩包...')
    zipParseResult.value = await parseTexturePack(file)
    
    if (zipParseResult.value.textures.length === 0) {
      message.warning('未在压缩包中找到可识别的贴图文件')
      return
    }
    
    showZipDialog.value = true
  } catch (error: any) {
    console.error('解析压缩包失败:', error)
    message.error(`解析失败: ${error.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

// 上传 ZIP 中的所有贴图
async function uploadZipTextures() {
  if (!zipParseResult.value || !assetApi.isStorageAvailable()) return

  const textures = zipParseResult.value.textures
  zipUploading.value = true
  zipUploadProgress.value = 0

  const uploadedAssets: AssetRef[] = []
  const failed: string[] = []

  for (let i = 0; i < textures.length; i++) {
    const texture = textures[i]!
    try {
      const result = await assetApi.uploadAsset({
        file: texture.file,
        type: 'texture',
      })
      uploadedAssets.push(result.asset)
      sceneStore.registerRemoteAsset(result.asset)
    } catch (error) {
      console.error(`上传 ${texture.fileName} 失败:`, error)
      failed.push(texture.fileName)
    }
    zipUploadProgress.value = Math.round(((i + 1) / textures.length) * 100)
  }

  // 更新本地列表
  textureAssets.value = [...uploadedAssets, ...textureAssets.value]

  zipUploading.value = false
  showZipDialog.value = false
  zipParseResult.value = null

  if (failed.length > 0) {
    message.warning(`${uploadedAssets.length} 个贴图上传成功，${failed.length} 个失败`)
  } else {
    message.success(`${uploadedAssets.length} 个贴图全部上传成功`)
  }
}

// 选择贴图（选择模式）
function handleSelectTexture(asset: AssetRef) {
  if (props.selectMode) {
    emit('select', asset, props.targetSlot)
  }
}

// 删除贴图
async function handleDeleteTexture(asset: AssetRef) {
  dialog.warning({
    title: '确认删除',
    content: `确定要删除贴图 "${asset.name}" 吗？此操作不可恢复。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        const success = await assetApi.deleteAsset(asset)
        if (success) {
          const index = textureAssets.value.findIndex(a => a.id === asset.id)
          if (index > -1) {
            textureAssets.value.splice(index, 1)
          }
          message.success('删除成功')
        } else {
          message.error('删除失败')
        }
      } catch (error: any) {
        console.error('删除贴图失败:', error)
        message.error(`删除失败: ${error.message || '未知错误'}`)
      }
    },
  })
}

// 获取贴图预览图（如果没有缩略图则使用 URI）
function getTexturePreview(asset: AssetRef): string {
  return asset.thumbnail || asset.uri
}
</script>

<template>
  <div class="texture-manager">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <span v-if="selectMode" class="select-hint">
          选择贴图应用到 {{ targetSlot ? getTextureSlotLabel(targetSlot) : '材质' }}
        </span>
        <span v-else class="title">贴图库</span>
      </div>
      <div class="toolbar-right">
        <n-button size="small" quaternary @click="loadTextureAssets" :loading="loading">
          <template #icon>
            <n-icon><RefreshOutline /></n-icon>
          </template>
        </n-button>
        
        <!-- ZIP 导入 -->
        <n-upload
          :default-upload="false"
          :show-file-list="false"
          accept=".zip"
          @update:file-list="handleZipUpload"
          :disabled="loading"
        >
          <n-button size="small" quaternary>
            <template #icon>
              <n-icon><FolderOpenOutline /></n-icon>
            </template>
            导入压缩包
          </n-button>
        </n-upload>

        <!-- 单张上传 -->
        <n-upload
          :default-upload="false"
          :show-file-list="false"
          accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.hdr,.exr"
          :file-list="uploadFileList"
          @update:file-list="handleTextureUpload"
          :disabled="uploading || !assetApi.isStorageAvailable()"
        >
          <n-button size="small" type="primary" :loading="uploading">
            <template #icon>
              <n-icon><CloudUploadOutline /></n-icon>
            </template>
            上传贴图
          </n-button>
        </n-upload>
      </div>
    </div>

    <!-- 搜索和分类栏 -->
    <div class="filter-bar">
      <!-- 搜索框 -->
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索贴图..."
        size="small"
        clearable
        class="search-input"
      >
        <template #prefix>
          <n-icon size="16" color="#999">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 2a8 8 0 105.293 14.707l5 5a1 1 0 001.414-1.414l-5-5A8 8 0 0010 2zm0 2a6 6 0 110 12 6 6 0 010-12z"/>
            </svg>
          </n-icon>
        </template>
      </n-input>
      
      <!-- 分类标签 -->
      <div class="category-tabs">
        <button
          v-for="cat in TEXTURE_CATEGORIES"
          :key="cat.key"
          class="category-tab"
          :class="{ active: selectedCategory === cat.key }"
          @click="selectedCategory = cat.key"
        >
          {{ cat.label }}
          <span v-if="categoryCounts[cat.key]" class="category-count">{{ categoryCounts[cat.key] }}</span>
        </button>
      </div>
    </div>

    <!-- 贴图网格 -->
    <div class="texture-grid-container">
      <n-spin :show="loading">
        <n-scrollbar v-if="filteredTextureAssets.length > 0" style="max-height: 100%;">
          <div class="texture-grid">
            <div
              v-for="asset in filteredTextureAssets"
              :key="asset.id"
              class="texture-item"
              :class="{ 'select-mode': selectMode }"
              @click="handleSelectTexture(asset)"
            >
              <!-- 预览图 -->
              <div class="texture-preview">
                <img
                  :src="getTexturePreview(asset)"
                  :alt="asset.name"
                  loading="lazy"
                />
                <!-- 悬停操作 -->
                <div class="texture-overlay">
                  <n-button
                    v-if="selectMode"
                    size="tiny"
                    type="primary"
                    @click.stop="handleSelectTexture(asset)"
                  >
                    选择
                  </n-button>
                  <n-button
                    v-if="!selectMode"
                    size="tiny"
                    type="error"
                    @click.stop="handleDeleteTexture(asset)"
                  >
                    <template #icon>
                      <n-icon><DeleteFilled /></n-icon>
                    </template>
                  </n-button>
                </div>
              </div>
              <!-- 信息 -->
              <div class="texture-info">
                <n-ellipsis class="texture-name" :line-clamp="1">
                  {{ asset.name }}
                </n-ellipsis>
                <span class="texture-size">{{ formatFileSize(asset.meta?.size) }}</span>
              </div>
            </div>
          </div>
        </n-scrollbar>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <n-icon size="48" color="#666">
            <FolderOpenOutline />
          </n-icon>
          <template v-if="textureAssets.length === 0">
            <div class="empty-text">暂无贴图</div>
            <div class="empty-hint">上传贴图或导入 PBR 贴图压缩包</div>
          </template>
          <template v-else>
            <div class="empty-text">无匹配结果</div>
            <div class="empty-hint">
              {{ searchKeyword ? `未找到包含"${searchKeyword}"的贴图` : '该分类下暂无贴图' }}
            </div>
            <n-button size="small" @click="searchKeyword = ''; selectedCategory = 'all'">
              重置筛选
            </n-button>
          </template>
        </div>
      </n-spin>
    </div>

    <!-- ZIP 解析结果弹窗 -->
    <n-modal
      v-model:show="showZipDialog"
      preset="card"
      title="导入 PBR 贴图包"
      :style="{ width: '500px' }"
      :mask-closable="!zipUploading"
      :closable="!zipUploading"
    >
      <div v-if="zipParseResult" class="zip-result">
        <div class="zip-info">
          <n-icon size="20" color="#18a058">
            <CheckmarkCircleOutline />
          </n-icon>
          <span>已识别 {{ zipParseResult.textures.length }} 张贴图</span>
        </div>

        <!-- 识别的贴图列表 -->
        <n-scrollbar style="max-height: 300px;">
          <div class="texture-list">
            <div
              v-for="texture in zipParseResult.textures"
              :key="texture.fileName"
              class="texture-list-item"
            >
              <div class="texture-slot-badge">
                {{ getTextureSlotLabel(texture.slot) }}
              </div>
              <span class="texture-file-name">{{ texture.fileName }}</span>
            </div>
          </div>
        </n-scrollbar>

        <!-- 未识别的文件 -->
        <div v-if="zipParseResult.unmatched.length > 0" class="unmatched-section">
          <div class="unmatched-header">
            <n-icon size="16" color="#f0a020">
              <CloseCircleOutline />
            </n-icon>
            <span>{{ zipParseResult.unmatched.length }} 个文件未识别（将跳过）</span>
          </div>
          <n-collapse>
            <n-collapse-item title="查看未识别文件">
              <div class="unmatched-list">
                <span v-for="name in zipParseResult.unmatched" :key="name" class="unmatched-item">
                  {{ name }}
                </span>
              </div>
            </n-collapse-item>
          </n-collapse>
        </div>

        <!-- 上传进度 -->
        <n-progress
          v-if="zipUploading"
          type="line"
          :percentage="zipUploadProgress"
          :indicator-placement="'inside'"
          processing
        />
      </div>

      <template #footer>
        <n-space justify="end">
          <n-button @click="showZipDialog = false" :disabled="zipUploading">
            取消
          </n-button>
          <n-button
            type="primary"
            @click="uploadZipTextures"
            :loading="zipUploading"
            :disabled="!zipParseResult?.textures.length"
          >
            上传全部
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>

<style scoped>
.texture-manager {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--n-color, #fff);
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color, #e0e0e0);
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.title {
  font-size: 14px;
  font-weight: 500;
}

.select-hint {
  font-size: 13px;
  color: var(--n-text-color-3, #999);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 搜索和分类栏 */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--n-border-color, #e0e0e0);
  flex-shrink: 0;
}

.search-input {
  width: 100%;
}

.category-tabs {
  display: flex;
  gap: 4px;
  padding: 2px 0;
  overflow-x: auto;
  scrollbar-width: thin;
}

.category-tabs::-webkit-scrollbar {
  height: 4px;
}

.category-tabs::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 2px;
}

.category-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  font-size: 12px;
  border: none;
  border-radius: 4px;
  background: var(--n-color-embedded, #f5f5f5);
  color: var(--n-text-color-2, #666);
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;
}

.category-tab:hover {
  background: var(--n-color-hover, #e8e8e8);
}

.category-tab.active {
  background: var(--n-primary-color, #18a058);
  color: white;
}

.category-count {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 10px;
  background: rgba(0, 0, 0, 0.1);
}

.category-tab.active .category-count {
  background: rgba(255, 255, 255, 0.3);
}

.texture-grid-container {
  flex: 1;
  overflow: hidden;
  padding: 12px;
}

.texture-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
  gap: 12px;
}

.texture-item {
  border-radius: 8px;
  overflow: hidden;
  background: var(--n-color-embedded, #f5f5f5);
  cursor: pointer;
  transition: all 0.2s;
}

.texture-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.texture-item.select-mode:hover {
  outline: 2px solid var(--n-primary-color, #18a058);
}

.texture-preview {
  width: 100%;
  aspect-ratio: 1;
  position: relative;
  overflow: hidden;
  background: linear-gradient(45deg, #ddd 25%, transparent 25%),
    linear-gradient(-45deg, #ddd 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ddd 75%),
    linear-gradient(-45deg, transparent 75%, #ddd 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0px;
}

.texture-preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.texture-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.2s;
}

.texture-item:hover .texture-overlay {
  opacity: 1;
}

.texture-info {
  padding: 8px;
}

.texture-name {
  font-size: 12px;
  color: var(--n-text-color-1, #333);
  margin-bottom: 2px;
}

.texture-size {
  font-size: 10px;
  color: var(--n-text-color-3, #999);
}

.empty-state {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
}

.empty-text {
  font-size: 14px;
  color: var(--n-text-color-2, #666);
}

.empty-hint {
  font-size: 12px;
  color: var(--n-text-color-3, #999);
}

/* ZIP 结果弹窗样式 */
.zip-result {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.zip-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--n-text-color-1, #333);
}

.texture-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.texture-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  background: var(--n-color-embedded, #f5f5f5);
  border-radius: 6px;
}

.texture-slot-badge {
  font-size: 11px;
  padding: 2px 8px;
  background: var(--n-primary-color, #18a058);
  color: white;
  border-radius: 4px;
  white-space: nowrap;
}

.texture-file-name {
  font-size: 13px;
  color: var(--n-text-color-2, #666);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.unmatched-section {
  margin-top: 8px;
}

.unmatched-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #f0a020;
  margin-bottom: 8px;
}

.unmatched-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.unmatched-item {
  font-size: 12px;
  padding: 4px 8px;
  background: var(--n-color-embedded, #f5f5f5);
  border-radius: 4px;
  color: var(--n-text-color-3, #999);
}
</style>
