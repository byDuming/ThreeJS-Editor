<script setup lang="ts">
import { computed, ref } from 'vue'
import { usePluginManager } from '@/core'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { 
  ExtensionPuzzleOutline, 
  TrashOutline, 
  InformationCircleOutline,
  CubeOutline,
  GridOutline,
  MenuOutline,
  FlashOutline,
  HammerOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline
} from '@vicons/ionicons5'

const { manager, plugins } = usePluginManager()
const sceneStore = useSceneStore()

// 当前选中的插件
const selectedPluginId = ref<string | null>(null)

// 展开的插件ID列表
const expandedPluginIds = ref<Set<string>>(new Set())

// 搜索关键词
const searchKeyword = ref('')

// 过滤后的插件列表
const filteredPlugins = computed(() => {
  if (!searchKeyword.value.trim()) {
    return plugins.value
  }
  const keyword = searchKeyword.value.toLowerCase()
  return plugins.value.filter(plugin => 
    plugin.name.toLowerCase().includes(keyword) ||
    plugin.id.toLowerCase().includes(keyword) ||
    plugin.description?.toLowerCase().includes(keyword) ||
    plugin.author?.toLowerCase().includes(keyword)
  )
})

// 当前选中的插件详情
const selectedPlugin = computed(() => {
  if (!selectedPluginId.value) return null
  return plugins.value.find(p => p.id === selectedPluginId.value) || null
})

// 获取插件注册的扩展数量
function getPluginExtensions(pluginId: string) {
  const plugin = manager.getPlugin(pluginId)
  if (!plugin) return { objectTypes: 0, panels: 0, menuItems: 0, shortcuts: 0, toolbarItems: 0 }
  
  return {
    objectTypes: plugin.objectTypes?.length || 0,
    panels: plugin.panels?.length || 0,
    menuItems: plugin.menuItems?.length || 0,
    shortcuts: plugin.shortcuts?.length || 0,
    toolbarItems: plugin.toolbarItems?.length || 0
  }
}

// 卸载插件
async function handleUninstall(pluginId: string) {
  const plugin = plugins.value.find(p => p.id === pluginId)
  if (!plugin) return
  
  const confirmed = await new Promise<boolean>((resolve) => {
    if (sceneStore.dialogProvider) {
      sceneStore.dialogProvider.warning({
        title: '确认卸载',
        content: `确定要卸载插件 "${plugin.name}" 吗？\n\n此操作将移除该插件注册的所有扩展（对象类型、面板、菜单项等）。`,
        positiveText: '确认',
        negativeText: '取消',
        onPositiveClick: () => resolve(true),
        onNegativeClick: () => resolve(false),
        onClose: () => resolve(false)
      })
    } else {
      resolve(window.confirm(
        `确定要卸载插件 "${plugin.name}" 吗？\n\n` +
        `此操作将移除该插件注册的所有扩展（对象类型、面板、菜单项等）。`
      ))
    }
  })
  
  if (confirmed) {
    const success = manager.unregister(pluginId)
    if (success) {
      if (selectedPluginId.value === pluginId) {
        selectedPluginId.value = null
      }
      expandedPluginIds.value.delete(pluginId)
      sceneStore.notification?.success({
        title: '卸载成功',
        content: `插件 "${plugin.name}" 已卸载`,
        duration: 2000
      })
    } else {
      sceneStore.notification?.error({
        title: '卸载失败',
        content: `无法卸载插件 "${plugin.name}"，可能被其他插件依赖`,
        duration: 3000
      })
    }
  }
}

// 格式化版本号
function formatVersion(version: string) {
  return `v${version}`
}

// 检查插件是否有依赖
function hasDependencies(pluginId: string): boolean {
  const plugin = manager.getPlugin(pluginId)
  return !!(plugin?.dependencies && plugin.dependencies.length > 0)
}

// 获取插件的依赖列表
function getDependencies(pluginId: string): string[] {
  const plugin = manager.getPlugin(pluginId)
  return plugin?.dependencies || []
}
</script>

<template>
  <div class="plugin-manager-panel">
    <div class="panel-header">
      <h3 style="margin: 0; display: flex; align-items: center; gap: 8px;">
        <n-icon :size="20">
          <ExtensionPuzzleOutline />
        </n-icon>
        插件管理
      </h3>
      <div class="plugin-count">
        已安装 {{ plugins.length }} 个插件
      </div>
    </div>

    <!-- 搜索框 -->
    <div class="search-section">
      <n-input
        v-model:value="searchKeyword"
        placeholder="搜索插件..."
        clearable
        size="small"
      >
        <template #prefix>
          <n-icon><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg></n-icon>
        </template>
      </n-input>
    </div>

    <!-- 插件列表 -->
    <div class="plugin-list">
      <n-empty 
        v-if="filteredPlugins.length === 0" 
        description="暂无插件"
        style="margin-top: 40px;"
      />
      
      <div
        v-for="plugin in filteredPlugins"
        :key="plugin.id"
        class="plugin-item"
        :class="{ 'plugin-item-selected': selectedPluginId === plugin.id }"
        @click="selectedPluginId = plugin.id"
      >
        <div class="plugin-item-header">
          <div class="plugin-info">
            <div class="plugin-name">
              {{ plugin.name }}
              <n-tag :bordered="false" size="small" type="info" style="margin-left: 8px;">
                {{ formatVersion(plugin.version) }}
              </n-tag>
            </div>
            <div class="plugin-id">{{ plugin.id }}</div>
            <div v-if="plugin.description" class="plugin-description">
              {{ plugin.description }}
            </div>
          </div>
          <div class="plugin-actions">
            <n-button
              size="small"
              type="error"
              quaternary
              @click.stop="handleUninstall(plugin.id)"
            >
              <template #icon>
                <n-icon><TrashOutline /></n-icon>
              </template>
            </n-button>
          </div>
        </div>

        <!-- 插件扩展信息 -->
        <div class="plugin-extensions">
          <div class="extension-summary">
            <n-space size="small">
              <n-tag v-if="getPluginExtensions(plugin.id).objectTypes > 0" size="small" type="success">
                <template #icon>
                  <n-icon><CubeOutline /></n-icon>
                </template>
                {{ getPluginExtensions(plugin.id).objectTypes }} 对象类型
              </n-tag>
              <n-tag v-if="getPluginExtensions(plugin.id).panels > 0" size="small" type="info">
                <template #icon>
                  <n-icon><GridOutline /></n-icon>
                </template>
                {{ getPluginExtensions(plugin.id).panels }} 面板
              </n-tag>
              <n-tag v-if="getPluginExtensions(plugin.id).menuItems > 0" size="small" type="warning">
                <template #icon>
                  <n-icon><MenuOutline /></n-icon>
                </template>
                {{ getPluginExtensions(plugin.id).menuItems }} 菜单项
              </n-tag>
              <n-tag v-if="getPluginExtensions(plugin.id).shortcuts > 0" size="small" type="error">
                <template #icon>
                  <n-icon><FlashOutline /></n-icon>
                </template>
                {{ getPluginExtensions(plugin.id).shortcuts }} 快捷键
              </n-tag>
              <n-tag v-if="getPluginExtensions(plugin.id).toolbarItems > 0" size="small" type="default">
                <template #icon>
                  <n-icon><HammerOutline /></n-icon>
                </template>
                {{ getPluginExtensions(plugin.id).toolbarItems }} 工具栏项
              </n-tag>
            </n-space>
          </div>
        </div>

        <!-- 依赖信息 -->
        <div v-if="hasDependencies(plugin.id)" class="plugin-dependencies">
          <n-text depth="3" style="font-size: 12px;">
            依赖: {{ getDependencies(plugin.id).join(', ') }}
          </n-text>
        </div>
      </div>
    </div>

    <!-- 插件详情面板 -->
    <n-divider v-if="selectedPlugin" style="margin: 16px 0;" />
    
    <div v-if="selectedPlugin" class="plugin-details">
      <h4 style="margin: 0 0 12px 0; display: flex; align-items: center; gap: 8px;">
        <n-icon><InformationCircleOutline /></n-icon>
        插件详情
      </h4>
      
      <n-descriptions :column="1" size="small" bordered>
        <n-descriptions-item label="插件ID">
          <n-text code>{{ selectedPlugin.id }}</n-text>
        </n-descriptions-item>
        <n-descriptions-item label="名称">
          {{ selectedPlugin.name }}
        </n-descriptions-item>
        <n-descriptions-item label="版本">
          <n-tag type="info">{{ formatVersion(selectedPlugin.version) }}</n-tag>
        </n-descriptions-item>
        <n-descriptions-item v-if="selectedPlugin.description" label="描述">
          {{ selectedPlugin.description }}
        </n-descriptions-item>
        <n-descriptions-item v-if="selectedPlugin.author" label="作者">
          {{ selectedPlugin.author }}
        </n-descriptions-item>
        <n-descriptions-item v-if="hasDependencies(selectedPlugin.id)" label="依赖">
          <n-space size="small">
            <n-tag
              v-for="depId in getDependencies(selectedPlugin.id)"
              :key="depId"
              size="small"
              :type="manager.hasPlugin(depId) ? 'success' : 'error'"
            >
              <template #icon>
                <n-icon>
                  <CheckmarkCircleOutline v-if="manager.hasPlugin(depId)" />
                  <CloseCircleOutline v-else />
                </n-icon>
              </template>
              {{ depId }}
            </n-tag>
          </n-space>
        </n-descriptions-item>
      </n-descriptions>

      <!-- 扩展详情 -->
      <div class="extensions-detail" style="margin-top: 16px;">
        <h5 style="margin: 0 0 8px 0;">注册的扩展</h5>
        <n-space vertical size="small">
          <div v-if="getPluginExtensions(selectedPlugin.id).objectTypes > 0" class="extension-group">
            <n-text strong>对象类型:</n-text>
            <n-text depth="3">{{ getPluginExtensions(selectedPlugin.id).objectTypes }} 个</n-text>
          </div>
          <div v-if="getPluginExtensions(selectedPlugin.id).panels > 0" class="extension-group">
            <n-text strong>面板:</n-text>
            <n-text depth="3">{{ getPluginExtensions(selectedPlugin.id).panels }} 个</n-text>
          </div>
          <div v-if="getPluginExtensions(selectedPlugin.id).menuItems > 0" class="extension-group">
            <n-text strong>菜单项:</n-text>
            <n-text depth="3">{{ getPluginExtensions(selectedPlugin.id).menuItems }} 个</n-text>
          </div>
          <div v-if="getPluginExtensions(selectedPlugin.id).shortcuts > 0" class="extension-group">
            <n-text strong>快捷键:</n-text>
            <n-text depth="3">{{ getPluginExtensions(selectedPlugin.id).shortcuts }} 个</n-text>
          </div>
          <div v-if="getPluginExtensions(selectedPlugin.id).toolbarItems > 0" class="extension-group">
            <n-text strong>工具栏项:</n-text>
            <n-text depth="3">{{ getPluginExtensions(selectedPlugin.id).toolbarItems }} 个</n-text>
          </div>
          <n-empty
            v-if="Object.values(getPluginExtensions(selectedPlugin.id)).every(v => v === 0)"
            description="此插件未注册任何扩展"
            size="small"
            style="margin: 8px 0;"
          />
        </n-space>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plugin-manager-panel {
  padding: 16px;
  height: 100%;
  overflow-y: auto;
}

.panel-header {
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--n-border-color, #e0e0e0);
}

.plugin-count {
  margin-top: 8px;
  font-size: 12px;
  color: var(--n-text-color-3, #909399);
}

.search-section {
  margin-bottom: 16px;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.plugin-item {
  padding: 12px;
  border: 1px solid var(--n-border-color, #e0e0e0);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--n-color, #fff);
}

.plugin-item:hover {
  border-color: var(--n-primary-color, #409eff);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.plugin-item-selected {
  border-color: var(--n-primary-color, #409eff);
  background: var(--n-primary-color-hover, #ecf5ff);
}

.plugin-item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.plugin-info {
  flex: 1;
  min-width: 0;
}

.plugin-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
}

.plugin-id {
  font-size: 12px;
  color: var(--n-text-color-3, #909399);
  font-family: monospace;
  margin-bottom: 4px;
}

.plugin-description {
  font-size: 12px;
  color: var(--n-text-color-2, #606266);
  margin-top: 4px;
  line-height: 1.4;
}

.plugin-actions {
  flex-shrink: 0;
}

.plugin-extensions {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--n-border-color, #e0e0e0);
}

.extension-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.plugin-dependencies {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--n-border-color, #e0e0e0);
}

.plugin-details {
  padding-top: 8px;
}

.extensions-detail {
  padding: 12px;
  background: var(--n-color-hover, #f5f7fa);
  border-radius: 6px;
}

.extension-group {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 0;
}
</style>
