import { defineStore } from 'pinia'
import { nextTick, ref } from 'vue'

export type AssetCategory = 'model' | 'pointCloud' | 'texture' | 'material' | 'hdri'
export type BottomPanelMode = 'assets' | 'timeline'

export const useUiEditorStore = defineStore('uiEditor', () => {
  const tabKey = ref<string | null>(null)
  
  // 底部面板状态
  const isAssetPanelOpen = ref(false)
  const assetPanelHeight = ref(300)
  const activeAssetCategory = ref<AssetCategory>('model')
  const bottomPanelMode = ref<BottomPanelMode>('assets')

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
    assetPanelHeight.value = Math.max(150, Math.min(500, height))
  }

  function setBottomPanelMode(mode: BottomPanelMode) {
    bottomPanelMode.value = mode
    if (!isAssetPanelOpen.value) {
      isAssetPanelOpen.value = true
    }
  }

  function openTimeline() {
    setBottomPanelMode('timeline')
  }

  return {
    tabKey,
    setTabKey,
    resetTabForSelection,
    // 底部面板
    isAssetPanelOpen,
    assetPanelHeight,
    activeAssetCategory,
    bottomPanelMode,
    toggleAssetPanel,
    openAssetPanel,
    closeAssetPanel,
    setAssetCategory,
    setAssetPanelHeight,
    setBottomPanelMode,
    openTimeline
  }
})