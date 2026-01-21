/**
 * 插件管理器
 * 
 * 职责：
 * - 插件的注册、卸载和生命周期管理
 * - 扩展点（对象类型、面板、菜单等）的统一管理
 * - 事件分发和钩子调用
 */

import { ref, computed } from 'vue'
import type { Camera, Scene, WebGLRenderer } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import type {
  EnginePlugin,
  EngineContext,
  ObjectTypeExtension,
  PanelExtension,
  MenuItemExtension,
  ShortcutExtension,
  ToolbarItemExtension,
  PluginHooks,
  PluginMetadata
} from './plugin'
import { getPluginMetadata } from './plugin'
import type { SceneObjectData } from '@/interfaces/sceneInterface'

/**
 * 事件处理器类型
 */
type EventHandler = (...args: any[]) => void

/**
 * 插件管理器类
 */
export class PluginManager {
  // ==================== 插件存储 ====================
  
  /** 已注册的插件 */
  private plugins = new Map<string, EnginePlugin>()
  
  /** 对象类型扩展 */
  private objectTypes = new Map<string, ObjectTypeExtension>()
  
  /** 面板扩展 */
  private panels = new Map<string, PanelExtension>()
  
  /** 菜单项扩展 */
  private menuItems = new Map<string, MenuItemExtension>()
  
  /** 快捷键扩展 */
  private shortcuts = new Map<string, ShortcutExtension>()
  
  /** 工具栏项扩展 */
  private toolbarItems = new Map<string, ToolbarItemExtension>()
  
  /** 事件监听器 */
  private eventListeners = new Map<string, Set<EventHandler>>()
  
  /** 引擎上下文 */
  private context: EngineContext | null = null
  
  /** 响应式版本号（用于触发UI更新） */
  private _version = ref(0)

  // ==================== 初始化 ====================
  
  /**
   * 设置引擎上下文
   */
  setContext(context: EngineContext) {
    this.context = context
  }
  
  /**
   * 获取引擎上下文
   */
  getContext(): EngineContext | null {
    return this.context
  }
  
  /**
   * 创建引擎上下文
   */
  createContext(
    stores: EngineContext['stores'],
    three: { scene: Scene | null; camera: Camera | null; renderer: WebGLRenderer | WebGPURenderer | null }
  ): EngineContext {
    const self = this
    
    return {
      stores,
      three,
      
      // 注册函数
      registerObjectType: (ext) => self.registerObjectType(ext),
      registerPanel: (ext) => self.registerPanel(ext),
      registerMenuItem: (ext) => self.registerMenuItem(ext),
      registerShortcut: (ext) => self.registerShortcut(ext),
      registerToolbarItem: (ext) => self.registerToolbarItem(ext),
      
      // 取消注册函数
      unregisterObjectType: (type) => self.unregisterObjectType(type),
      unregisterPanel: (id) => self.unregisterPanel(id),
      unregisterMenuItem: (id) => self.unregisterMenuItem(id),
      unregisterShortcut: (id) => self.unregisterShortcut(id),
      unregisterToolbarItem: (id) => self.unregisterToolbarItem(id),
      
      // 事件系统
      on: (event, handler) => self.on(event, handler),
      off: (event, handler) => self.off(event, handler),
      emit: (event, ...args) => self.emit(event, ...args),
      
      // 工具函数
      utils: {
        generateId: (prefix = 'obj') => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        notify: (options) => {
          const notification = stores.scene.notification
          if (notification) {
            notification[options.type]({
              title: options.title,
              content: options.content
            })
          }
        },
        confirm: async (options) => {
          return new Promise((resolve) => {
            const dialog = stores.scene.dialogProvider
            if (dialog) {
              dialog.warning({
                title: options.title,
                content: options.content,
                positiveText: '确定',
                negativeText: '取消',
                onPositiveClick: () => resolve(true),
                onNegativeClick: () => resolve(false),
                onClose: () => resolve(false)
              })
            } else {
              resolve(window.confirm(`${options.title}\n${options.content}`))
            }
          })
        }
      }
    }
  }

  // ==================== 插件管理 ====================
  
  /**
   * 注册插件
   */
  async register(plugin: EnginePlugin): Promise<boolean> {
    if (!this.context) {
      console.error(`[PluginManager] Cannot register plugin ${plugin.id}: context not set`)
      return false
    }
    
    // 检查是否已注册
    if (this.plugins.has(plugin.id)) {
      console.warn(`[PluginManager] Plugin ${plugin.id} is already registered`)
      return false
    }
    
    // 检查依赖
    if (plugin.dependencies) {
      for (const depId of plugin.dependencies) {
        if (!this.plugins.has(depId)) {
          console.error(`[PluginManager] Plugin ${plugin.id} depends on ${depId}, which is not installed`)
          return false
        }
      }
    }
    
    try {
      // 安装插件
      await plugin.install(this.context)
      
      // 注册扩展
      plugin.objectTypes?.forEach(ext => this.registerObjectType(ext))
      plugin.panels?.forEach(ext => this.registerPanel(ext))
      plugin.menuItems?.forEach(ext => this.registerMenuItem(ext))
      plugin.shortcuts?.forEach(ext => this.registerShortcut(ext))
      plugin.toolbarItems?.forEach(ext => this.registerToolbarItem(ext))
      
      // 保存插件
      this.plugins.set(plugin.id, plugin)
      this._version.value++
      
      console.log(`[PluginManager] Plugin ${plugin.name} v${plugin.version} installed`)
      
      // 触发引擎就绪钩子（如果引擎已经就绪）
      if (plugin.hooks?.onEngineReady) {
        plugin.hooks.onEngineReady(this.context)
      }
      
      return true
    } catch (error) {
      console.error(`[PluginManager] Failed to install plugin ${plugin.id}:`, error)
      return false
    }
  }
  
  /**
   * 卸载插件
   */
  unregister(pluginId: string): boolean {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) {
      console.warn(`[PluginManager] Plugin ${pluginId} is not registered`)
      return false
    }
    
    // 检查是否有其他插件依赖此插件
    for (const [id, p] of this.plugins) {
      if (p.dependencies?.includes(pluginId)) {
        console.error(`[PluginManager] Cannot unregister ${pluginId}: plugin ${id} depends on it`)
        return false
      }
    }
    
    try {
      // 调用卸载函数
      plugin.uninstall?.()
      
      // 移除扩展
      plugin.objectTypes?.forEach(ext => this.unregisterObjectType(ext.type))
      plugin.panels?.forEach(ext => this.unregisterPanel(ext.id))
      plugin.menuItems?.forEach(ext => this.unregisterMenuItem(ext.id))
      plugin.shortcuts?.forEach(ext => this.unregisterShortcut(ext.id))
      plugin.toolbarItems?.forEach(ext => this.unregisterToolbarItem(ext.id))
      
      // 移除插件
      this.plugins.delete(pluginId)
      this._version.value++
      
      console.log(`[PluginManager] Plugin ${plugin.name} uninstalled`)
      
      return true
    } catch (error) {
      console.error(`[PluginManager] Failed to uninstall plugin ${pluginId}:`, error)
      return false
    }
  }
  
  /**
   * 获取已注册的插件列表
   */
  getPlugins(): PluginMetadata[] {
    return Array.from(this.plugins.values()).map(getPluginMetadata)
  }
  
  /**
   * 检查插件是否已注册
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId)
  }

  /**
   * 获取插件对象（用于获取完整信息，包括扩展）
   */
  getPlugin(pluginId: string): EnginePlugin | undefined {
    return this.plugins.get(pluginId)
  }

  // ==================== 对象类型扩展 ====================
  
  registerObjectType(extension: ObjectTypeExtension) {
    if (this.objectTypes.has(extension.type)) {
      console.warn(`[PluginManager] Object type ${extension.type} is already registered`)
      return
    }
    this.objectTypes.set(extension.type, extension)
    this._version.value++
  }
  
  unregisterObjectType(type: string) {
    this.objectTypes.delete(type)
    this._version.value++
  }
  
  getObjectType(type: string): ObjectTypeExtension | undefined {
    return this.objectTypes.get(type)
  }
  
  getAllObjectTypes(): ObjectTypeExtension[] {
    return Array.from(this.objectTypes.values())
  }
  
  getObjectTypesByCategory(category: ObjectTypeExtension['category']): ObjectTypeExtension[] {
    return this.getAllObjectTypes().filter(ext => ext.category === category)
  }

  // ==================== 面板扩展 ====================
  
  registerPanel(extension: PanelExtension) {
    if (this.panels.has(extension.id)) {
      console.warn(`[PluginManager] Panel ${extension.id} is already registered`)
      return
    }
    this.panels.set(extension.id, extension)
    this._version.value++
  }
  
  unregisterPanel(id: string) {
    this.panels.delete(id)
    this._version.value++
  }
  
  getPanel(id: string): PanelExtension | undefined {
    return this.panels.get(id)
  }
  
  getAllPanels(): PanelExtension[] {
    return Array.from(this.panels.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  
  getPanelsByPosition(position: PanelExtension['position']): PanelExtension[] {
    return this.getAllPanels().filter(ext => ext.position === position)
  }

  // ==================== 菜单项扩展 ====================
  
  registerMenuItem(extension: MenuItemExtension) {
    if (this.menuItems.has(extension.id)) {
      console.warn(`[PluginManager] Menu item ${extension.id} is already registered`)
      return
    }
    this.menuItems.set(extension.id, extension)
    this._version.value++
  }
  
  unregisterMenuItem(id: string) {
    this.menuItems.delete(id)
    this._version.value++
  }
  
  getMenuItem(id: string): MenuItemExtension | undefined {
    return this.menuItems.get(id)
  }
  
  getAllMenuItems(): MenuItemExtension[] {
    return Array.from(this.menuItems.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  
  getMenuItemsByPath(path: string[]): MenuItemExtension[] {
    return this.getAllMenuItems().filter(ext => 
      ext.path.length === path.length && 
      ext.path.every((p, i) => p === path[i])
    )
  }

  // ==================== 快捷键扩展 ====================
  
  registerShortcut(extension: ShortcutExtension) {
    if (this.shortcuts.has(extension.id)) {
      console.warn(`[PluginManager] Shortcut ${extension.id} is already registered`)
      return
    }
    this.shortcuts.set(extension.id, extension)
    this._version.value++
  }
  
  unregisterShortcut(id: string) {
    this.shortcuts.delete(id)
    this._version.value++
  }
  
  getShortcut(id: string): ShortcutExtension | undefined {
    return this.shortcuts.get(id)
  }
  
  getAllShortcuts(): ShortcutExtension[] {
    return Array.from(this.shortcuts.values())
  }
  
  /**
   * 根据按键组合查找快捷键
   */
  findShortcutByKeys(keys: string): ShortcutExtension | undefined {
    const normalizedKeys = this.normalizeKeys(keys)
    return Array.from(this.shortcuts.values()).find(
      ext => this.normalizeKeys(ext.keys) === normalizedKeys
    )
  }
  
  /**
   * 标准化按键组合
   */
  private normalizeKeys(keys: string): string {
    return keys.toLowerCase()
      .split('+')
      .map(k => k.trim())
      .sort()
      .join('+')
  }

  // ==================== 工具栏项扩展 ====================
  
  registerToolbarItem(extension: ToolbarItemExtension) {
    if (this.toolbarItems.has(extension.id)) {
      console.warn(`[PluginManager] Toolbar item ${extension.id} is already registered`)
      return
    }
    this.toolbarItems.set(extension.id, extension)
    this._version.value++
  }
  
  unregisterToolbarItem(id: string) {
    this.toolbarItems.delete(id)
    this._version.value++
  }
  
  getToolbarItem(id: string): ToolbarItemExtension | undefined {
    return this.toolbarItems.get(id)
  }
  
  getAllToolbarItems(): ToolbarItemExtension[] {
    return Array.from(this.toolbarItems.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }
  
  getToolbarItemsByGroup(group: string): ToolbarItemExtension[] {
    return this.getAllToolbarItems().filter(ext => ext.group === group)
  }

  // ==================== 事件系统 ====================
  
  /**
   * 添加事件监听器
   */
  on(event: string, handler: EventHandler) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set())
    }
    this.eventListeners.get(event)!.add(handler)
  }
  
  /**
   * 移除事件监听器
   */
  off(event: string, handler: EventHandler) {
    this.eventListeners.get(event)?.delete(handler)
  }
  
  /**
   * 触发事件
   */
  emit(event: string, ...args: any[]) {
    const handlers = this.eventListeners.get(event)
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args)
        } catch (error) {
          console.error(`[PluginManager] Event handler error for ${event}:`, error)
        }
      }
    }
  }

  // ==================== 生命周期钩子调用 ====================

  /**
   * 调用所有插件的指定钩子
   */
  callHook<K extends keyof PluginHooks>(
    hookName: K,
    ...args: Parameters<NonNullable<PluginHooks[K]>>
  ): void {
    if (!this.context) return
    
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.[hookName]
      if (hook) {
        try {
          ;(hook as Function)(...args)
        } catch (error) {
          console.error(`[PluginManager] Hook ${hookName} error in plugin ${plugin.id}:`, error)
        }
      }
    }
  }
  
  /**
   * 调用 onSceneLoad 钩子
   */
  callOnSceneLoad(scene: SceneObjectData[]) {
    if (!this.context) return
    this.callHook('onSceneLoad', scene, this.context)
  }
  
  /**
   * 调用 onSceneSave 钩子（支持链式修改）
   */
  callOnSceneSave(scene: SceneObjectData[]): SceneObjectData[] {
    if (!this.context) return scene
    
    let result = scene
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.onSceneSave
      if (hook) {
        try {
          result = hook(result, this.context)
        } catch (error) {
          console.error(`[PluginManager] onSceneSave error in plugin ${plugin.id}:`, error)
        }
      }
    }
    return result
  }
  
  /**
   * 调用 onObjectCreate 钩子（支持拦截）
   */
  callOnObjectCreate(data: SceneObjectData): SceneObjectData | null {
    if (!this.context) return data
    
    let result: SceneObjectData | null = data
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.onObjectCreate
      if (hook && result) {
        try {
          result = hook(result, this.context)
        } catch (error) {
          console.error(`[PluginManager] onObjectCreate error in plugin ${plugin.id}:`, error)
        }
      }
    }
    return result
  }
  
  /**
   * 调用 onObjectDelete 钩子（支持阻止）
   */
  callOnObjectDelete(id: string): boolean {
    if (!this.context) return true
    
    for (const plugin of this.plugins.values()) {
      const hook = plugin.hooks?.onObjectDelete
      if (hook) {
        try {
          if (!hook(id, this.context)) {
            return false // 阻止删除
          }
        } catch (error) {
          console.error(`[PluginManager] onObjectDelete error in plugin ${plugin.id}:`, error)
        }
      }
    }
    return true
  }

  // ==================== 响应式 ====================
  
  /**
   * 获取版本号（用于响应式更新）
   */
  get version() {
    return this._version.value
  }
}

// 导出单例实例
export const pluginManager = new PluginManager()

// 导出 Vue Composable
export function usePluginManager() {
  return {
    manager: pluginManager,
    version: computed(() => pluginManager.version),
    plugins: computed(() => {
      void pluginManager.version
      return pluginManager.getPlugins()
    }),
    objectTypes: computed(() => {
      void pluginManager.version
      return pluginManager.getAllObjectTypes()
    }),
    panels: computed(() => {
      void pluginManager.version
      return pluginManager.getAllPanels()
    }),
    menuItems: computed(() => {
      void pluginManager.version
      return pluginManager.getAllMenuItems()
    }),
    shortcuts: computed(() => {
      void pluginManager.version
      return pluginManager.getAllShortcuts()
    }),
    toolbarItems: computed(() => {
      void pluginManager.version
      return pluginManager.getAllToolbarItems()
    })
  }
}
