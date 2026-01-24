import { computed, type WritableComputedRef } from 'vue'
import { useSceneStore } from '@/stores/modules/useScene.store'
import type { SceneObjectData } from '@/interfaces/sceneInterface'

/**
 * 路径解析结果
 */
interface PathSegment {
  key: string
  index?: number
}

/**
 * 解析属性路径
 * 支持格式：
 * - "visible" -> 直接属性
 * - "transform.position" -> 嵌套属性
 * - "transform.position[0]" -> 嵌套 + 数组索引
 * - "userData.intensity" -> userData 内属性
 * - "mesh.material.color" -> 深层嵌套
 */
function parsePath(path: string): PathSegment[] {
  const segments: PathSegment[] = []
  const parts = path.split('.')
  
  for (const part of parts) {
    // 检查是否包含数组索引，如 "position[0]"
    const match = part.match(/^(\w+)(?:\[(\d+)\])?$/)
    if (match) {
      const [, key, indexStr] = match
      segments.push({
        key,
        index: indexStr !== undefined ? parseInt(indexStr, 10) : undefined
      })
    }
  }
  
  return segments
}

/**
 * 根据路径从对象获取值
 */
function getValueByPath<T>(obj: Record<string, any> | null | undefined, segments: PathSegment[], defaultValue: T): T {
  if (!obj) return defaultValue
  
  let current: any = obj
  
  for (const segment of segments) {
    if (current === null || current === undefined) return defaultValue
    
    current = current[segment.key]
    
    if (segment.index !== undefined) {
      if (!Array.isArray(current)) return defaultValue
      current = current[segment.index]
    }
  }
  
  return current ?? defaultValue
}

/**
 * 根据路径构建 patch 对象
 * 
 * 例如：
 * - path="visible", value=true -> { visible: true }
 * - path="transform.position[0]", value=1 -> { transform: { position: [1, currentY, currentZ] } }
 * - path="userData.intensity", value=2 -> { userData: { ...currentUserData, intensity: 2 } }
 */
function buildPatch(
  currentData: SceneObjectData | null,
  segments: PathSegment[],
  value: unknown
): Partial<SceneObjectData> {
  if (segments.length === 0 || !currentData) return {}
  
  const rootKey = segments[0].key as keyof SceneObjectData
  
  // 单层路径，直接返回
  if (segments.length === 1 && segments[0].index === undefined) {
    return { [rootKey]: value } as Partial<SceneObjectData>
  }
  
  // 第一层有数组索引的情况（比较少见，但支持）
  if (segments.length === 1 && segments[0].index !== undefined) {
    const currentArray = [...((currentData as any)[rootKey] ?? [])]
    currentArray[segments[0].index!] = value
    return { [rootKey]: currentArray } as Partial<SceneObjectData>
  }
  
  // 多层嵌套
  const currentRoot = (currentData as any)[rootKey]
  const newRoot = buildNestedValue(currentRoot, segments.slice(1), value)
  
  return { [rootKey]: newRoot } as Partial<SceneObjectData>
}

/**
 * 递归构建嵌套值
 */
function buildNestedValue(
  current: any,
  segments: PathSegment[],
  value: unknown
): any {
  if (segments.length === 0) return value
  
  const segment = segments[0]
  const remaining = segments.slice(1)
  
  // 最后一个 segment
  if (remaining.length === 0) {
    if (segment.index !== undefined) {
      // 数组索引
      const arr = Array.isArray(current?.[segment.key]) 
        ? [...current[segment.key]] 
        : []
      arr[segment.index] = value
      return { ...current, [segment.key]: arr }
    } else {
      // 普通属性
      return { ...current, [segment.key]: value }
    }
  }
  
  // 中间的 segment
  if (segment.index !== undefined) {
    // 数组中的对象
    const arr = Array.isArray(current?.[segment.key]) 
      ? [...current[segment.key]] 
      : []
    arr[segment.index] = buildNestedValue(arr[segment.index], remaining, value)
    return { ...current, [segment.key]: arr }
  } else {
    // 嵌套对象
    const nested = current?.[segment.key] ?? {}
    return { ...current, [segment.key]: buildNestedValue(nested, remaining, value) }
  }
}

/**
 * 属性绑定 Composable
 * 
 * 提供通过路径字符串访问和更新场景对象属性的能力。
 * 
 * @example
 * ```ts
 * const { bind, getValue, updateValue } = usePropertyBinding()
 * 
 * // 创建双向绑定
 * const visible = bind('visible', true)
 * const positionX = bind('transform.position[0]', 0)
 * 
 * // 手动获取/更新
 * const intensity = getValue('userData.intensity', 1)
 * updateValue('userData.intensity', 2)
 * ```
 */
export function usePropertyBinding() {
  const sceneStore = useSceneStore()
  
  /**
   * 通过路径获取当前选中对象的属性值
   */
  function getValue<T>(path: string, defaultValue: T): T {
    const segments = parsePath(path)
    return getValueByPath(sceneStore.selectedObjectData, segments, defaultValue)
  }
  
  /**
   * 通过路径更新当前选中对象的属性值
   */
  function updateValue(path: string, value: unknown): void {
    const id = sceneStore.selectedObjectId
    if (!id) return
    
    const segments = parsePath(path)
    const patch = buildPatch(sceneStore.selectedObjectData, segments, value)
    
    if (Object.keys(patch).length > 0) {
      sceneStore.updateSceneObjectData(id, patch as any)
    }
  }
  
  /**
   * 创建双向绑定的 computed ref
   * 可直接用于 v-model
   */
  function bind<T>(path: string, defaultValue: T): WritableComputedRef<T> {
    const segments = parsePath(path)
    
    return computed({
      get: () => getValueByPath(sceneStore.selectedObjectData, segments, defaultValue),
      set: (value: T) => {
        const id = sceneStore.selectedObjectId
        if (!id) return
        
        const patch = buildPatch(sceneStore.selectedObjectData, segments, value)
        if (Object.keys(patch).length > 0) {
          sceneStore.updateSceneObjectData(id, patch as any)
        }
      }
    })
  }
  
  /**
   * 批量更新多个属性
   */
  function updateBatch(patches: Record<string, unknown>): void {
    const id = sceneStore.selectedObjectId
    if (!id) return
    
    let mergedPatch: Partial<SceneObjectData> = {}
    
    for (const [path, value] of Object.entries(patches)) {
      const segments = parsePath(path)
      const patch = buildPatch(sceneStore.selectedObjectData, segments, value)
      mergedPatch = deepMerge(mergedPatch, patch)
    }
    
    if (Object.keys(mergedPatch).length > 0) {
      sceneStore.updateSceneObjectData(id, mergedPatch as any)
    }
  }
  
  /**
   * 获取当前选中对象 ID
   */
  function getSelectedId(): string | null {
    return sceneStore.selectedObjectId
  }
  
  /**
   * 获取当前选中对象数据
   */
  function getSelectedData(): SceneObjectData | null {
    return sceneStore.selectedObjectData
  }
  
  return {
    getValue,
    updateValue,
    bind,
    updateBatch,
    getSelectedId,
    getSelectedData
  }
}

/**
 * 深度合并对象
 */
function deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
  const result = { ...target }
  
  for (const key of Object.keys(source) as (keyof T)[]) {
    const sourceValue = source[key]
    const targetValue = result[key]
    
    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue)
    } else {
      result[key] = sourceValue as T[keyof T]
    }
  }
  
  return result
}

export type { PathSegment }
