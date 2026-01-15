/**
 * 命令模式实现 - 类似 Blender 的撤销/重做系统
 * 
 * 设计原则：
 * 1. 每个操作都是一个命令对象
 * 2. 命令包含执行和撤销方法
 * 3. 支持命令合并（连续的同类型操作）
 * 4. 支持操作分组（批量操作）
 */

import type { SceneObjectData } from '@/interfaces/sceneInterface'
import type { useSceneStore } from '@/stores/modules/useScene.store'

type SceneStore = ReturnType<typeof useSceneStore>

/**
 * 命令接口
 */
export interface ICommand {
  /** 执行命令 */
  execute(): void
  /** 撤销命令 */
  undo(): void
  /** 尝试与另一个命令合并（返回 true 表示已合并） */
  merge?(other: ICommand): boolean
  /** 获取命令描述（用于历史显示） */
  getDescription(): string
  /** 命令时间戳 */
  timestamp: number
}

/**
 * 命令基类
 */
export abstract class BaseCommand implements ICommand {
  timestamp = Date.now()
  
  abstract execute(): void
  abstract undo(): void
  abstract getDescription(): string
  
  merge?(_other: ICommand): boolean {
    return false
  }
}

/**
 * 添加对象命令
 */
export class AddObjectCommand extends BaseCommand {
  private getStore: () => SceneStore
  private objectData: SceneObjectData
  
  constructor(
    getStore: () => SceneStore,
    objectData: SceneObjectData
  ) {
    super()
    this.getStore = getStore
    this.objectData = objectData
  }
  
  execute() {
    this.getStore().addSceneObjectData(this.objectData, { skipHistory: true } as any)
  }
  
  undo() {
    this.getStore().removeSceneObjectData(this.objectData.id, { skipHistory: true } as any)
  }
  
  getDescription() {
    return `添加 ${this.objectData.name || this.objectData.type}`
  }
}

/**
 * 删除对象命令
 */
export class RemoveObjectCommand extends BaseCommand {
  private getStore: () => SceneStore
  private objectId: string
  private removedData: SceneObjectData | null = null
  private removedChildren: SceneObjectData[] = []
  
  constructor(
    getStore: () => SceneStore,
    objectId: string
  ) {
    super()
    this.getStore = getStore
    this.objectId = objectId
    // 保存被删除的对象数据（包括子对象）
    const store = this.getStore()
    const obj = store.objectDataList.find(o => o.id === objectId)
    if (obj) {
      this.removedData = JSON.parse(JSON.stringify(obj))
      // 收集所有子对象
      const collectChildren = (parentId: string) => {
        store.objectDataList.forEach(item => {
          if (item.parentId === parentId) {
            this.removedChildren.push(JSON.parse(JSON.stringify(item)))
            collectChildren(item.id)
          }
        })
      }
      collectChildren(objectId)
    }
  }
  
  execute() {
    this.getStore().removeSceneObjectData(this.objectId, { skipHistory: true } as any)
  }
  
  undo() {
    if (this.removedData) {
      const store = this.getStore()
      // 先恢复父对象
      store.addSceneObjectData(this.removedData, { skipHistory: true } as any)
      // 再恢复子对象
      for (const child of this.removedChildren) {
        store.addSceneObjectData(child, { skipHistory: true } as any)
      }
    }
  }
  
  getDescription() {
    return `删除 ${this.removedData?.name || this.objectId}`
  }
}

/**
 * 更新 Transform 命令（支持合并）
 */
export class UpdateTransformCommand extends BaseCommand {
  private getStore: () => SceneStore
  private objectId: string
  private newTransform: SceneObjectData['transform']
  private initialTransform: SceneObjectData['transform']
  private mergeWindow = 500 // 500ms 内的操作可以合并
  
  constructor(
    getStore: () => SceneStore,
    objectId: string,
    newTransform: SceneObjectData['transform'],
    initialTransform?: SceneObjectData['transform'] // 可选：传入更新前的 transform
  ) {
    super()
    this.getStore = getStore
    this.objectId = objectId
    this.newTransform = newTransform
    // 如果传入了初始状态，使用传入的；否则从 store 获取（可能已经是更新后的值）
    if (initialTransform) {
      this.initialTransform = JSON.parse(JSON.stringify(initialTransform))
    } else {
      const store = this.getStore()
      const obj = store.objectDataList.find(o => o.id === objectId)
      this.initialTransform = obj 
        ? JSON.parse(JSON.stringify(obj.transform))
        : JSON.parse(JSON.stringify(newTransform))
    }
  }
  
  execute() {
    this.getStore().updateSceneObjectData(this.objectId, {
      transform: this.newTransform
    }, { skipHistory: true } as any)
  }
  
  undo() {
    this.getStore().updateSceneObjectData(this.objectId, {
      transform: this.initialTransform
    }, { skipHistory: true } as any)
  }
  
  merge(other: ICommand): boolean {
    if (other instanceof UpdateTransformCommand && 
        other.objectId === this.objectId &&
        (other.timestamp - this.timestamp) < this.mergeWindow) {
      // 保留初始状态，更新目标状态
      this.newTransform = other.newTransform
      this.timestamp = other.timestamp // 更新时间戳
      return true
    }
    return false
  }
  
  getDescription() {
    const store = this.getStore()
    const obj = store.objectDataList.find(o => o.id === this.objectId)
    return `移动 ${obj?.name || this.objectId}`
  }
}

/**
 * 深拷贝函数，保留 undefined 值（JSON.stringify 会忽略 undefined）
 */
function deepClonePreservingUndefined<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClonePreservingUndefined(item)) as any
  }
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      const value = (obj as any)[key]
      // 即使值是 undefined，也要包含在克隆对象中
      ;(cloned as any)[key] = deepClonePreservingUndefined(value)
    }
  }
  return cloned
}

/**
 * 更新对象属性命令
 */
export class UpdateObjectCommand extends BaseCommand {
  private getStore: () => SceneStore
  private objectId: string
  private patch: Partial<SceneObjectData>
  private initialData: Partial<SceneObjectData>
  
  constructor(
    getStore: () => SceneStore,
    objectId: string,
    patch: Partial<SceneObjectData>,
    initialData?: Partial<SceneObjectData> // 可选：传入更新前的状态
  ) {
    super()
    this.getStore = getStore
    this.objectId = objectId
    this.patch = patch
    if (initialData) {
      // 使用传入的初始状态
      // 使用自定义深拷贝函数，保留 undefined 值
      this.initialData = deepClonePreservingUndefined(initialData)
    } else {
      // 从 store 获取（注意：调用者需要确保在修改前调用）
      const store = this.getStore()
      const obj = store.objectDataList.find(o => o.id === objectId)
      if (obj) {
        // 只保存被修改的字段
        this.initialData = {}
        Object.keys(patch).forEach(key => {
          const k = key as keyof SceneObjectData
          // 即使值是 undefined，也要保存（用于恢复 parentId: undefined 的情况）
          if (k in obj) {
            ;(this.initialData as any)[k] = deepClonePreservingUndefined(obj[k])
          }
        })
      } else {
        this.initialData = {}
      }
    }
  }
  
  execute() {
    this.getStore().updateSceneObjectData(this.objectId, this.patch, { skipHistory: true } as any)
  }
  
  undo() {
    this.getStore().updateSceneObjectData(this.objectId, this.initialData, { skipHistory: true } as any)
  }
  
  merge(other: ICommand): boolean {
    if (other instanceof UpdateObjectCommand && 
        other.objectId === this.objectId &&
        (other.timestamp - this.timestamp) < 500) {
      // 合并补丁，但保留原始的 initialData（这样撤销时能恢复到最初状态）
      Object.assign(this.patch, other.patch)
      this.timestamp = other.timestamp
      return true
    }
    return false
  }
  
  getDescription() {
    const store = this.getStore()
    const obj = store.objectDataList.find(o => o.id === this.objectId)
    const changedFields = Object.keys(this.patch).join(', ')
    return `修改 ${obj?.name || this.objectId} (${changedFields})`
  }
}

/**
 * 操作分组命令（批量操作）
 */
export class UndoGroup extends BaseCommand {
  private commands: ICommand[] = []
  private description: string
  
  constructor(description: string = '批量操作') {
    super()
    this.description = description
  }
  
  addCommand(cmd: ICommand) {
    this.commands.push(cmd)
  }
  
  execute() {
    this.commands.forEach(cmd => cmd.execute())
  }
  
  undo() {
    // 反向执行
    for (let i = this.commands.length - 1; i >= 0; i--) {
      const cmd = this.commands[i]
      if (cmd !== undefined) {
        cmd.undo()
      }
    }
  }
  
  getDescription() {
    return `${this.description} (${this.commands.length} 项)`
  }
  
  isEmpty() {
    return this.commands.length === 0
  }
}

/**
 * 历史管理器
 */
export class HistoryManager {
  private undoStack: ICommand[] = []
  private redoStack: ICommand[] = []
  private maxHistory = 200
  private currentGroup: UndoGroup | null = null
  
  /**
   * 推入命令到历史栈
   */
  pushCommand(command: ICommand) {
    // 如果当前有分组，添加到分组中
    if (this.currentGroup) {
      this.currentGroup.addCommand(command)
      return
    }
    
    // 尝试与上一个命令合并
    const lastCommand = this.undoStack[this.undoStack.length - 1]
    if (lastCommand?.merge?.(command)) {
      return // 已合并，不需要新命令
    }
    
    this.undoStack.push(command)
    this.redoStack = [] // 清空重做栈
    
    // 限制历史数量
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }
  }
  
  /**
   * 撤销
   */
  undo(): boolean {
    if (this.undoStack.length === 0) return false
    
    const command = this.undoStack.pop()!
    try {
      command.undo()
      this.redoStack.push(command)
      return true
    } catch (error) {
      // 将命令放回栈中
      this.undoStack.push(command)
      return false
    }
  }
  
  /**
   * 重做
   */
  redo(): boolean {
    if (this.redoStack.length === 0) return false
    
    const command = this.redoStack.pop()!
    try {
      command.execute()
      this.undoStack.push(command)
      return true
    } catch (error) {
      // 将命令放回栈中
      this.redoStack.push(command)
      return false
    }
  }
  
  /**
   * 开始操作分组
   */
  beginGroup(description?: string) {
    if (this.currentGroup) {
      this.endGroup()
    }
    this.currentGroup = new UndoGroup(description)
  }
  
  /**
   * 结束操作分组
   */
  endGroup() {
    if (this.currentGroup && !this.currentGroup.isEmpty()) {
      this.pushCommand(this.currentGroup)
    }
    this.currentGroup = null
  }
  
  /**
   * 清空历史
   */
  clear() {
    this.undoStack = []
    this.redoStack = []
    this.currentGroup = null
  }
  
  /**
   * 获取撤销历史列表
   */
  getUndoHistory(): Array<{ description: string; timestamp: number }> {
    return this.undoStack.map(cmd => ({
      description: cmd.getDescription(),
      timestamp: cmd.timestamp
    }))
  }
  
  /**
   * 获取重做历史列表
   */
  getRedoHistory(): Array<{ description: string; timestamp: number }> {
    return this.redoStack.map(cmd => ({
      description: cmd.getDescription(),
      timestamp: cmd.timestamp
    }))
  }
  
  /**
   * 是否可以撤销
   */
  canUndo(): boolean {
    return this.undoStack.length > 0
  }
  
  /**
   * 是否可以重做
   */
  canRedo(): boolean {
    return this.redoStack.length > 0
  }
  
  /**
   * 获取历史数量
   */
  getHistoryCount(): { undo: number; redo: number } {
    return {
      undo: this.undoStack.length,
      redo: this.redoStack.length
    }
  }
}
