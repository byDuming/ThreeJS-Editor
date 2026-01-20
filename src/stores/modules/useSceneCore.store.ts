/**
 * 场景核心 Store
 * 
 * 职责：
 * - 基础场景数据（名称、版本、ID等）
 * - 对象数据列表（objectDataList）
 * - Three.js 对象映射（objectsMap）
 * - 基础 CRUD 操作（不带历史记录）
 * 
 * 注意：此 Store 为底层 Store，通常不直接使用
 * 请使用 useSceneStore 作为统一入口
 */

import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'
import type { Object3D, Scene } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import type { WebGLRenderer } from 'three'
import type { SceneObjectData } from '@/interfaces/sceneInterface'

export const useSceneCoreStore = defineStore('sceneCore', () => {
  // ==================== 基础信息 ====================
  
  /** 场景名称 */
  const name = ref('Untitled')
  
  /** 场景版本 */
  const version = ref(1)
  
  /** 对象自增ID */
  const aIds = ref(1)
  
  /** 当前场景ID（数据库ID） */
  const currentSceneId = ref<number | null>(null)
  
  /** 场景是否加载完成 */
  const isSceneReady = ref(false)

  // ==================== 核心数据 ====================
  
  /** 
   * 对象数据列表（逻辑层，可序列化）
   * 这是场景的"单一数据源"
   */
  const objectDataList = ref<SceneObjectData[]>([])
  
  /** 
   * Three.js 对象映射（渲染层）
   * key: SceneObjectData.id
   * value: Three.js Object3D
   */
  const objectsMap = shallowRef(new Map<string, Object3D>())

  // ==================== 渲染器引用 ====================
  
  /** Three.js 场景 */
  const threeScene = shallowRef<Scene | null>(null)
  
  /** Three.js 渲染器 */
  const renderer = shallowRef<WebGPURenderer | WebGLRenderer | null>(null)
  
  /** 渲染器设置 */
  const rendererSettings = ref({
    rendererType: 'webgl',
    antialias: true,
    shadows: true,
    shadowType: 'pcf',
    toneMapping: 'acesFilmic',
    toneMappingExposure: 1,
    outputColorSpace: 'srgb',
    useLegacyLights: false
  })

  // ==================== 计算属性 ====================
  
  /** 对象数量 */
  const objectCount = computed(() => objectDataList.value.length)
  
  /** 对象ID到数据的映射（用于快速查找） */
  const objectDataMap = computed(() => {
    const map = new Map<string, SceneObjectData>()
    for (const obj of objectDataList.value) {
      map.set(obj.id, obj)
    }
    return map
  })

  // ==================== 基础操作 ====================
  
  /**
   * 生成唯一ID
   */
  function generateId(prefix = 'obj'): string {
    return `${prefix}-${aIds.value++}`
  }
  
  /**
   * 根据ID获取对象数据
   */
  function getObjectById(id: string): SceneObjectData | undefined {
    return objectDataList.value.find(obj => obj.id === id)
  }
  
  /**
   * 根据ID获取 Three.js 对象
   */
  function getThreeObjectById(id: string): Object3D | undefined {
    return objectsMap.value.get(id)
  }
  
  /**
   * 设置 Three.js 场景
   */
  function setThreeScene(scene: Scene | null) {
    threeScene.value = scene
  }
  
  /**
   * 添加对象到映射
   */
  function addToObjectsMap(id: string, obj: Object3D) {
    const newMap = new Map(objectsMap.value)
    newMap.set(id, obj)
    objectsMap.value = newMap
  }
  
  /**
   * 从映射移除对象
   */
  function removeFromObjectsMap(id: string) {
    const newMap = new Map(objectsMap.value)
    newMap.delete(id)
    objectsMap.value = newMap
  }

  // ==================== CRUD 操作（无历史记录） ====================
  
  /**
   * 添加对象数据（底层方法，不记录历史）
   * @internal
   */
  function _addObjectData(data: SceneObjectData): SceneObjectData {
    // 确保ID存在
    if (!data.id) {
      data.id = generateId(data.type)
    }
    
    objectDataList.value.push(data)
    
    // 如果有父对象，更新父对象的 childrenIds
    if (data.parentId) {
      const parent = getObjectById(data.parentId)
      if (parent) {
        if (!parent.childrenIds) {
          parent.childrenIds = []
        }
        if (!parent.childrenIds.includes(data.id)) {
          parent.childrenIds.push(data.id)
        }
      }
    }
    
    return data
  }
  
  /**
   * 更新对象数据（底层方法，不记录历史）
   * @internal
   */
  function _updateObjectData(id: string, patch: Partial<SceneObjectData>): boolean {
    const index = objectDataList.value.findIndex(obj => obj.id === id)
    if (index === -1) return false
    
    const oldData = objectDataList.value[index]
    const newData = { ...oldData, ...patch }
    
    // 处理父对象变更
    if (oldData && patch.parentId !== undefined && patch.parentId !== oldData.parentId) {
      // 从旧父对象移除
      if (oldData.parentId) {
        const oldParent = getObjectById(oldData.parentId)
        if (oldParent?.childrenIds) {
          oldParent.childrenIds = oldParent.childrenIds.filter(cid => cid !== id)
        }
      }
      
      // 添加到新父对象
      if (patch.parentId) {
        const newParent = getObjectById(patch.parentId)
        if (newParent) {
          if (!newParent.childrenIds) {
            newParent.childrenIds = []
          }
          if (!newParent.childrenIds.includes(id)) {
            newParent.childrenIds.push(id)
          }
        }
      }
    }
    
    objectDataList.value[index] = newData as SceneObjectData
    return true
  }
  
  /**
   * 删除对象数据（底层方法，不记录历史）
   * @internal
   */
  function _removeObjectData(id: string): SceneObjectData | null {
    const index = objectDataList.value.findIndex(obj => obj.id === id)
    if (index === -1) return null
    
    const removed = objectDataList.value[index]
    if (!removed) return null
    
    // 从父对象的 childrenIds 中移除
    if (removed.parentId) {
      const parent = getObjectById(removed.parentId)
      if (parent?.childrenIds) {
        parent.childrenIds = parent.childrenIds.filter(cid => cid !== id)
      }
    }
    
    // 递归删除子对象
    if (removed.childrenIds) {
      for (const childId of [...removed.childrenIds]) {
        _removeObjectData(childId)
      }
    }
    
    // 从列表中移除
    objectDataList.value.splice(index, 1)
    
    // 从映射中移除
    removeFromObjectsMap(id)
    
    return removed
  }

  // ==================== 批量操作 ====================
  
  /**
   * 清空场景
   */
  function clearScene() {
    objectDataList.value = []
    objectsMap.value = new Map()
    aIds.value = 1
    isSceneReady.value = false
  }
  
  /**
   * 重置场景状态
   */
  function resetScene() {
    name.value = 'Untitled'
    version.value = 1
    currentSceneId.value = null
    clearScene()
  }

  // ==================== 查询方法 ====================
  
  /**
   * 获取根对象列表（没有父对象的对象）
   */
  function getRootObjects(): SceneObjectData[] {
    return objectDataList.value.filter(obj => !obj.parentId)
  }
  
  /**
   * 获取对象的子对象
   */
  function getChildren(parentId: string): SceneObjectData[] {
    return objectDataList.value.filter(obj => obj.parentId === parentId)
  }
  
  /**
   * 获取对象的所有后代
   */
  function getDescendants(parentId: string): SceneObjectData[] {
    const result: SceneObjectData[] = []
    const children = getChildren(parentId)
    
    for (const child of children) {
      result.push(child)
      result.push(...getDescendants(child.id))
    }
    
    return result
  }
  
  /**
   * 获取对象的所有祖先ID
   */
  function getAncestorIds(objectId: string): string[] {
    const result: string[] = []
    let current = getObjectById(objectId)
    
    while (current?.parentId) {
      result.push(current.parentId)
      current = getObjectById(current.parentId)
    }
    
    return result
  }
  
  /**
   * 按类型获取对象
   */
  function getObjectsByType(type: SceneObjectData['type']): SceneObjectData[] {
    return objectDataList.value.filter(obj => obj.type === type)
  }

  // ==================== 返回 ====================
  
  return {
    // 基础信息
    name,
    version,
    aIds,
    currentSceneId,
    isSceneReady,
    
    // 核心数据
    objectDataList,
    objectsMap,
    objectDataMap,
    objectCount,
    
    // 渲染器
    threeScene,
    renderer,
    rendererSettings,
    setThreeScene,
    addToObjectsMap,
    removeFromObjectsMap,
    
    // 基础操作
    generateId,
    getObjectById,
    getThreeObjectById,
    
    // CRUD（底层）
    _addObjectData,
    _updateObjectData,
    _removeObjectData,
    
    // 批量操作
    clearScene,
    resetScene,
    
    // 查询方法
    getRootObjects,
    getChildren,
    getDescendants,
    getAncestorIds,
    getObjectsByType
  }
})
