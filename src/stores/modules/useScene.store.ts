/**
 * 场景 Store - 统一入口
 * 
 * 组合多个子 store，提供统一的 API 接口。
 * 组件可以继续使用 useSceneStore，无需修改代码。
 * 
 * 子 Stores:
 * - useSceneAssetStore: 资产管理
 * - useSceneSelectionStore: 选择状态和变换控制
 * - useSceneHistoryStore: 撤销/重做历史
 */

import type { SceneObjectData } from '@/interfaces/sceneInterface.ts'
import { initDB } from '@/services/db'

import { defineStore } from 'pinia'
import { Object3D, Scene } from 'three'
import type { WebGPURenderer } from 'three/webgpu'
import type { WebGLRenderer } from 'three'
import { computed, ref, shallowRef, h, toRaw, nextTick } from 'vue'
import { createSceneObjectData, type SceneObjectInput } from '@/utils/sceneFactory.ts'
import { applyCameraSettings, applyLightSettings, applySceneSettings, applyTransform, createThreeObject, syncThreeObjectState, updateMeshGeometry, updateMeshMaterial, ensureUV2ForModel, applyShadowRecursively } from '@/utils/threeObjectFactory.ts'
import { NIcon, type TreeOption } from 'naive-ui'
import { Cube, LogoDropbox, CubeOutline, Camera } from '@vicons/ionicons5'
import { LightbulbFilled, MovieCreationFilled } from '@vicons/material'
import { Cubes } from '@vicons/fa'
import type { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'
import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider'
import type { AssetRef } from '@/types/asset'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { AddObjectCommand, RemoveObjectCommand, UpdateTransformCommand, UpdateObjectCommand, UndoGroup } from '@/utils/commandPattern'

// 导入子 stores
import { useSceneAssetStore } from './useSceneAsset.store'
import { useSceneSelectionStore } from './useSceneSelection.store'
import { useSceneHistoryStore, type SceneSnapshot } from './useSceneHistory.store'


export const useSceneStore = defineStore('scene', () => {
  // ==================== 组合子 Stores ====================
  const assetStore = useSceneAssetStore()
  const selectionStore = useSceneSelectionStore()
  const historyStore = useSceneHistoryStore()

  // ==================== 核心状态 ====================
  const name = ref('sceneStore')
  const version = ref(1)
  const aIds = ref(1)
  const currentSceneId = ref<number | null>(null)

  const notification = ref<NotificationApiInjection>()
  const dialogProvider = ref<DialogApiInjection>()

  // Three.js 对象映射（扁平化，快速查找）
  const objectsMap = shallowRef(new Map<string, Object3D>())
  // 引擎逻辑层级（独立维护）
  const objectDataList = ref<SceneObjectData[]>([])
  // Three 渲染器引用
  const renderer = shallowRef<WebGPURenderer | WebGLRenderer | null>(null)
  const threeScene = shallowRef<Scene | null>(null)
  const rendererSettings = ref({
    rendererType: 'webgl',
    antialias: true,
    shadows: true,
    shadowType: 'pcf',
    toneMapping: 'acesFilmic',
    toneMappingExposure: 1,
    outputColorSpace: 'srgb',
    useLegacyLights: false
  })

  // 截图函数引用（由 useRenderer 设置）
  const captureScreenshotFn = shallowRef<((width?: number, height?: number) => Promise<Blob>) | null>(null)
  
  // 相机控制器目标点（由 useRenderer 设置）
  const cameraControlsTarget = ref<[number, number, number]>([0, 0, 0])
  
  function setCaptureScreenshotFn(fn: ((width?: number, height?: number) => Promise<Blob>) | null) {
    captureScreenshotFn.value = fn
  }
  
  function setCameraControlsTarget(target: [number, number, number]) {
    cameraControlsTarget.value = target
  }

  // ==================== 代理子 Store 属性（API 兼容） ====================
  
  // 资产管理代理（可写 computed 以保持 API 兼容）
  const assets = computed({
    get: () => assetStore.assets,
    set: (val) => assetStore.setAssets(val)
  })
  const assetFiles = computed(() => assetStore.assetFiles)
  
  function getAssetById(id: string) {
    return assetStore.getAssetById(id)
  }
  
  function registerLocalAsset(file: File, type: AssetRef['type']): AssetRef {
    return assetStore.registerLocalAsset(file, type)
  }
  
  function registerRemoteAsset(asset: AssetRef): AssetRef {
    return assetStore.registerRemoteAsset(asset)
  }
  
  async function uploadAsset(file: File, type: AssetRef['type']): Promise<AssetRef> {
    return assetStore.uploadAsset(file, type)
  }
  
  async function resolveAssetUri(asset: AssetRef): Promise<{ url: string; revoke?: () => void } | null> {
    return assetStore.resolveAssetUri(asset)
  }

  // 选择状态代理
  const selectedObjectId = computed({
    get: () => selectionStore.selectedObjectId,
    set: (val) => { selectionStore.selectedObjectId = val }
  })
  const selectionVersion = computed(() => selectionStore.selectionVersion)
  const transformMode = computed({
    get: () => selectionStore.transformMode,
    set: (val) => { selectionStore.transformMode = val }
  })
  const transformSpace = computed({
    get: () => selectionStore.transformSpace,
    set: (val) => { selectionStore.transformSpace = val }
  })
  const transformSnap = computed({
    get: () => selectionStore.transformSnap,
    set: (val) => { selectionStore.transformSnap = val }
  })
  const isEditMode = computed({
    get: () => selectionStore.isEditMode,
    set: (val) => { selectionStore.isEditMode = val }
  })

  // 历史管理代理
  const historyManager = computed(() => historyStore.historyManager)
  const historyVersion = computed(() => historyStore.historyVersion)
  const useCommandPattern = computed({
    get: () => historyStore.useCommandPattern,
    set: (val) => { historyStore.useCommandPattern = val }
  })
  const undoStack = computed(() => historyStore.undoStack)
  const redoStack = computed(() => historyStore.redoStack)
  const isSceneReady = computed({
    get: () => historyStore.isSceneReady,
    set: (val) => { historyStore.setSceneReady(val) }
  })
  const canUndo = computed(() => historyStore.canUndo)
  const canRedo = computed(() => historyStore.canRedo)
  const snapshotKeyMode = computed(() => historyStore.snapshotKeyMode)
  const snapshotKeyList = computed(() => historyStore.snapshotKeyList)
  
  function setSnapshotKeyMode(mode: 'blacklist' | 'whitelist') {
    historyStore.setSnapshotKeyMode(mode)
  }
  
  function setSnapshotKeyList(keys: string[]) {
    historyStore.setSnapshotKeyList(keys)
  }
  
  function undo() {
    if (!canUndo.value) return
    historyStore.undo()
  }
  
  function redo() {
    if (!canRedo.value) return
    historyStore.redo()
  }

  // ==================== 选中对象计算属性 ====================
  
  const selectedObjectData = computed(() => {
    const id = selectedObjectId.value
    if (!id) return null
    return objectDataList.value.find(item => item.id === id) || null
  })

  // ==================== 快照工具方法 ====================
  
  function createSnapshot(): SceneSnapshot {
    return historyStore.cloneSnapshot({
      objectDataList: toRaw(objectDataList.value),
      selectedObjectId: selectedObjectId.value,
      aIds: aIds.value
    })
  }
  
  function pushHistorySnapshot(snapshot?: SceneSnapshot) {
    if (historyStore.isRestoring) return
    historyStore.pushHistorySnapshot(snapshot ?? createSnapshot())
  }
  
  function scheduleHistorySnapshot(isCritical = false) {
    if (historyStore.isRestoring) return
    if (isCritical) {
      historyStore.pendingCriticalOperation = true
      if (historyStore.historyDebounceTimer) {
        clearTimeout(historyStore.historyDebounceTimer)
        historyStore.historyDebounceTimer = null
      }
      pushHistorySnapshot()
      historyStore.setLastSnapshot(createSnapshot())
      return
    }
  }

  // ==================== 模型加载 ====================
  
  async function loadModelAssetIntoObject(assetId: string, objectId: string): Promise<void> {
    const asset = getAssetById(assetId)
    if (!asset) {
      console.warn(`[loadModelAssetIntoObject] 找不到资产: ${assetId}`)
      return
    }
    
    const target = objectsMap.value.get(objectId)
    if (!target) {
      console.warn(`[loadModelAssetIntoObject] 找不到目标对象: ${objectId}`)
      return
    }
    
    const objectData = objectDataList.value.find(d => d.id === objectId)
    
    // 如果资产已经在加载中，等待加载完成
    const existingPromise = assetStore.getAssetLoadPromise(assetId)
    if (existingPromise) {
      await existingPromise
      const cachedScene = assetStore.getCachedAssetScene(assetId)
      if (cachedScene) {
        target.children.slice().forEach(child => target.remove(child))
        const clonedScene = cachedScene.clone(true)
        target.add(clonedScene)
        if (objectData && (objectData.castShadow || objectData.receiveShadow)) {
          applyShadowRecursively(target, objectData.castShadow, objectData.receiveShadow)
        }
      }
      return
    }
    
    // 如果资产已经加载完成，从缓存中克隆
    if (assetStore.isAssetLoaded(assetId)) {
      const cachedScene = assetStore.getCachedAssetScene(assetId)
      if (cachedScene) {
        target.children.slice().forEach(child => target.remove(child))
        const clonedScene = cachedScene.clone(true)
        target.add(clonedScene)
        if (objectData && (objectData.castShadow || objectData.receiveShadow)) {
          applyShadowRecursively(target, objectData.castShadow, objectData.receiveShadow)
        }
      }
      return
    }
    
    // 创建加载Promise
    const loadPromise = (async () => {
      assetStore.markAssetLoading(assetId)
      let resolved: { url: string; revoke?: () => void } | null = null
      try {
        resolved = await resolveAssetUri(asset)
        if (!resolved) {
          console.warn('Model asset is missing local file:', asset.name)
          return
        }
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync(resolved.url)
        
        if (gltf.scene) {
          ensureUV2ForModel(gltf.scene)
          assetStore.cacheAssetScene(assetId, gltf.scene)
          target.children.slice().forEach(child => target.remove(child))
          const clonedScene = gltf.scene.clone(true)
          target.add(clonedScene)
          if (objectData && (objectData.castShadow || objectData.receiveShadow)) {
            applyShadowRecursively(target, objectData.castShadow, objectData.receiveShadow)
          }
        }
        
        assetStore.markAssetLoaded(assetId)
        console.log(`[loadModelAssetIntoObject] 资产加载完成: ${asset.name} (${assetId})`)
      } catch (error) {
        console.error(`[loadModelAssetIntoObject] 加载资产失败: ${asset.name} (${assetId})`, error)
        assetStore.markAssetFailed(assetId)
        throw error
      } finally {
        resolved?.revoke?.()
      }
    })()
    
    assetStore.setAssetLoadPromise(assetId, loadPromise)
    await loadPromise
  }

  async function importModelFile(file: File, parentId: string) {
    const asset = registerLocalAsset(file, 'model')
    const created = addSceneObjectData({
      type: 'model',
      name: asset.name,
      parentId,
      assetId: asset.id
    })
    await loadModelAssetIntoObject(asset.id, created.id)
    selectedObjectId.value = created.id
  }

  // ==================== 场景初始化 ====================
  
  async function initScene() {
    historyStore.setSceneReady(false)
    
    const { sceneData } = await initDB()
    currentSceneId.value = sceneData.id ?? null
    name.value = sceneData.name
    version.value = sceneData.version
    aIds.value = sceneData.aIds
    rendererSettings.value = {
      ...rendererSettings.value,
      ...(sceneData.rendererSettings ?? {})
    }
    assetStore.setAssets((sceneData.assets ?? []) as AssetRef[])
    historyStore.setRestoring(true)
    objectDataList.value = sceneData.objectDataList ?? []

    // 加载动画数据
    if (sceneData.animationData) {
      const { useAnimationStore } = await import('./useAnimation.store')
      const animationStore = useAnimationStore()
      animationStore.setAnimationData(sceneData.animationData)
      console.log('[Scene] 已加载动画数据，剪辑数:', sceneData.animationData.clips?.length ?? 0)
    }

    const scene = threeScene.value ?? new Scene()
    setThreeScene(scene)
    historyStore.setRestoring(false)

    // 清空历史栈
    historyStore.clear()
    historyStore.setLastSnapshot(createSnapshot())
    
    historyStore.setSceneReady(true)
  }

  // ==================== 场景树管理 ====================
  
  const OBJECT_ICON_MAP: Record<string, any> = {
    mesh: Cube,
    group: LogoDropbox,
    helper: CubeOutline,
    light: LightbulbFilled,
    camera: Camera,
    model: Cubes,
    scene: MovieCreationFilled
  }

  function getObjectTree(): TreeOption[] {
    const tree: TreeOption[] = []
    const map = new Map<string, TreeOption & { raw: SceneObjectData; children: TreeOption[] }>()

    objectDataList.value.forEach(data => {
      const IconComponent = OBJECT_ICON_MAP[data.type] || Cube
      const prefix = () => h(IconComponent)

      map.set(data.id, {
        key: data.id,
        label: data.name ?? data.id,
        raw: data,
        children: [],
        prefix: () => h(NIcon, null, { default: prefix })
      })
    })

    objectDataList.value.forEach(data => {
      const node = map.get(data.id)!
      if (data.parentId === null || data.parentId === undefined) {
        tree.push(node)
      } else {
        const parent = map.get(data.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          tree.push(node)
        }
      }
    })

    return tree
  }

  function applyObjectTree(tree: TreeOption[], options?: { skipHistory?: boolean }) {
    const nextList: SceneObjectData[] = []
    const dfs = (nodes: TreeOption[], parentId?: string) => {
      nodes.forEach(node => {
        const raw = (node as any).raw as SceneObjectData | undefined
        if (!raw) return
        const children = node.children ?? []
        const childrenIds = children
          .map(child => ((child as any).raw as SceneObjectData | undefined)?.id)
          .filter((id): id is string => !!id)
        const updated: SceneObjectData = { ...raw, parentId, childrenIds }
        nextList.push(updated)
        if (children.length) dfs(children, raw.id)
      })
    }
    dfs(tree)
    
    const currentMap = new Map(objectDataList.value.map(item => [item.id, item]))
    const parentIdChanges: Array<{ id: string; prevParentId?: string; newParentId?: string }> = []
    
    nextList.forEach(item => {
      const current = currentMap.get(item.id)
      if (current && current.parentId !== item.parentId) {
        parentIdChanges.push({
          id: item.id,
          prevParentId: current.parentId,
          newParentId: item.parentId
        })
      }
    })
    
    if (parentIdChanges.length > 0 && !options?.skipHistory && useCommandPattern.value) {
      const getStoreRef = () => useSceneStore()
      const group = new UndoGroup('调整层级结构')
      
      parentIdChanges.forEach(change => {
        const prevData: Partial<SceneObjectData> = { parentId: change.prevParentId }
        const newData: Partial<SceneObjectData> = { parentId: change.newParentId }
        const command = new UpdateObjectCommand(getStoreRef, change.id, newData, prevData)
        group.addCommand(command)
      })
      
      if (!group.isEmpty()) {
        historyStore.pushCommand(group)
      }
    }
    
    objectDataList.value = nextList
    nextList.forEach(item => attachThreeObject(item))
  }

  // ==================== Three.js 场景管理 ====================
  
  async function setThreeScene(scene: Scene | null): Promise<void> {
    threeScene.value = scene
    if (!scene) return

    // 清空之前的加载状态缓存（不清空资产列表）
    assetStore.clearLoadingState()

    const dataMap = new Map(objectDataList.value.map(item => [item.id, item]))
    const modelLoadPromises: Promise<void>[] = []

    dataMap.forEach(data => {
      let obj = objectsMap.value.get(data.id)
      if (!obj) {
        obj = createThreeObject(data, { objectsMap: objectsMap.value })
        objectsMap.value.set(data.id, obj)
      }
      syncThreeObjectState(obj, data)
      if (data.type === 'camera' && obj instanceof Object3D) {
        if ((obj as any).isPerspectiveCamera) {
          applyCameraSettings(obj as any, data)
        }
      }
      if (data.type === 'light') {
        applyLightSettings(obj as any, data)
      }
      if (data.type === 'model' && data.assetId) {
        const loadPromise = loadModelAssetIntoObject(data.assetId, data.id)
        modelLoadPromises.push(loadPromise)
      }
    })

    objectsMap.value.forEach((obj, id) => {
      const data = dataMap.get(id)
      if (!data) return
      if (obj.parent) obj.parent.remove(obj)
      const parent = (data.parentId !== undefined && data.parentId !== null && data.parentId !== 'Scene')
        ? objectsMap.value.get(data.parentId)
        : threeScene.value
      parent?.add(obj)
    })

    const sceneData = objectDataList.value.find(item => item.type === 'scene')
    if (sceneData && threeScene.value) {
      applySceneSettings(threeScene.value, sceneData)
    }

    if (modelLoadPromises.length > 0) {
      console.log(`[setThreeScene] 等待 ${modelLoadPromises.length} 个模型资产加载完成...`)
      await Promise.allSettled(modelLoadPromises)
      console.log('[setThreeScene] 所有模型资产加载完成')
    }
  }

  // ==================== 父子关系管理 ====================
  
  function addChildToParent(parentId: string, childId: string) {
    const parent = objectDataList.value.find(item => item.id === parentId)
    if (parent) {
      parent.childrenIds = [...new Set([...(parent.childrenIds ?? []), childId])]
    }
  }

  function removeChildFromParent(parentId: string, childId: string) {
    const parent = objectDataList.value.find(item => item.id === parentId)
    if (parent?.childrenIds) {
      parent.childrenIds = parent.childrenIds.filter(id => id !== childId)
    }
  }

  function attachThreeObject(data: SceneObjectData) {
    const obj = objectsMap.value.get(data.id)
    if (!obj) return
    
    if (obj.parent) obj.parent.remove(obj)

    const parent = (data.parentId !== undefined && data.parentId !== null && data.parentId !== 'Scene') 
      ? objectsMap.value.get(data.parentId) 
      : threeScene.value
    parent?.add(obj)
  }

  // ==================== 对象 CRUD ====================
  
  function addSceneObjectData(input: SceneObjectInput, options?: { addToThree?: boolean; skipHistory?: boolean }) {
    const id = input.id ?? `obj-${aIds.value++}`
    
    const existing = objectDataList.value.find(item => item.id === id)
    if (existing && !options?.skipHistory) {
      return existing
    }
    
    if (existing && options?.skipHistory) {
      const existingIndex = objectDataList.value.findIndex(item => item.id === id)
      if (existingIndex >= 0) {
        objectDataList.value.splice(existingIndex, 1)
      }
      const oldObj = objectsMap.value.get(id)
      if (oldObj?.parent) {
        oldObj.parent.remove(oldObj)
      }
      objectsMap.value.delete(id)
    }
    
    const newObj = createSceneObjectData({ ...input, id })
    objectDataList.value.push(newObj)

    if (newObj.parentId) {
      addChildToParent(newObj.parentId, id)
    }

    const addToThree = options?.addToThree ?? true
    if (addToThree) {
      const obj3d = createThreeObject(newObj, { objectsMap: objectsMap.value })
      objectsMap.value.set(id, obj3d)
      attachThreeObject(newObj)
      
      if (newObj.type === 'model' && newObj.assetId) {
        void loadModelAssetIntoObject(newObj.assetId, id)
      }
    }

    if (!options?.skipHistory) {
      if (useCommandPattern.value) {
        const getStoreRef = () => useSceneStore()
        const clonedData = JSON.parse(JSON.stringify(newObj))
        const command = new AddObjectCommand(getStoreRef, clonedData)
        historyStore.pushCommand(command)
      } else {
        scheduleHistorySnapshot(true)
        nextTick(() => {
          historyStore.pendingCriticalOperation = false
        })
      }
    }
    return newObj
  }

  // ==================== 更新对象辅助函数 ====================
  
  function _saveOldState(target: SceneObjectData, patch: Partial<SceneObjectData>) {
    const prevData: Partial<SceneObjectData> = {}
    
    for (const key of Object.keys(patch)) {
      const k = key as keyof SceneObjectData
      if (k in target) {
        const value = (target as any)[k]
        if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)) {
          (prevData as any)[k] = JSON.parse(JSON.stringify(value))
        } else {
          (prevData as any)[k] = value
        }
      }
    }
    
    return {
      transform: JSON.parse(JSON.stringify(target.transform)),
      parentId: target.parentId,
      data: prevData
    }
  }
  
  function _detectChangeType(target: SceneObjectData, patch: Partial<SceneObjectData>, prevParentId?: string) {
    const typeChanged = patch.type !== undefined && patch.type !== target.type
    const helperChanged = patch.helper !== undefined && target.type === 'helper'
    const meshChanged = patch.mesh !== undefined && target.type === 'mesh'
    const lightTypeChanged = target.type === 'light' && patch.userData !== undefined 
      && (patch.userData as any)?.lightType !== (target.userData as any)?.lightType
    const assetChanged = patch.assetId !== undefined && patch.assetId !== target.assetId
    const parentChanged = 'parentId' in patch && patch.parentId !== prevParentId
    const nameChanged = patch.name !== undefined && patch.name !== target.name
    
    const isCritical = typeChanged || helperChanged || lightTypeChanged || parentChanged || assetChanged || meshChanged || nameChanged
    
    const isSimpleUpdate = !patch.transform && !isCritical && (
      patch.visible !== undefined ||
      patch.castShadow !== undefined ||
      patch.receiveShadow !== undefined ||
      patch.frustumCulled !== undefined ||
      patch.renderOrder !== undefined ||
      patch.selectable !== undefined
    )
    
    return { typeChanged, helperChanged, meshChanged, lightTypeChanged, assetChanged, parentChanged, nameChanged, isCritical, isSimpleUpdate }
  }
  
  function _mergeObjectData(target: SceneObjectData, patch: Partial<SceneObjectData>) {
    const nextTransform = patch.transform ? { ...target.transform, ...patch.transform } : target.transform
    const nextData = { ...target, transform: nextTransform } as SceneObjectData
    
    for (const key of Object.keys(patch)) {
      (nextData as any)[key] = (patch as any)[key]
    }
    
    if ('parentId' in patch) {
      nextData.parentId = patch.parentId
    }
    
    return { nextData, nextTransform }
  }
  
  function _applySimpleProps(target: SceneObjectData, patch: Partial<SceneObjectData>) {
    if (patch.visible !== undefined) target.visible = patch.visible
    if (patch.castShadow !== undefined) target.castShadow = patch.castShadow
    if (patch.receiveShadow !== undefined) target.receiveShadow = patch.receiveShadow
    if (patch.frustumCulled !== undefined) target.frustumCulled = patch.frustumCulled
    if (patch.renderOrder !== undefined) target.renderOrder = patch.renderOrder
    if (patch.selectable !== undefined) target.selectable = patch.selectable
    if (patch.name !== undefined) target.name = patch.name
    if (patch.userData !== undefined) target.userData = { ...target.userData, ...patch.userData }
  }
  
  function _syncSimplePropsToThree(obj: Object3D, patch: Partial<SceneObjectData>) {
    if (patch.visible !== undefined) obj.visible = patch.visible
    if (patch.castShadow !== undefined) (obj as any).castShadow = patch.castShadow
    if (patch.receiveShadow !== undefined) (obj as any).receiveShadow = patch.receiveShadow
    if (patch.frustumCulled !== undefined) obj.frustumCulled = patch.frustumCulled
    if (patch.renderOrder !== undefined) obj.renderOrder = patch.renderOrder
  }

  function updateSceneObjectData(id: string, patch: Partial<SceneObjectData>, options?: { skipHistory?: boolean }) {
    const target = objectDataList.value.find(item => item.id === id)
    if (!target) return null

    const oldState = _saveOldState(target, patch)
    const changeType = _detectChangeType(target, patch, oldState.parentId)
    const { typeChanged, helperChanged, meshChanged, lightTypeChanged, assetChanged, parentChanged, isCritical, isSimpleUpdate } = changeType
    const { nextData, nextTransform } = _mergeObjectData(target, patch)
    
    let meshRebuilt = false
    if (typeChanged || helperChanged || lightTypeChanged) {
      const old = objectsMap.value.get(id)
      if (old?.parent) old.parent.remove(old)
      const newObj = createThreeObject(nextData, { objectsMap: objectsMap.value })
      objectsMap.value.set(id, newObj)
      meshRebuilt = true
    } else if (meshChanged) {
      const obj = objectsMap.value.get(id)
      if (obj && (obj as any).isMesh) {
        if (patch.mesh?.geometry) updateMeshGeometry(obj as any, patch.mesh.geometry)
        if (patch.mesh?.material) updateMeshMaterial(obj as any, patch.mesh.material)
      } else {
        const old = objectsMap.value.get(id)
        if (old?.parent) old.parent.remove(old)
        const newObj = createThreeObject(nextData, { objectsMap: objectsMap.value })
        objectsMap.value.set(id, newObj)
        meshRebuilt = true
      }
    }

    if (isSimpleUpdate) {
      _applySimpleProps(target, patch)
    } else if (!isCritical && patch.transform) {
      target.transform.position = nextTransform.position
      target.transform.rotation = nextTransform.rotation
      target.transform.scale = nextTransform.scale
      _applySimpleProps(target, patch)
    } else {
      const updatePatch: any = { transform: nextTransform }
      for (const key of Object.keys(patch)) {
        updatePatch[key] = (patch as any)[key]
      }
      Object.assign(target, updatePatch)
      if ('parentId' in patch) {
        target.parentId = patch.parentId
      }
    }

    const obj = objectsMap.value.get(id)
    if (obj) {
      if (isSimpleUpdate) {
        _syncSimplePropsToThree(obj, patch)
      } else if (!isCritical && patch.transform) {
        applyTransform(obj, nextData)
      } else {
        syncThreeObjectState(obj, nextData)
      }
    }

    if (parentChanged) {
      if (oldState.parentId !== undefined && oldState.parentId !== null) {
        removeChildFromParent(oldState.parentId, id)
      }
      if (patch.parentId !== undefined && patch.parentId !== null) {
        addChildToParent(patch.parentId, id)
      }
    }

    if (typeChanged || helperChanged || parentChanged || meshRebuilt) {
      if (isCritical) {
        attachThreeObject(nextData)
      } else {
        setTimeout(() => attachThreeObject(nextData), 0)
      }
    }

    if ((typeChanged || helperChanged || meshChanged || parentChanged) && selectedObjectId.value === id) {
      selectionStore.bumpSelectionVersion()
    }

    if (nextData.type === 'scene' && threeScene.value) {
      const fn = () => applySceneSettings(threeScene.value!, nextData)
      isCritical ? fn() : setTimeout(fn, 0)
    }
    if (nextData.type === 'camera') {
      const cameraObj = objectsMap.value.get(id)
      if (cameraObj && (cameraObj as any).isPerspectiveCamera) {
        const fn = () => applyCameraSettings(cameraObj as any, nextData)
        isCritical ? fn() : setTimeout(fn, 0)
      }
    }
    if (nextData.type === 'light') {
      const lightObj = objectsMap.value.get(id)
      if (lightObj) {
        const fn = () => applyLightSettings(lightObj as any, nextData)
        isCritical ? fn() : setTimeout(fn, 0)
      }
    }
    if (nextData.type === 'model' && (assetChanged || typeChanged) && nextData.assetId) {
      void loadModelAssetIntoObject(nextData.assetId, id)
    }

    if (!options?.skipHistory) {
      if (useCommandPattern.value) {
        const getStoreRef = () => useSceneStore()
        if (!isCritical && patch.transform) {
          const command = new UpdateTransformCommand(getStoreRef, id, nextTransform, oldState.transform)
          historyStore.pushCommand(command)
        } else {
          const command = new UpdateObjectCommand(getStoreRef, id, patch, oldState.data)
          historyStore.pushCommand(command)
        }
      } else {
        if (isCritical) {
          scheduleHistorySnapshot(true)
          nextTick(() => { historyStore.pendingCriticalOperation = false })
        }
      }
    }
    
    return target
  }

  function removeSceneObjectData(id: string, options?: { removeChildren?: boolean; skipHistory?: boolean }) {
    const removeChildren = options?.removeChildren ?? true
    
    let command: RemoveObjectCommand | null = null
    if (!options?.skipHistory && useCommandPattern.value) {
      const getStoreRef = () => useSceneStore()
      command = new RemoveObjectCommand(getStoreRef, id)
    }
    
    const idsToRemove = new Set<string>()

    const collect = (targetId: string) => {
      idsToRemove.add(targetId)
      if (!removeChildren) return
      objectDataList.value.forEach(item => {
        if (item.parentId === targetId) collect(item.id)
      })
    }

    collect(id)

    const target = objectDataList.value.find(item => item.id === id)
    if (target?.parentId) {
      removeChildFromParent(target.parentId, id)
    }

    if (!removeChildren) {
      objectDataList.value.forEach(item => {
        if (item.parentId === id) item.parentId = undefined
      })
    }

    idsToRemove.forEach(removeId => {
      const obj = objectsMap.value.get(removeId)
      if (obj?.parent) {
        obj.parent.remove(obj)
      }
      objectsMap.value.delete(removeId)
    })

    objectDataList.value = objectDataList.value.filter(item => !idsToRemove.has(item.id))

    if (selectedObjectId.value && idsToRemove.has(selectedObjectId.value)) {
      selectionStore.selectedObjectId = null
    }

    if (!options?.skipHistory) {
      if (useCommandPattern.value && command) {
        historyStore.pushCommand(command)
      } else if (!useCommandPattern.value) {
        scheduleHistorySnapshot(true)
        nextTick(() => {
          historyStore.pendingCriticalOperation = false
        })
      }
    }
  }

  // ==================== 场景清理和保存 ====================
  
  function clearScene() {
    renderer.value?.setAnimationLoop(null as any)
    objectsMap.value.clear()
    objectDataList.value = []
    selectionStore.selectedObjectId = null
    threeScene.value?.clear()
    threeScene.value = null
  }

  function syncMainCameraPosition() {
    const cameraData = objectDataList.value.find(item => item.type === 'camera')
    if (!cameraData) return
    
    const cameraObj = objectsMap.value.get(cameraData.id)
    if (!cameraObj) return
    
    const position: [number, number, number] = [
      cameraObj.position.x,
      cameraObj.position.y,
      cameraObj.position.z
    ]
    const rotation: [number, number, number] = [
      cameraObj.rotation.x,
      cameraObj.rotation.y,
      cameraObj.rotation.z
    ]
    
    cameraData.transform = {
      ...cameraData.transform,
      position,
      rotation
    }
    
    if (!cameraData.camera) {
      cameraData.camera = {}
    }
    cameraData.camera.target = [...cameraControlsTarget.value] as [number, number, number]
    
    console.log('[syncMainCameraPosition] 已同步主摄像机位置:', position, '目标点:', cameraControlsTarget.value)
  }

  async function saveScene(sceneId?: number) {
    const targetId = sceneId ?? currentSceneId.value
    if (!targetId) {
      notification.value?.error({
        content: '无法保存：场景ID不存在',
        duration: 2500
      })
      return
    }

    const saveStartTime = performance.now()
    console.log('[saveScene] 开始保存场景...')

    syncMainCameraPosition()

    const { sceneApi } = await import('@/services/sceneApi')
    try {
      const { useAnimationStore } = await import('./useAnimation.store')
      const animationStore = useAnimationStore()
      const animationData = animationStore.getAnimationData()
      
      const apiStartTime = performance.now()
      await sceneApi.saveScene(targetId, {
        name: name.value,
        aIds: aIds.value,
        version: version.value,
        objectDataList: objectDataList.value,
        assets: assetStore.assets,
        rendererSettings: rendererSettings.value,
        animationData: animationData,
        thumbnail: undefined
      })
      const apiEndTime = performance.now()
      console.log(`[saveScene] sceneApi.saveScene 耗时: ${(apiEndTime - apiStartTime).toFixed(0)}ms`)
      
      animationStore.markSaved()
      
      const totalTime = performance.now() - saveStartTime
      console.log(`[saveScene] ✅ 保存完成，总耗时: ${totalTime.toFixed(0)}ms`)
      
      notification.value!!.success({
        content: '保存成功！',
        duration: 2500,
        keepAliveOnHover: true
      })
      
      // 后台异步上传截图
      void (async () => {
        const screenshotStartTime = performance.now()
        try {
          if (!captureScreenshotFn.value) {
            console.warn('截图函数未初始化，跳过截图')
            return
          }
          
          const { assetApi } = await import('@/services/assetApi')
          if (!assetApi.isStorageAvailable()) {
            console.warn('云存储未配置，跳过截图上传')
            return
          }
          
          const screenshotBlob = await captureScreenshotFn.value(800, 600)
          const captureTime = performance.now() - screenshotStartTime
          console.log(`[saveScene] 截图生成耗时: ${captureTime.toFixed(0)}ms`)
          
          const screenshotFile = new File([screenshotBlob], `scene-${targetId}-thumbnail.png`, { type: screenshotBlob.type })
          
          const uploadStartTime = performance.now()
          const result = await uploadAsset(screenshotFile, 'image')
          const uploadTime = performance.now() - uploadStartTime
          console.log(`[saveScene] 截图上传耗时: ${uploadTime.toFixed(0)}ms`)
          
          await sceneApi.updateThumbnail(targetId, result.uri)
          
          const totalScreenshotTime = performance.now() - screenshotStartTime
          console.log(`[saveScene] ✅ 截图后台处理完成，总耗时: ${totalScreenshotTime.toFixed(0)}ms`)
        } catch (error: any) {
          console.warn('后台上传截图失败:', error)
        }
      })()
    } catch (error: any) {
      console.error('保存场景失败:', error)
      notification.value?.error({
        content: `保存失败: ${error.message || '未知错误'}`,
        duration: 2500
      })
    }
  }

  // ==================== 返回 ====================
  
  return {
    // 场景初始化和管理
    initScene,
    name,
    version,
    aIds,
    currentSceneId,
    objectsMap,
    objectDataList,
    setThreeScene,
    threeScene,
    renderer,
    rendererSettings,
    clearScene,
    saveScene,
    
    // 对象 CRUD
    addSceneObjectData,
    updateSceneObjectData,
    removeSceneObjectData,
    importModelFile,
    
    // 场景树
    getObjectTree,
    applyObjectTree,
    
    // 选择状态（代理）
    selectedObjectId,
    selectionVersion,
    selectedObjectData,
    
    // 变换控制（代理）
    transformMode,
    transformSpace,
    transformSnap,
    isEditMode,
    
    // 资产管理（代理）
    assets,
    assetFiles,
    registerLocalAsset,
    registerRemoteAsset,
    uploadAsset,
    getAssetById,
    resolveAssetUri,
    
    // 历史管理（代理）
    undo,
    redo,
    canUndo,
    canRedo,
    historyManager,
    useCommandPattern,
    historyVersion,
    undoStack,
    redoStack,
    snapshotKeyMode,
    snapshotKeyList,
    setSnapshotKeyMode,
    setSnapshotKeyList,
    isSceneReady,
    
    // UI 提供者
    notification,
    dialogProvider,
    
    // 截图和相机
    captureScreenshotFn,
    setCaptureScreenshotFn,
    cameraControlsTarget,
    setCameraControlsTarget
  }
})
