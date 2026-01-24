/**
 * 场景选择 Store
 * 
 * 职责：
 * - 当前选中的对象ID
 * - 变换模式和空间
 * - 变换控制器步幅（snap）
 * - 编辑模式状态
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useSceneSelectionStore = defineStore('sceneSelection', () => {

  // ==================== 选择状态 ====================
  
  /** 当前选中的对象ID */
  const selectedObjectId = ref<string | null>(null)
  
  /** 选择版本号（用于触发重新渲染） */
  const selectionVersion = ref(0)

  // ==================== 变换控制 ====================
  
  /** 变换模式：平移、旋转、缩放 */
  const transformMode = ref<'translate' | 'rotate' | 'scale'>('translate')
  
  /** 变换空间：世界坐标 或 本地坐标 */
  const transformSpace = ref<'world' | 'local'>('world')
  
  /** 变换控制器步幅（snap） */
  const transformSnap = ref({
    enabled: false,        // 是否启用步幅
    translation: 0,        // 位移步幅（单位：米）
    translationEnabled: false, // 位移步幅是否启用
    rotation: 0,           // 旋转步幅（单位：弧度）
    rotationEnabled: false,    // 旋转步幅是否启用
    scale: 0,              // 缩放步幅（单位：倍数）
    scaleEnabled: false        // 缩放步幅是否启用
  })

  // ==================== 编辑模式 ====================
  
  /** 是否为编辑模式（预览模式下禁用 TransformControls 等编辑功能） */
  const isEditMode = ref(true)

  // ==================== 计算属性 ====================
  
  /** 是否有选中的对象 */
  const hasSelection = computed(() => selectedObjectId.value !== null)

  // ==================== 选择操作 ====================
  
  /**
   * 选择对象
   * @param id 对象ID，传 null 清空选择
   */
  function select(id: string | null) {
    selectedObjectId.value = id
    selectionVersion.value++
  }
  
  /**
   * 清空选择
   */
  function clearSelection() {
    selectedObjectId.value = null
    selectionVersion.value++
  }
  
  /**
   * 增加选择版本号（用于强制刷新）
   */
  function bumpSelectionVersion() {
    selectionVersion.value++
  }

  // ==================== 变换模式操作 ====================
  
  /**
   * 设置变换模式
   */
  function setTransformMode(mode: 'translate' | 'rotate' | 'scale') {
    transformMode.value = mode
  }
  
  /**
   * 切换变换模式
   */
  function cycleTransformMode() {
    const modes: Array<'translate' | 'rotate' | 'scale'> = ['translate', 'rotate', 'scale']
    const currentIndex = modes.indexOf(transformMode.value)
    const nextIndex = (currentIndex + 1) % modes.length
    transformMode.value = modes[nextIndex] ?? 'translate'
  }
  
  /**
   * 设置变换空间
   */
  function setTransformSpace(space: 'world' | 'local') {
    transformSpace.value = space
  }
  
  /**
   * 切换变换空间
   */
  function toggleTransformSpace() {
    transformSpace.value = transformSpace.value === 'world' ? 'local' : 'world'
  }

  // ==================== 编辑模式操作 ====================
  
  /**
   * 设置编辑模式
   */
  function setEditMode(isEdit: boolean) {
    isEditMode.value = isEdit
  }
  
  /**
   * 切换编辑模式
   */
  function toggleEditMode() {
    isEditMode.value = !isEditMode.value
  }

  // ==================== 返回 ====================
  
  return {
    // 选择状态
    selectedObjectId,
    selectionVersion,
    hasSelection,
    
    // 变换控制
    transformMode,
    transformSpace,
    transformSnap,
    
    // 编辑模式
    isEditMode,
    
    // 选择操作
    select,
    clearSelection,
    bumpSelectionVersion,
    
    // 变换模式操作
    setTransformMode,
    cycleTransformMode,
    setTransformSpace,
    toggleTransformSpace,
    
    // 编辑模式操作
    setEditMode,
    toggleEditMode
  }
})
