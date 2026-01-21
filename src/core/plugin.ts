/**
 * 插件系统核心类型定义
 * 
 * 设计原则：
 * 1. 可扩展 - 支持自定义对象类型、面板、菜单等
 * 2. 松耦合 - 插件与引擎核心通过接口通信
 * 3. 生命周期 - 提供完整的钩子函数
 */

import type { Component } from 'vue'
import type { Object3D, Camera, Scene, WebGLRenderer } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import type { SceneObjectData } from '@/interfaces/sceneInterface'
import type { useSceneStore } from '@/stores/modules/useScene.store'
import type { useAnimationStore } from '@/stores/modules/useAnimation.store'

// ==================== 插件接口 ====================

/**
 * 引擎插件接口
 */
export interface EnginePlugin {
  /** 插件唯一标识 */
  id: string
  
  /** 插件名称 */
  name: string
  
  /** 插件版本 */
  version: string
  
  /** 插件描述 */
  description?: string
  
  /** 插件作者 */
  author?: string
  
  /** 依赖的其他插件ID */
  dependencies?: string[]
  
  /** 注册新的对象类型 */
  objectTypes?: ObjectTypeExtension[]
  
  /** 注册新的面板 */
  panels?: PanelExtension[]
  
  /** 注册菜单项 */
  menuItems?: MenuItemExtension[]
  
  /** 注册快捷键 */
  shortcuts?: ShortcutExtension[]
  
  /** 注册工具栏按钮 */
  toolbarItems?: ToolbarItemExtension[]
  
  /** 生命周期钩子 */
  hooks?: PluginHooks
  
  /** 
   * 安装函数
   * 在插件被注册时调用
   */
  install(context: EngineContext): void | Promise<void>
  
  /** 
   * 卸载函数
   * 在插件被移除时调用
   */
  uninstall?(): void
}

// ==================== 扩展类型 ====================

/**
 * 对象类型扩展
 */
export interface ObjectTypeExtension {
  /** 类型标识（如 'spline', 'terrain'） */
  type: string
  
  /** 显示名称 */
  label: string
  
  /** 图标组件 */
  icon?: Component
  
  /** 分类 */
  category: 'primitive' | 'light' | 'camera' | 'effect' | 'helper' | 'custom'
  
  /** 默认数据生成函数 */
  defaultData: () => Partial<SceneObjectData>
  
  /** 创建 Three.js 对象 */
  createThreeObject: (data: SceneObjectData, context: EngineContext) => Object3D
  
  /** 同步数据到 Three.js 对象 */
  syncThreeObject?: (obj: Object3D, data: SceneObjectData, context: EngineContext) => void
  
  /** 属性编辑面板组件 */
  propertiesPanel?: Component
  
  /** 是否可选中 */
  selectable?: boolean
  
  /** 支持的操作 */
  supportedOperations?: Array<'translate' | 'rotate' | 'scale' | 'delete' | 'duplicate'>
}

/**
 * 面板扩展
 */
export interface PanelExtension {
  /** 面板ID */
  id: string
  
  /** 面板名称 */
  name: string
  
  /** 面板图标 */
  icon?: Component
  
  /** 面板位置 */
  position: 'left' | 'right' | 'bottom' | 'floating'
  
  /** 面板组件 */
  component: Component
  
  /** 默认是否显示 */
  defaultVisible?: boolean
  
  /** 面板默认宽度/高度 */
  defaultSize?: number
  
  /** 最小尺寸 */
  minSize?: number
  
  /** 最大尺寸 */
  maxSize?: number
  
  /** 是否可关闭 */
  closable?: boolean
  
  /** 排序权重（越小越靠前） */
  order?: number
}

/**
 * 菜单项扩展
 */
export interface MenuItemExtension {
  /** 菜单项ID */
  id: string
  
  /** 显示文本 */
  label: string
  
  /** 菜单路径（如 ['文件', '导出']） */
  path: string[]
  
  /** 图标 */
  icon?: Component
  
  /** 快捷键显示文本 */
  shortcut?: string
  
  /** 点击动作 */
  action: (context: EngineContext) => void
  
  /** 是否禁用 */
  disabled?: boolean | ((context: EngineContext) => boolean)
  
  /** 是否显示 */
  visible?: boolean | ((context: EngineContext) => boolean)
  
  /** 分隔符（在此项前添加分隔线） */
  divider?: boolean
  
  /** 排序权重 */
  order?: number
}

/**
 * 快捷键扩展
 */
export interface ShortcutExtension {
  /** 快捷键ID */
  id: string
  
  /** 按键组合（如 'ctrl+s', 'shift+d'） */
  keys: string
  
  /** 描述 */
  description: string
  
  /** 动作 */
  action: (context: EngineContext) => void
  
  /** 是否全局（在输入框中也生效） */
  global?: boolean
  
  /** 所属分类 */
  category?: string
}

/**
 * 工具栏项扩展
 */
export interface ToolbarItemExtension {
  /** 工具栏项ID */
  id: string
  
  /** 显示文本 */
  label: string
  
  /** 图标 */
  icon: Component
  
  /** 提示文本 */
  tooltip?: string
  
  /** 点击动作 */
  action: (context: EngineContext) => void
  
  /** 是否激活状态 */
  active?: boolean | ((context: EngineContext) => boolean)
  
  /** 是否禁用 */
  disabled?: boolean | ((context: EngineContext) => boolean)
  
  /** 分组名称 */
  group?: string
  
  /** 排序权重 */
  order?: number
}

// ==================== 生命周期钩子 ====================

/**
 * 插件生命周期钩子
 */
export interface PluginHooks {
  /** 引擎准备就绪 */
  onEngineReady?: (context: EngineContext) => void
  
  /** 场景加载完成 */
  onSceneLoad?: (scene: SceneObjectData[], context: EngineContext) => void
  
  /** 场景保存前 */
  onSceneSave?: (scene: SceneObjectData[], context: EngineContext) => SceneObjectData[]
  
  /** 对象创建前 */
  onObjectCreate?: (data: SceneObjectData, context: EngineContext) => SceneObjectData | null
  
  /** 对象创建后 */
  onObjectCreated?: (data: SceneObjectData, threeObject: Object3D, context: EngineContext) => void
  
  /** 对象选中 */
  onObjectSelect?: (id: string | null, context: EngineContext) => void
  
  /** 对象删除前（返回 false 可阻止删除） */
  onObjectDelete?: (id: string, context: EngineContext) => boolean
  
  /** 对象更新后 */
  onObjectUpdate?: (id: string, patch: Partial<SceneObjectData>, context: EngineContext) => void
  
  /** 每帧渲染前 */
  onBeforeRender?: (delta: number, context: EngineContext) => void
  
  /** 每帧渲染后 */
  onAfterRender?: (delta: number, context: EngineContext) => void
  
  /** 窗口大小改变 */
  onResize?: (width: number, height: number, context: EngineContext) => void
  
  /** 撤销操作 */
  onUndo?: (context: EngineContext) => void
  
  /** 重做操作 */
  onRedo?: (context: EngineContext) => void
}

// ==================== 引擎上下文 ====================

/**
 * 引擎上下文
 * 提供给插件访问引擎核心功能的接口
 */
export interface EngineContext {
  /** Pinia Stores */
  stores: {
    scene: ReturnType<typeof useSceneStore>
    animation: ReturnType<typeof useAnimationStore>
  }
  
  /** Three.js 相关 */
  three: {
    scene: Scene | null
    camera: Camera | null
    renderer: WebGLRenderer | WebGPURenderer | null
  }
  
  /** 注册函数 */
  registerObjectType: (extension: ObjectTypeExtension) => void
  registerPanel: (extension: PanelExtension) => void
  registerMenuItem: (extension: MenuItemExtension) => void
  registerShortcut: (extension: ShortcutExtension) => void
  registerToolbarItem: (extension: ToolbarItemExtension) => void
  
  /** 取消注册函数 */
  unregisterObjectType: (type: string) => void
  unregisterPanel: (id: string) => void
  unregisterMenuItem: (id: string) => void
  unregisterShortcut: (id: string) => void
  unregisterToolbarItem: (id: string) => void
  
  /** 事件系统 */
  on: (event: string, handler: (...args: any[]) => void) => void
  off: (event: string, handler: (...args: any[]) => void) => void
  emit: (event: string, ...args: any[]) => void
  
  /** 工具函数 */
  utils: {
    /** 生成唯一ID */
    generateId: (prefix?: string) => string
    /** 显示通知 */
    notify: (options: { type: 'success' | 'warning' | 'error' | 'info'; title: string; content?: string }) => void
    /** 显示确认对话框 */
    confirm: (options: { title: string; content: string }) => Promise<boolean>
  }
}

// ==================== 辅助函数 ====================

/**
 * 定义插件（类型辅助函数）
 */
export function definePlugin(plugin: EnginePlugin): EnginePlugin {
  return plugin
}

/**
 * 插件元数据
 */
export interface PluginMetadata {
  id: string
  name: string
  version: string
  description?: string
  author?: string
  homepage?: string
  repository?: string
  license?: string
  keywords?: string[]
}

/**
 * 从插件对象提取元数据
 */
export function getPluginMetadata(plugin: EnginePlugin): PluginMetadata {
  return {
    id: plugin.id,
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: plugin.author
  }
}
