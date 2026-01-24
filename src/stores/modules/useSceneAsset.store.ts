/**
 * 场景资产 Store
 * 
 * 职责：
 * - 资产列表管理（纹理、模型、HDR等）
 * - 本地文件缓存
 * - 资产上传和解析
 * - 模型加载状态跟踪
 */

import { defineStore } from 'pinia'
import { ref, shallowRef } from 'vue'
import type { AssetRef } from '@/types/asset'
import { assetApi } from '@/services/assetApi'

export const useSceneAssetStore = defineStore('sceneAsset', () => {

  // ==================== 资产数据 ====================
  
  /** 资产引用列表 */
  const assets = ref<AssetRef[]>([])
  
  /** 本地文件缓存 (id -> File) */
  const assetFiles = shallowRef(new Map<string, File>())
  
  /** 正在加载的资产ID集合 */
  const loadingAssets = ref(new Set<string>())
  
  /** 已加载完成的资产ID集合 */
  const loadedAssets = ref(new Set<string>())
  
  /** 资产加载Promise映射（用于等待同一资产的加载） */
  const assetLoadPromises = shallowRef(new Map<string, Promise<void>>())
  
  /** 已加载的资产场景缓存（用于克隆模型） */
  const loadedAssetScenes = shallowRef(new Map<string, any>())

  // ==================== 查询方法 ====================
  
  /**
   * 根据ID获取资产
   */
  function getAssetById(id: string): AssetRef | null {
    return assets.value.find(asset => asset.id === id) ?? null
  }
  
  /**
   * 检查资产是否正在加载
   */
  function isAssetLoading(id: string): boolean {
    return loadingAssets.value.has(id)
  }
  
  /**
   * 检查资产是否已加载
   */
  function isAssetLoaded(id: string): boolean {
    return loadedAssets.value.has(id)
  }

  // ==================== 本地资产操作 ====================
  
  /**
   * 注册本地资产（从文件）
   */
  function registerLocalAsset(file: File, type: AssetRef['type']): AssetRef {
    const id = `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const ext = file.name.split('.').pop()?.toLowerCase()
    const asset: AssetRef = {
      id,
      type,
      uri: `local://${id}`,
      name: file.name,
      source: 'local',
      meta: {
        ext,
        size: file.size,
        mime: file.type
      },
      createdAt: Date.now()
    }
    assets.value.push(asset)
    assetFiles.value.set(id, file)
    return asset
  }
  
  /**
   * 注册云端资产（从 assetApi 上传后返回的资产）
   */
  function registerRemoteAsset(asset: AssetRef): AssetRef {
    // 检查是否已存在
    const existing = assets.value.find(a => a.id === asset.id)
    if (existing) {
      return existing
    }
    assets.value.push(asset)
    return asset
  }

  // ==================== 云端资产操作 ====================
  
  /**
   * 上传资产到云端存储（全局共享）
   * @param file 文件对象
   * @param type 资产类型
   * @returns 上传后的资产引用
   */
  async function uploadAsset(file: File, type: AssetRef['type']): Promise<AssetRef> {
    if (!assetApi.isStorageAvailable()) {
      throw new Error('Supabase Storage 未配置，无法上传资产')
    }

    const result = await assetApi.uploadAsset({ file, type })
    const asset = registerRemoteAsset(result.asset)
    return asset
  }

  // ==================== URI 解析 ====================
  
  /**
   * 解析资产URI（处理本地文件和远程URL）
   */
  async function resolveAssetUri(asset: AssetRef): Promise<{ url: string; revoke?: () => void } | null> {
    if (asset.uri.startsWith('local://')) {
      const file = assetFiles.value.get(asset.id)
      if (!file) return null
      const url = URL.createObjectURL(file)
      return { url, revoke: () => URL.revokeObjectURL(url) }
    }
    return { url: asset.uri }
  }

  // ==================== 加载状态管理 ====================
  
  /**
   * 标记资产开始加载
   */
  function markAssetLoading(assetId: string) {
    loadingAssets.value.add(assetId)
  }
  
  /**
   * 标记资产加载完成
   */
  function markAssetLoaded(assetId: string) {
    loadingAssets.value.delete(assetId)
    loadedAssets.value.add(assetId)
  }
  
  /**
   * 标记资产加载失败
   */
  function markAssetFailed(assetId: string) {
    loadingAssets.value.delete(assetId)
  }
  
  /**
   * 获取资产加载Promise
   */
  function getAssetLoadPromise(assetId: string): Promise<void> | undefined {
    return assetLoadPromises.value.get(assetId)
  }
  
  /**
   * 设置资产加载Promise
   */
  function setAssetLoadPromise(assetId: string, promise: Promise<void>) {
    assetLoadPromises.value.set(assetId, promise)
  }
  
  /**
   * 获取缓存的资产场景（用于克隆模型）
   */
  function getCachedAssetScene(assetId: string): any | undefined {
    return loadedAssetScenes.value.get(assetId)
  }
  
  /**
   * 缓存资产场景
   */
  function cacheAssetScene(assetId: string, scene: any) {
    loadedAssetScenes.value.set(assetId, scene)
  }

  // ==================== 加载状态管理 ====================
  
  /**
   * 清空加载状态缓存（不清空资产列表）
   * 用于场景切换时重新加载模型
   */
  function clearLoadingState() {
    loadingAssets.value.clear()
    loadedAssets.value.clear()
    assetLoadPromises.value = new Map()
    loadedAssetScenes.value = new Map()
  }

  // ==================== 资产管理 ====================
  
  /**
   * 删除资产
   */
  function removeAsset(id: string): boolean {
    const index = assets.value.findIndex(a => a.id === id)
    if (index === -1) return false
    
    const asset = assets.value[index]
    if (!asset) return false
    
    // 撤销 Blob URL
    if (asset.uri.startsWith('blob:')) {
      URL.revokeObjectURL(asset.uri)
    }
    
    // 移除文件缓存
    if (assetFiles.value.has(id)) {
      const newFiles = new Map(assetFiles.value)
      newFiles.delete(id)
      assetFiles.value = newFiles
    }
    
    // 移除加载状态
    loadingAssets.value.delete(id)
    loadedAssets.value.delete(id)
    assetLoadPromises.value.delete(id)
    loadedAssetScenes.value.delete(id)
    
    assets.value.splice(index, 1)
    
    return true
  }
  
  /**
   * 清空所有资产
   */
  function clearAssets() {
    // 撤销所有 Blob URL
    for (const asset of assets.value) {
      if (asset.uri.startsWith('blob:')) {
        URL.revokeObjectURL(asset.uri)
      }
    }
    
    assets.value = []
    assetFiles.value = new Map()
    loadingAssets.value.clear()
    loadedAssets.value.clear()
    assetLoadPromises.value = new Map()
    loadedAssetScenes.value = new Map()
  }
  
  /**
   * 设置资产列表（用于加载场景）
   */
  function setAssets(newAssets: AssetRef[]) {
    clearAssets()
    assets.value = newAssets
  }

  // ==================== 返回 ====================
  
  return {
    // 数据
    assets,
    assetFiles,
    loadingAssets,
    loadedAssets,
    assetLoadPromises,
    loadedAssetScenes,
    
    // 查询方法
    getAssetById,
    isAssetLoading,
    isAssetLoaded,
    
    // 本地资产操作
    registerLocalAsset,
    registerRemoteAsset,
    resolveAssetUri,
    
    // 云端资产操作
    uploadAsset,
    
    // 加载状态管理
    markAssetLoading,
    markAssetLoaded,
    markAssetFailed,
    getAssetLoadPromise,
    setAssetLoadPromise,
    getCachedAssetScene,
    cacheAssetScene,
    clearLoadingState,
    
    // 资产管理
    removeAsset,
    clearAssets,
    setAssets
  }
})
