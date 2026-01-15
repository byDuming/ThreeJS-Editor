import type { SceneObjectData } from '@/interfaces/sceneInterface'
import type { AssetRef } from '@/types/asset'
import { init, getInstance } from 'ts-indexdb'

export type SceneRow = {
  id?: number
  name: string
  aIds: number
  version: number
  objectDataList: SceneObjectData[]
  assets?: AssetRef[]
  rendererSettings?: Record<string, unknown>
  thumbnail?: string // 缩略图 URL
  updatedAt: Date
  createdAt: Date
}

export async function initDB(): Promise<{ inst: ReturnType<typeof getInstance>; sceneData: SceneRow }> {
  await init({
    dbName: '3dwg-engine-db',
    version: 1,
    tables: [
      {
        tableName: 'sceneData',
        option: { keyPath: 'id', autoIncrement: true },
        indexs: [
          { key: 'id', option: { unique: true } },
          { key: 'name' },
          { key: 'aIds' },
          { key: 'version' },
          { key: 'objectDataList' },
          { key: 'assets' },
          { key: 'updatedAt' },
          { key: 'createdAt' }
        ]
      }
    ]
  })
  const inst = getInstance()
  const rows = await inst.queryAll({ tableName: 'sceneData' })
  if (!rows?.length) {
    const sceneData: SceneRow = {
      name: '默认场景',
      aIds: 3,
      version: 1,
      assets: [],
      rendererSettings: {
        rendererType: 'webgpu',
        antialias: true,
        shadows: true,
        shadowType: 'pcf',
        toneMapping: 'acesFilmic',
        toneMappingExposure: 1,
        outputColorSpace: 'srgb',
        useLegacyLights: false
      },
      objectDataList: [
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
      ],
      updatedAt: new Date(),
      createdAt: new Date()
    }
    await inst.insert({ tableName: 'sceneData', data: sceneData })
    return { inst, sceneData }
  }

  const first = rows[0] as any
  const objectDataList: SceneObjectData[] =
    typeof first.objectDataList === 'string'
      ? JSON.parse(first.objectDataList)
      : first.objectDataList ?? []
  const assets =
    typeof first.assets === 'string'
      ? JSON.parse(first.assets)
      : first.assets ?? []
  const rendererSettings =
    typeof first.rendererSettings === 'string'
      ? JSON.parse(first.rendererSettings)
      : first.rendererSettings

  return { inst, sceneData: { ...first, objectDataList, assets, rendererSettings } }
}

export function getDB() {
  return getInstance()
}
