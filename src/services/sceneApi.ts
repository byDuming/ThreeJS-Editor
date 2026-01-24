import type { SceneObjectData } from '@/interfaces/sceneInterface'
import type { AssetRef } from '@/types/asset'
import type { AnimationStorageData } from '@/types/animation'
import { getDB, initDB, type SceneRow } from './db'
import { cloudSync } from './cloudSync'
import { supabase, TABLES } from './supabase'

/**
 * 场景列表项（用于首页展示，不包含完整数据）
 */
export interface SceneListItem {
  id: number
  name: string
  version: number
  updatedAt: Date
  createdAt: Date
  thumbnail?: string // 缩略图 URL（可选）
}

/**
 * 创建场景的参数
 */
export interface CreateSceneParams {
  name: string
  objectDataList?: SceneObjectData[]
  assets?: AssetRef[]
  rendererSettings?: Record<string, unknown>
  animationData?: AnimationStorageData
}

/**
 * 更新场景的参数
 */
export interface UpdateSceneParams {
  id: number
  name?: string
  aIds?: number
  version?: number
  objectDataList?: SceneObjectData[]
  assets?: AssetRef[]
  rendererSettings?: Record<string, unknown>
  animationData?: AnimationStorageData
  thumbnail?: string
  /** 跳过从云端获取当前场景数据（当已提供完整数据时使用，可显著提升性能） */
  skipFetch?: boolean
  /** 提供 createdAt 用于完整保存（跳过 fetch 时需要） */
  createdAt?: Date
}

/**
 * 场景 API 服务类
 * 提供场景的 CRUD 操作接口
 */
export class SceneApi {
  private static instance: SceneApi
  private dbInitialized = false
  private cloudSyncEnabled = false

  private constructor() {
    // 检查是否配置了 Supabase（通过环境变量判断）
    this.cloudSyncEnabled = !!(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY)
  }

  /**
   * 启用/禁用云同步
   */
  setCloudSyncEnabled(enabled: boolean) {
    this.cloudSyncEnabled = enabled
  }

  /**
   * 检查云同步是否可用
   */
  isCloudSyncEnabled(): boolean {
    return this.cloudSyncEnabled
  }

  /**
   * 获取单例实例
   */
  static getInstance(): SceneApi {
    if (!SceneApi.instance) {
      SceneApi.instance = new SceneApi()
    }
    return SceneApi.instance
  }

  /**
   * 确保数据库已初始化
   */
  private async ensureDBInitialized() {
    if (!this.dbInitialized) {
      await initDB()
      this.dbInitialized = true
    }
  }

  /**
   * 获取场景列表（用于首页展示）
   * @param useCloud 是否从云端获取（默认根据配置自动决定）
   * @returns 场景列表
   */
  async getSceneList(useCloud?: boolean): Promise<SceneListItem[]> {
    const shouldUseCloud = useCloud ?? this.cloudSyncEnabled

    // 如果启用云同步，优先从云端获取
    if (shouldUseCloud) {
      try {
        const cloudScenes = await cloudSync.downloadSceneList()
        return cloudScenes.map(scene => ({
          id: scene.id!,
          name: scene.name,
          version: scene.version,
          updatedAt: scene.updatedAt,
          createdAt: scene.createdAt,
          thumbnail: scene.thumbnail
        }))
      } catch (error: any) {
        console.warn('从云端获取场景列表失败，回退到本地:', error.message)
        // 回退到本地
      }
    }

    // 从本地获取（作为回退或云同步未启用时）
    await this.ensureDBInitialized()
    const db = getDB()
    const rows = (await db.queryAll({ tableName: 'sceneData' })) as any[]
    
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      version: row.version,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt : new Date(row.updatedAt),
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      thumbnail: row.thumbnail
    }))
  }

  /**
   * 根据 ID 获取场景详情
   * @param id 场景 ID
   * @param useCloud 是否从云端获取（默认根据配置自动决定）
   * @returns 场景数据
   */
  async getSceneById(id: number, useCloud?: boolean): Promise<SceneRow | null> {
    const shouldUseCloud = useCloud ?? this.cloudSyncEnabled

    if (shouldUseCloud) {
      try {
        // 从云端获取
        const cloudScene = await cloudSync.downloadScene(id)
        if (cloudScene) {
          // 同时保存到本地缓存
          await this.saveToLocal(cloudScene)
          return cloudScene
        }
      } catch (error: any) {
        console.warn('从云端获取场景失败，回退到本地:', error.message)
        // 回退到本地
      }
    }

    // 从本地获取
    await this.ensureDBInitialized()
    const db = getDB()
    const row = await db.query_by_primaryKey({ tableName: 'sceneData', value: id }) as any
    
    if (!row) return null

    const objectDataList: SceneObjectData[] =
      typeof row.objectDataList === 'string'
        ? JSON.parse(row.objectDataList)
        : row.objectDataList ?? []
    const assets =
      typeof row.assets === 'string'
        ? JSON.parse(row.assets)
        : row.assets ?? []
    const rendererSettings =
      typeof row.rendererSettings === 'string'
        ? JSON.parse(row.rendererSettings)
        : row.rendererSettings
    const animationData =
      typeof row.animationData === 'string'
        ? JSON.parse(row.animationData)
        : row.animationData ?? null

    return {
      ...row,
      objectDataList,
      assets,
      rendererSettings,
      animationData
    } as SceneRow
  }

  /**
   * 保存场景到本地数据库（用于缓存）
   */
  private async saveToLocal(scene: SceneRow): Promise<void> {
    await this.ensureDBInitialized()
    const db = getDB()
    
    if (scene.id) {
      // 更新或插入
      const existing = await db.query_by_primaryKey({ tableName: 'sceneData', value: scene.id }) as any
      if (existing) {
        await db.update_by_primaryKey({
          tableName: 'sceneData',
          value: scene.id,
          handle: (row: any) => {
            row.name = scene.name
            row.version = scene.version
            row.aIds = scene.aIds
            row.objectDataList = JSON.stringify(scene.objectDataList)
            row.assets = JSON.stringify(scene.assets || [])
            row.rendererSettings = JSON.stringify(scene.rendererSettings || {})
            row.animationData = JSON.stringify(scene.animationData || null)
            row.thumbnail = scene.thumbnail
            row.updatedAt = scene.updatedAt
            row.createdAt = scene.createdAt
            return row
          }
        })
      } else {
        await db.insert({
          tableName: 'sceneData',
          data: {
            id: scene.id,
            name: scene.name,
            aIds: scene.aIds,
            version: scene.version,
            objectDataList: JSON.stringify(scene.objectDataList),
            assets: JSON.stringify(scene.assets || []),
            rendererSettings: JSON.stringify(scene.rendererSettings || {}),
            animationData: JSON.stringify(scene.animationData || null),
            thumbnail: scene.thumbnail,
            updatedAt: scene.updatedAt,
            createdAt: scene.createdAt
          }
        })
      }
    }
  }

  /**
   * 创建新场景
   * @param params 创建参数
   * @returns 创建的场景数据
   */
  async createScene(params: CreateSceneParams): Promise<SceneRow> {
    const defaultObjectDataList: SceneObjectData[] = [
      {
        id: 'Scene',
        name: '场景',
        type: 'scene',
        scene: {
          backgroundType: 'color',
          backgroundColor: '#CFD8DC',
          environmentType: 'none',
          fog: {
            type: 'none',
            color: '#ffffff',
            near: 1,
            far: 1000,
            density: 0.00025
          }
        },
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        childrenIds: ['grid-1'],
        visible: true,
        castShadow: false,
        receiveShadow: false,
        frustumCulled: true
      },
      {
        id: 'camera-1',
        name: 'Main Camera',
        type: 'camera',
        camera: {
          type: 'perspective',
          fov: 50,
          near: 0.01,
          far: 2000
        },
        parentId: undefined,
        transform: {
          position: [25, 30, 20],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        visible: true,
        castShadow: false,
        receiveShadow: false,
        frustumCulled: true,
        renderOrder: 0,
        userData: {}
      },
      {
        id: 'grid-1',
        name: 'Grid',
        type: 'helper',
        parentId: 'Scene',
        helper: {
          type: 'grid',
          size: 40,
          divisions: 40,
          colorCenterLine: '#666666',
          colorGrid: '#444444'
        },
        transform: {
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1]
        },
        visible: true,
        castShadow: false,
        receiveShadow: false,
        frustumCulled: true,
        renderOrder: 0,
        userData: {}
      }
    ]

    const sceneData: Omit<SceneRow, 'id'> = {
      name: params.name,
      aIds: 3,
      version: 1,
      objectDataList: params.objectDataList ?? defaultObjectDataList,
      assets: params.assets ?? [],
      rendererSettings: params.rendererSettings ?? {
        rendererType: 'webgl',
        antialias: true,
        shadows: true,
        shadowType: 'pcf',
        toneMapping: 'acesFilmic',
        toneMappingExposure: 1,
        outputColorSpace: 'srgb',
        useLegacyLights: false
      },
      updatedAt: new Date(),
      createdAt: new Date()
    }

    // 如果启用云同步，优先创建到云端
    if (this.cloudSyncEnabled) {
      try {
        const cloudScene = await cloudSync.uploadScene(sceneData as SceneRow)
        if (cloudScene?.id) {
          // 从云端数据转换为本地格式
          const objectDataList: SceneObjectData[] =
            typeof cloudScene.object_data_list === 'string'
              ? JSON.parse(cloudScene.object_data_list)
              : cloudScene.object_data_list ?? []
          const assets =
            typeof cloudScene.assets === 'string'
              ? JSON.parse(cloudScene.assets)
              : cloudScene.assets ?? []
          const rendererSettings =
            typeof cloudScene.renderer_settings === 'string'
              ? JSON.parse(cloudScene.renderer_settings)
              : cloudScene.renderer_settings ?? {}

          const animationData = cloudScene.animation_data
            ? (typeof cloudScene.animation_data === 'string'
              ? JSON.parse(cloudScene.animation_data)
              : cloudScene.animation_data)
            : undefined

          const result: SceneRow = {
            id: cloudScene.id,
            name: cloudScene.name,
            aIds: cloudScene.a_ids,
            version: cloudScene.version,
            objectDataList,
            assets,
            rendererSettings,
            animationData,
            thumbnail: cloudScene.thumbnail,
            updatedAt: new Date(cloudScene.updated_at),
            createdAt: new Date(cloudScene.created_at)
          }
          
          // 同时保存到本地作为缓存
          await this.saveToLocal(result)
          
          return result
        }
      } catch (error: any) {
        console.error('创建场景到云端失败:', error)
        // 如果云端失败，回退到本地
        console.log('回退到本地数据库创建')
      }
    }

    // 如果云同步未启用或云端创建失败，使用本地数据库
    await this.ensureDBInitialized()
    const db = getDB()
    await db.insert({ tableName: 'sceneData', data: sceneData })
    
    // 获取刚插入的数据
    const allRows = (await db.queryAll({ tableName: 'sceneData' })) as any[]
    const newRow = allRows[allRows.length - 1] as any

    const objectDataList: SceneObjectData[] =
      typeof newRow.objectDataList === 'string'
        ? JSON.parse(newRow.objectDataList)
        : newRow.objectDataList ?? []
    const assets =
      typeof newRow.assets === 'string'
        ? JSON.parse(newRow.assets)
        : newRow.assets ?? []
    const rendererSettings =
      typeof newRow.rendererSettings === 'string'
        ? JSON.parse(newRow.rendererSettings)
        : newRow.rendererSettings

    return {
      ...newRow,
      objectDataList,
      assets,
      rendererSettings
    } as SceneRow
  }

  /**
   * 更新场景
   * @param params 更新参数
   * @returns 更新后的场景数据
   */
  async updateScene(params: UpdateSceneParams): Promise<SceneRow | null> {
    const startTime = performance.now()
    let updatedScene: SceneRow

    // 如果提供了 skipFetch 且有完整数据，直接构建更新数据（跳过网络请求，显著提升性能）
    if (params.skipFetch && params.name !== undefined && params.objectDataList !== undefined) {
      console.log('[sceneApi.updateScene] 使用 skipFetch 模式，跳过云端数据获取')
      updatedScene = {
        id: params.id,
        name: params.name,
        aIds: params.aIds ?? 1,
        version: params.version ?? 1,
        objectDataList: params.objectDataList,
        assets: params.assets ?? [],
        rendererSettings: params.rendererSettings ?? {},
        animationData: params.animationData,
        thumbnail: params.thumbnail,
        updatedAt: new Date(),
        createdAt: params.createdAt ?? new Date()
      }
    } else {
      // 需要获取当前场景数据来合并（用于部分更新场景）
      const fetchStartTime = performance.now()
      const currentScene = await this.getSceneById(params.id, this.cloudSyncEnabled)
      console.log(`[sceneApi.updateScene] getSceneById 耗时: ${(performance.now() - fetchStartTime).toFixed(0)}ms`)
      if (!currentScene) {
        throw new Error(`场景 ID ${params.id} 不存在`)
      }

      // 构建更新后的场景数据
      updatedScene = {
        ...currentScene,
        name: params.name ?? currentScene.name,
        aIds: params.aIds ?? currentScene.aIds,
        version: params.version ?? currentScene.version,
        objectDataList: params.objectDataList ?? currentScene.objectDataList,
        assets: params.assets ?? currentScene.assets,
        rendererSettings: params.rendererSettings ?? currentScene.rendererSettings,
        animationData: params.animationData ?? currentScene.animationData,
        thumbnail: params.thumbnail !== undefined ? params.thumbnail : currentScene.thumbnail,
        updatedAt: new Date()
      }
    }

    // 如果启用云同步，优先更新云端
    if (this.cloudSyncEnabled) {
      try {
        const cloudStartTime = performance.now()
        const cloudScene = await cloudSync.uploadScene(updatedScene)
        console.log(`[sceneApi.updateScene] cloudSync.uploadScene 耗时: ${(performance.now() - cloudStartTime).toFixed(0)}ms`)
        if (cloudScene?.id) {
          // 从云端数据转换为本地格式
          const objectDataList: SceneObjectData[] =
            typeof cloudScene.object_data_list === 'string'
              ? JSON.parse(cloudScene.object_data_list)
              : cloudScene.object_data_list ?? []
          const assets =
            typeof cloudScene.assets === 'string'
              ? JSON.parse(cloudScene.assets)
              : cloudScene.assets ?? []
          const rendererSettings =
            typeof cloudScene.renderer_settings === 'string'
              ? JSON.parse(cloudScene.renderer_settings)
              : cloudScene.renderer_settings ?? {}
          const animationData = cloudScene.animation_data
            ? (typeof cloudScene.animation_data === 'string'
              ? JSON.parse(cloudScene.animation_data)
              : cloudScene.animation_data)
            : undefined

          const result: SceneRow = {
            id: cloudScene.id,
            name: cloudScene.name,
            aIds: cloudScene.a_ids,
            version: cloudScene.version,
            objectDataList,
            assets,
            rendererSettings,
            animationData,
            thumbnail: cloudScene.thumbnail,
            updatedAt: new Date(cloudScene.updated_at),
            createdAt: new Date(cloudScene.created_at)
          }

          // 同时保存到本地作为缓存
          const localCacheStartTime = performance.now()
          await this.saveToLocal(result)
          console.log(`[sceneApi.updateScene] saveToLocal 耗时: ${(performance.now() - localCacheStartTime).toFixed(0)}ms`)
          console.log(`[sceneApi.updateScene] ✅ 更新完成 (云端)，总耗时: ${(performance.now() - startTime).toFixed(0)}ms`)
          return result
        }
      } catch (error: any) {
        console.error('更新场景到云端失败:', error)
        // 如果云端失败，回退到本地
        console.log('回退到本地数据库更新')
      }
    }

    // 如果云同步未启用或云端更新失败，使用本地数据库
    const localStartTime = performance.now()
    await this.ensureDBInitialized()
    const db = getDB()
    await db.update_by_primaryKey({
      tableName: 'sceneData',
      value: params.id,
      handle: (row: any) => {
        row.name = updatedScene.name
        row.aIds = updatedScene.aIds
        row.version = updatedScene.version
        row.objectDataList = JSON.stringify(updatedScene.objectDataList)
        row.assets = JSON.stringify(updatedScene.assets || [])
        row.rendererSettings = JSON.stringify(updatedScene.rendererSettings || {})
        row.animationData = JSON.stringify(updatedScene.animationData || null)
        row.thumbnail = updatedScene.thumbnail
        row.updatedAt = updatedScene.updatedAt
        return row
      }
    })
    console.log(`[sceneApi.updateScene] 本地数据库更新耗时: ${(performance.now() - localStartTime).toFixed(0)}ms`)
    console.log(`[sceneApi.updateScene] ✅ 更新完成 (本地)，总耗时: ${(performance.now() - startTime).toFixed(0)}ms`)

    return updatedScene
  }

  /**
   * 保存场景（更新当前场景的所有数据）
   * @param id 场景 ID
   * @param sceneData 场景数据
   * @returns 保存后的场景数据
   */
  async saveScene(id: number, sceneData: {
    name: string
    aIds: number
    version: number
    objectDataList: SceneObjectData[]
    assets: AssetRef[]
    rendererSettings: Record<string, unknown>
    animationData?: AnimationStorageData
    thumbnail?: string
  }): Promise<SceneRow | null> {
    // 使用 skipFetch: true 跳过冗余的 getSceneById 调用
    // 因为 saveScene 已经提供了完整的场景数据，无需再从云端获取
    return this.updateScene({
      id,
      name: sceneData.name,
      aIds: sceneData.aIds,
      version: sceneData.version,
      objectDataList: sceneData.objectDataList,
      assets: sceneData.assets,
      rendererSettings: sceneData.rendererSettings,
      animationData: sceneData.animationData,
      thumbnail: sceneData.thumbnail,
      skipFetch: true // 性能优化：跳过冗余的网络请求
    })
  }

  /**
   * 仅更新场景缩略图（用于异步上传截图后更新）
   * @param id 场景 ID
   * @param thumbnailUrl 缩略图 URL
   */
  async updateThumbnail(id: number, thumbnailUrl: string): Promise<void> {
    if (this.cloudSyncEnabled) {
      try {
        await supabase
          .from(TABLES.SCENES)
          .update({ thumbnail: thumbnailUrl, updated_at: new Date().toISOString() })
          .eq('id', id)
      } catch (error) {
        console.warn('更新云端缩略图失败:', error)
      }
    }

    // 同时更新本地缓存
    try {
      await this.ensureDBInitialized()
      const db = getDB()
      await db.update_by_primaryKey({
        tableName: 'sceneData',
        value: id,
        handle: (row: any) => {
          row.thumbnail = thumbnailUrl
          return row
        }
      })
    } catch (error) {
      console.warn('更新本地缩略图失败:', error)
    }
  }

  /**
   * 删除场景
   * @param id 场景 ID
   * @returns 是否删除成功
   */
  async deleteScene(id: number): Promise<boolean> {
    try {
      // 如果启用云同步，优先删除云端
      if (this.cloudSyncEnabled) {
        try {
          const success = await cloudSync.deleteScene(id)
          if (success) {
            // 云端删除成功，同时删除本地缓存
            await this.ensureDBInitialized()
            const db = getDB()
            try {
              await db.delete_by_primaryKey({ tableName: 'sceneData', value: id })
            } catch (error) {
              // 本地删除失败不影响，因为云端已删除
              console.warn('删除本地缓存失败:', error)
            }
            return true
          }
        } catch (error: any) {
          console.error('删除云端场景失败:', error)
          // 如果云端失败，回退到本地
          console.log('回退到本地数据库删除')
        }
      }

      // 如果云同步未启用或云端删除失败，使用本地数据库
      await this.ensureDBInitialized()
      const db = getDB()
      await db.delete_by_primaryKey({ tableName: 'sceneData', value: id })
      return true
    } catch (error) {
      console.error('删除场景失败:', error)
      return false
    }
  }
}

// 导出单例实例
export const sceneApi = SceneApi.getInstance()
