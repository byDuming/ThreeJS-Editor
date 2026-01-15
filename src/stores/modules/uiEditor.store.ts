import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'

export type AssetCategory = 'model' | 'texture' | 'material' | 'hdri'

export const useUiEditorStore = defineStore('uiEditor', () => {
  const tabKey = ref<string | null>(null)
  
  // 底部资产面板状态
  const isAssetPanelOpen = ref(false)
  const assetPanelHeight = ref(200)
  const activeAssetCategory = ref<AssetCategory>('model')

  function setTabKey(key: string | null) {
    tabKey.value = key
  }

  function resetTabForSelection() {
    nextTick(() => {
      tabKey.value = 'attributes-tab';
    })
  }

  function toggleAssetPanel() {
    isAssetPanelOpen.value = !isAssetPanelOpen.value
  }

  function openAssetPanel(category?: AssetCategory) {
    isAssetPanelOpen.value = true
    if (category) {
      activeAssetCategory.value = category
    }
  }

  function closeAssetPanel() {
    isAssetPanelOpen.value = false
  }

  function setAssetCategory(category: AssetCategory) {
    activeAssetCategory.value = category
  }

  function setAssetPanelHeight(height: number) {
    assetPanelHeight.value = Math.max(150, Math.min(400, height))
  }

  return {
    tabKey,
    setTabKey,
    resetTabForSelection,
    // 底部资产面板
    isAssetPanelOpen,
    assetPanelHeight,
    activeAssetCategory,
    toggleAssetPanel,
    openAssetPanel,
    closeAssetPanel,
    setAssetCategory,
    setAssetPanelHeight
  }
})