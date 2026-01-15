import { supabase } from './supabase'
import type { AssetRef } from '@/types/asset'

/**
 * Supabase Storage 存储桶名称
 */
const STORAGE_BUCKET = 'assets'

/**
 * 资产上传参数
 */
export interface UploadAssetParams {
  file: File
  type: AssetRef['type']
  sceneId?: number // 可选：关联的场景ID，用于组织文件路径
}

/**
 * 资产上传结果
 */
export interface UploadAssetResult {
  asset: AssetRef
  publicUrl: string
}

/**
 * 资产 API 服务类
 * 提供资产的上传、下载、删除等操作
 */
export class AssetApi {
  private static instance: AssetApi

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): AssetApi {
    if (!AssetApi.instance) {
      AssetApi.instance = new AssetApi()
    }
    return AssetApi.instance
  }

  /**
   * 检查 Supabase Storage 是否可用
   */
  isStorageAvailable(): boolean {
    return !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  }

  /**
   * 获取存储桶路径
   * @param assetId 资产ID
   * @param fileName 文件名
   */
  private getStoragePath(assetId: string, fileName: string, sceneId?: number): string {
    if (sceneId) {
      return `scenes/${sceneId}/${assetId}/${fileName}`
    }
    return `public/${assetId}/${fileName}`
  }

  /**
   * 上传资产到 Supabase Storage
   * @param params 上传参数
   * @returns 上传结果，包含资产信息和公开URL
   */
  async uploadAsset(params: UploadAssetParams): Promise<UploadAssetResult> {
    if (!this.isStorageAvailable()) {
      throw new Error('Supabase Storage 未配置，请检查环境变量')
    }

    const { file, type, sceneId } = params

    // 生成资产ID
    const assetId = `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const fileName = `${assetId}.${ext}`
    
    // 构建存储路径
    const filePath = this.getStoragePath(assetId, fileName, sceneId)

    try {
      // 上传文件到 Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        throw new Error(`上传失败: ${uploadError.message}`)
      }

      // 获取公开URL
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath)

      const publicUrl = urlData.publicUrl

      // 创建资产引用对象
      const asset: AssetRef = {
        id: assetId,
        type,
        uri: publicUrl,
        name: file.name,
        source: 'remote',
        meta: {
          ext,
          size: file.size,
          mime: file.type
        },
        createdAt: Date.now()
      }

      return {
        asset,
        publicUrl
      }
    } catch (error: any) {
      console.error('资产上传失败:', error)
      throw new Error(error.message || '资产上传失败')
    }
  }

  /**
   * 批量上传资产
   * @param files 文件列表
   * @param type 资产类型
   * @param sceneId 场景ID（可选）
   * @returns 上传结果列表
   */
  async uploadAssets(
    files: File[],
    type: AssetRef['type'],
    sceneId?: number
  ): Promise<UploadAssetResult[]> {
    const results: UploadAssetResult[] = []
    
    for (const file of files) {
      try {
        const result = await this.uploadAsset({ file, type, sceneId })
        results.push(result)
      } catch (error) {
        console.error(`上传文件 ${file.name} 失败:`, error)
        // 继续上传其他文件，不中断流程
      }
    }

    return results
  }

  /**
   * 删除资产
   * @param asset 资产引用对象
   * @returns 是否删除成功
   */
  async deleteAsset(asset: AssetRef): Promise<boolean> {
    if (!this.isStorageAvailable()) {
      throw new Error('Supabase Storage 未配置')
    }

    // 只处理云端资产
    if (asset.source !== 'remote' || !asset.uri) {
      return false
    }

    try {
      // 从URL中提取文件路径
      // URL格式: https://xxx.supabase.co/storage/v1/object/public/assets/scenes/1/asset-xxx/asset-xxx.glb
      const url = new URL(asset.uri)
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/)
      
      if (!pathMatch) {
        console.warn('无法从URL中提取文件路径:', asset.uri)
        return false
      }

      const filePath = pathMatch[1]
      if (!filePath) {
        console.warn('无法从URL中提取文件路径:', asset.uri)
        return false
      }

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath])

      if (error) {
        console.error('删除资产失败:', error)
        return false
      }

      return true
    } catch (error) {
      console.error('删除资产失败:', error)
      return false
    }
  }

  /**
   * 获取资产的下载URL（带过期时间，适用于私有文件）
   * @param asset 资产引用对象
   * @param expiresIn 过期时间（秒），默认3600秒（1小时）
   * @returns 临时URL
   */
  async getSignedUrl(asset: AssetRef, expiresIn: number = 3600): Promise<string | null> {
    if (!this.isStorageAvailable()) {
      return null
    }

    if (asset.source !== 'remote' || !asset.uri) {
      return null
    }

    try {
      // 从URL中提取文件路径
      const url = new URL(asset.uri)
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/)
      
      if (!pathMatch) {
        return null
      }

      const filePath = pathMatch[1]
      if (!filePath) {
        return null
      }

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        console.error('获取签名URL失败:', error)
        return null
      }

      return data.signedUrl
    } catch (error) {
      console.error('获取签名URL失败:', error)
      return null
    }
  }

  /**
   * 检查资产是否存在
   * @param asset 资产引用对象
   * @returns 是否存在
   */
  async checkAssetExists(asset: AssetRef): Promise<boolean> {
    if (!this.isStorageAvailable() || asset.source !== 'remote' || !asset.uri) {
      return false
    }

    try {
      const url = new URL(asset.uri)
      const pathMatch = url.pathname.match(/\/storage\/v1\/object\/public\/assets\/(.+)$/)
      
      if (!pathMatch) {
        return false
      }

      const filePath = pathMatch[1]
      if (!filePath) {
        return false
      }

      const { data, error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .list(filePath.split('/').slice(0, -1).join('/'))

      if (error) {
        return false
      }

      const fileName = filePath.split('/').pop()
      if (!fileName) {
        return false
      }
      return data?.some(file => file.name === fileName) ?? false
    } catch (error) {
      return false
    }
  }
}

/**
 * 导出单例实例
 */
export const assetApi = AssetApi.getInstance()