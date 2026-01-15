import { supabase, TABLES } from './supabase'
import type { SceneRow } from './db'
import type { SceneObjectData } from '@/interfaces/sceneInterface'
import type { AssetRef } from '@/types/asset'

/**
 * 云数据库场景数据表结构
 */
export interface CloudSceneRow {
  id?: number
  user_id?: string // Supabase 自动管理的用户ID
  name: string
  a_ids: number
  version: number
  object_data_list: SceneObjectData[] | string // JSON 字符串或对象
  assets: AssetRef[] | string // JSON 字符串或对象
  renderer_settings: Record<string, unknown> | string // JSON 字符串或对象
  thumbnail?: string
  updated_at: string
  created_at: string
}

/**
 * 将本地 SceneRow 转换为云数据库格式
 */
function localToCloud(local: SceneRow, userId?: string): Omit<CloudSceneRow, 'id'> {
  return {
    user_id: userId,
    name: local.name,
    a_ids: local.aIds,
    version: local.version,
    object_data_list: typeof local.objectDataList === 'string' 
      ? local.objectDataList 
      : JSON.stringify(local.objectDataList),
    assets: typeof local.assets === 'string'
      ? local.assets
      : JSON.stringify(local.assets || []),
    renderer_settings: typeof local.rendererSettings === 'string'
      ? local.rendererSettings
      : JSON.stringify(local.rendererSettings || {}),
    thumbnail: local.thumbnail,
    updated_at: local.updatedAt instanceof Date 
      ? local.updatedAt.toISOString() 
      : new Date(local.updatedAt).toISOString(),
    created_at: local.createdAt instanceof Date
      ? local.createdAt.toISOString()
      : new Date(local.createdAt).toISOString()
  }
}

/**
 * 将云数据库格式转换为本地 SceneRow
 */
function cloudToLocal(cloud: CloudSceneRow): SceneRow {
  const objectDataList: SceneObjectData[] = typeof cloud.object_data_list === 'string'
    ? JSON.parse(cloud.object_data_list)
    : cloud.object_data_list ?? []
  
  const assets: AssetRef[] = typeof cloud.assets === 'string'
    ? JSON.parse(cloud.assets)
    : cloud.assets ?? []
  
  const rendererSettings = typeof cloud.renderer_settings === 'string'
    ? JSON.parse(cloud.renderer_settings)
    : cloud.renderer_settings ?? {}

  return {
    id: cloud.id,
    name: cloud.name,
    aIds: cloud.a_ids,
    version: cloud.version,
    objectDataList,
    assets,
    rendererSettings,
    thumbnail: cloud.thumbnail,
    updatedAt: new Date(cloud.updated_at),
    createdAt: new Date(cloud.created_at)
  }
}

/**
 * 云数据库同步服务
 */
export class CloudSyncService {
  /**
   * 获取当前用户ID（匿名模式返回 null）
   */
  private async getUserId(): Promise<string | null> {
    // 匿名模式，不需要用户登录
    return null
  }

  /**
   * 上传场景到云端
   */
  async uploadScene(localScene: SceneRow): Promise<CloudSceneRow | null> {
    try {
      const userId = await this.getUserId()
      const cloudData = localToCloud(localScene, userId || undefined)

      if (localScene.id) {
        // 更新现有场景
        const { data, error } = await supabase
          .from(TABLES.SCENES)
          .update(cloudData)
          .eq('id', localScene.id)
          .select()
          .single()

        if (error) throw error
        return data as CloudSceneRow
      } else {
        // 创建新场景
        const { data, error } = await supabase
          .from(TABLES.SCENES)
          .insert(cloudData)
          .select()
          .single()

        if (error) throw error
        return data as CloudSceneRow
      }
    } catch (error) {
      console.error('上传场景到云端失败:', error)
      throw error
    }
  }

  /**
   * 从云端下载场景列表
   */
  async downloadSceneList(): Promise<SceneRow[]> {
    try {
      const userId = await this.getUserId()
      
      let query = supabase
        .from(TABLES.SCENES)
        .select('*')
        .order('updated_at', { ascending: false })
      
      // 如果有用户ID，只获取该用户的数据；否则获取所有数据
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query

      if (error) throw error
      return (data || []).map(cloudToLocal)
    } catch (error) {
      console.error('从云端下载场景列表失败:', error)
      throw error
    }
  }

  /**
   * 从云端下载单个场景
   */
  async downloadScene(sceneId: number): Promise<SceneRow | null> {
    try {
      const userId = await this.getUserId()
      
      let query = supabase
        .from(TABLES.SCENES)
        .select('*')
        .eq('id', sceneId)
      
      // 如果有用户ID，只获取该用户的数据；否则获取所有数据
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { data, error } = await query.single()

      if (error) {
        if (error.code === 'PGRST116') {
          // 未找到记录
          return null
        }
        throw error
      }

      return cloudToLocal(data as CloudSceneRow)
    } catch (error) {
      console.error('从云端下载场景失败:', error)
      throw error
    }
  }

  /**
   * 删除云端场景
   */
  async deleteScene(sceneId: number): Promise<boolean> {
    try {
      const userId = await this.getUserId()
      
      let query = supabase
        .from(TABLES.SCENES)
        .delete()
        .eq('id', sceneId)
      
      // 如果有用户ID，只删除该用户的数据；否则删除所有匹配的数据
      if (userId) {
        query = query.eq('user_id', userId)
      }
      
      const { error } = await query

      if (error) throw error
      return true
    } catch (error) {
      console.error('删除云端场景失败:', error)
      return false
    }
  }

  /**
   * 订阅场景变化（实时同步）
   */
  async subscribeToScenes(callback: (payload: any) => void) {
    const userId = await this.getUserId()
    
    const filter = userId ? `user_id=eq.${userId}` : undefined
    
    return supabase
      .channel('scenes_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: TABLES.SCENES,
          ...(filter ? { filter } : {})
        },
        callback
      )
      .subscribe()
  }
}

export const cloudSync = new CloudSyncService()
