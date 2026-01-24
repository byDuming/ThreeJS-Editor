import { supabase, TABLES } from './supabase'
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
   * 获取存储桶路径（全局共享，统一存储在 public 目录）
   * @param assetId 资产ID
   * @param fileName 文件名
   */
  private getStoragePath(assetId: string, fileName: string): string {
    return `public/${assetId}/${fileName}`
  }

  /**
   * 上传资产到 Supabase Storage，并保存到全局 assets 表
   * @param params 上传参数
   * @returns 上传结果，包含资产信息和公开URL
   */
  async uploadAsset(params: UploadAssetParams): Promise<UploadAssetResult> {
    if (!this.isStorageAvailable()) {
      throw new Error('Supabase Storage 未配置，请检查环境变量')
    }

    const { file, type } = params

    // 生成资产ID
    const assetId = `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const fileName = `${assetId}.${ext}`
    
    // 构建存储路径（全局共享，统一存储在 public 目录）
    const filePath = this.getStoragePath(assetId, fileName)

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
        source: 'cloud',
        meta: {
          ext,
          size: file.size,
          mime: file.type
        },
        createdAt: Date.now()
      }

      // 保存到全局 assets 表
      const { error: dbError } = await supabase
        .from(TABLES.ASSETS)
        .insert({
          id: asset.id,
          type: asset.type,
          uri: asset.uri,
          name: asset.name,
          source: asset.source,
          thumbnail: asset.thumbnail,
          meta: asset.meta,
          created_at: new Date(asset.createdAt!).toISOString()
        })

      if (dbError) {
        console.warn('保存资产到数据库失败:', dbError)
        // 不抛出错误，因为文件已上传成功
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
   * @returns 上传结果列表
   */
  async uploadAssets(
    files: File[],
    type: AssetRef['type']
  ): Promise<UploadAssetResult[]> {
    const results: UploadAssetResult[] = []
    
    for (const file of files) {
      try {
        const result = await this.uploadAsset({ file, type })
        results.push(result)
      } catch (error) {
        console.error(`上传文件 ${file.name} 失败:`, error)
        // 继续上传其他文件，不中断流程
      }
    }

    return results
  }

  /**
   * 删除资产（同时删除 Storage 文件和数据库记录）
   * @param asset 资产引用对象
   * @returns 是否删除成功
   */
  async deleteAsset(asset: AssetRef): Promise<boolean> {
    if (!this.isStorageAvailable()) {
      throw new Error('Supabase Storage 未配置')
    }

    // 只处理云端资产（含 legacy source='remote' 的兼容）
    if (!asset.uri || (asset.source !== 'cloud' && asset.source !== 'remote')) {
      return false
    }

    try {
      // 从URL中提取文件路径
      // URL格式: https://xxx.supabase.co/storage/v1/object/public/assets/public/asset-xxx/asset-xxx.glb
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

      // 删除 Storage 文件
      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove([filePath])

      if (error) {
        console.error('删除资产文件失败:', error)
        return false
      }

      // 同时删除数据库记录
      const { error: dbError } = await supabase
        .from(TABLES.ASSETS)
        .delete()
        .eq('id', asset.id)

      if (dbError) {
        console.warn('删除数据库记录失败:', dbError)
        // 不返回 false，因为文件已删除成功
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

    // 只处理云端资产（含 legacy source='remote' 的兼容）
    if (!asset.uri || (asset.source !== 'cloud' && asset.source !== 'remote')) {
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
    // 只处理云端资产（含 legacy source='remote' 的兼容）
    if (!this.isStorageAvailable() || !asset.uri || (asset.source !== 'cloud' && asset.source !== 'remote')) {
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

  /**
   * 获取全局资产列表（从 assets 数据库表获取）
   * @param type 资产类型过滤（可选）
   * @returns 资产列表
   */
  async getGlobalAssets(type?: AssetRef['type']): Promise<AssetRef[]> {
    if (!this.isStorageAvailable()) {
      console.warn('Supabase 未配置，无法获取全局资产')
      return []
    }

    try {
      let query = supabase
        .from(TABLES.ASSETS)
        .select('*')
        .order('created_at', { ascending: false })

      if (type) {
        query = query.eq('type', type)
      }

      const { data, error } = await query

      if (error) {
        console.error('获取资产列表失败:', error)
        console.error('请确保已在 Supabase 中创建 assets 表，参考 supabase-schema.sql')
        return []
      }
      
      console.log(`✅ 获取到 ${data?.length ?? 0} 个全局资产`, type ? `(类型: ${type})` : '')

      return (data || []).map((row: any) => ({
        id: row.id,
        type: row.type,
        uri: row.uri,
        name: row.name,
        source: row.source,
        thumbnail: row.thumbnail,
        meta: row.meta,
        createdAt: new Date(row.created_at).getTime()
      }))
    } catch (error) {
      console.error('获取资产列表失败:', error)
      return []
    }
  }
}

/**
 * 导出单例实例
 */
export const assetApi = AssetApi.getInstance()