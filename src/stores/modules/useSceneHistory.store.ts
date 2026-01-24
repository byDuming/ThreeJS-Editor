/**
 * 场景历史 Store
 * 
 * 职责：
 * - 撤销/重做功能
 * - 命令模式历史管理
 * - 快照机制（旧模式，向后兼容）
 */

import { defineStore } from 'pinia'
import { ref, computed, toRaw } from 'vue'
import { HistoryManager, type ICommand } from '@/utils/commandPattern'
import type { SceneObjectData } from '@/interfaces/sceneInterface'

export type SceneSnapshot = {
  objectDataList: SceneObjectData[]
  selectedObjectId: string | null
  aIds: number
}

export const useSceneHistoryStore = defineStore('sceneHistory', () => {

  // ==================== 命令模式历史管理器 ====================
  
  /** 命令模式历史管理器（推荐使用） */
  const historyManager = new HistoryManager()
  
  /** 响应式版本号（用于触发UI更新） */
  const historyVersion = ref(0)
  
  /** 是否使用命令模式（默认开启） */
  const useCommandPattern = ref(true)

  // ==================== 旧的快照机制（向后兼容） ====================
  
  /** 撤回栈：保存历史快照 */
  const undoStack = ref<SceneSnapshot[]>([])
  
  /** 回退栈：保存已撤回的快照 */
  const redoStack = ref<SceneSnapshot[]>([])
  
  /** 快照恢复中，防止递归记录 */
  const isRestoring = ref(false)
  
  /** 最多保留的快照数量 */
  const maxHistory = 50
  
  /** 去抖计时器 */
  const historyDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)
  
  /** 上一次用于入栈的快照 */
  const lastSnapshot = ref<SceneSnapshot | null>(null)
  
  /** 标记是否有待处理的关键操作 */
  const pendingCriticalOperation = ref(false)

  // ==================== 快照序列化配置 ====================
  
  const snapshotKeyMode = ref<'blacklist' | 'whitelist'>('blacklist')
  const snapshotKeyList = ref<string[]>([
    'file',
    'files',
    'image',
    'images',
    'texture',
    'textures',
    '__threeObject'
  ])

  // ==================== 场景状态 ====================
  
  /** 场景是否加载完成（用于控制撤销/重做按钮的可用状态） */
  const isSceneReady = ref(false)

  // ==================== 计算属性 ====================
  
  /** 是否可以撤销 */
  const canUndo = computed(() => {
    if (!isSceneReady.value) return false
    void historyVersion.value // 读取以建立响应式依赖
    if (useCommandPattern.value) {
      return historyManager.canUndo()
    } else {
      return undoStack.value.length > 0
    }
  })
  
  /** 是否可以重做 */
  const canRedo = computed(() => {
    if (!isSceneReady.value) return false
    void historyVersion.value
    if (useCommandPattern.value) {
      return historyManager.canRedo()
    } else {
      return redoStack.value.length > 0
    }
  })

  // ==================== 快照工具方法 ====================
  
  function setSnapshotKeyMode(mode: 'blacklist' | 'whitelist') {
    snapshotKeyMode.value = mode
  }

  function setSnapshotKeyList(keys: string[]) {
    snapshotKeyList.value = Array.from(new Set(keys))
  }

  /** 深拷贝并过滤不可序列化对象，保证快照稳定可用 */
  function cloneSnapshot(value: SceneSnapshot): SceneSnapshot {
    const raw = toRaw(value)
    const seen = new WeakSet<object>()
    const json = JSON.stringify(raw, (key, val) => {
      if (key) {
        const keyList = snapshotKeyList.value
        if (snapshotKeyMode.value === 'blacklist' && keyList.includes(key)) return undefined
        if (snapshotKeyMode.value === 'whitelist' && !keyList.includes(key)) return undefined
      }
      if (typeof val === 'function' || typeof val === 'symbol') return undefined
      if (typeof File !== 'undefined' && val instanceof File) return undefined
      if (typeof Blob !== 'undefined' && val instanceof Blob) return undefined
      if (typeof ImageBitmap !== 'undefined' && val instanceof ImageBitmap) return undefined
      if (typeof window !== 'undefined') {
        if (val === window) return undefined
        if (typeof Window !== 'undefined' && val instanceof Window) return undefined
      }
      if (val && typeof val === 'object') {
        if (seen.has(val)) return undefined
        seen.add(val)
      }
      return val
    })
    return JSON.parse(json) as SceneSnapshot
  }

  // ==================== 命令模式操作 ====================
  
  /**
   * 推入命令到历史栈
   */
  function pushCommand(command: ICommand) {
    historyManager.pushCommand(command)
    historyVersion.value++
  }
  
  /**
   * 撤销
   */
  function undo(): boolean {
    if (!canUndo.value) return false
    
    if (useCommandPattern.value) {
      const success = historyManager.undo()
      if (success) {
        historyVersion.value++
      }
      return success
    } else {
      const snapshot = undoStack.value.pop()
      if (!snapshot) return false
      redoStack.value.push(lastSnapshot.value!)
      lastSnapshot.value = snapshot
      return true
    }
  }
  
  /**
   * 重做
   */
  function redo(): boolean {
    if (!canRedo.value) return false
    
    if (useCommandPattern.value) {
      const success = historyManager.redo()
      if (success) {
        historyVersion.value++
      }
      return success
    } else {
      const snapshot = redoStack.value.pop()
      if (!snapshot) return false
      undoStack.value.push(lastSnapshot.value!)
      lastSnapshot.value = snapshot
      return true
    }
  }

  // ==================== 快照模式操作 ====================
  
  /** 推入历史栈，并清空回退栈 */
  function pushHistorySnapshot(snapshot: SceneSnapshot) {
    if (isRestoring.value) return
    undoStack.value.push(cloneSnapshot(snapshot))
    if (undoStack.value.length > maxHistory) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  // ==================== 历史管理 ====================
  
  /**
   * 清空历史
   */
  function clear() {
    historyManager.clear()
    undoStack.value = []
    redoStack.value = []
    lastSnapshot.value = null
    if (historyDebounceTimer.value) {
      clearTimeout(historyDebounceTimer.value)
      historyDebounceTimer.value = null
    }
    historyVersion.value++
  }
  
  /**
   * 设置场景准备状态
   */
  function setSceneReady(ready: boolean) {
    isSceneReady.value = ready
  }
  
  /**
   * 设置恢复状态
   */
  function setRestoring(restoring: boolean) {
    isRestoring.value = restoring
  }
  
  /**
   * 设置上次快照
   */
  function setLastSnapshot(snapshot: SceneSnapshot | null) {
    lastSnapshot.value = snapshot ? cloneSnapshot(snapshot) : null
  }

  // ==================== 返回 ====================
  
  return {
    // 命令模式
    historyManager,
    historyVersion,
    useCommandPattern,
    
    // 快照模式
    undoStack,
    redoStack,
    isRestoring,
    lastSnapshot,
    pendingCriticalOperation,
    historyDebounceTimer,
    
    // 快照配置
    snapshotKeyMode,
    snapshotKeyList,
    setSnapshotKeyMode,
    setSnapshotKeyList,
    cloneSnapshot,
    
    // 场景状态
    isSceneReady,
    setSceneReady,
    
    // 计算属性
    canUndo,
    canRedo,
    
    // 命令模式操作
    pushCommand,
    undo,
    redo,
    
    // 快照模式操作
    pushHistorySnapshot,
    
    // 历史管理
    clear,
    setRestoring,
    setLastSnapshot
  }
})
