  import type { SceneObjectData } from '@/interfaces/sceneInterface.ts'
  import { initDB } from '@/services/db'

  import { defineStore } from 'pinia'
  import { Object3D, Scene } from 'three'
  import type { WebGPURenderer } from 'three/webgpu'
  import type { WebGLRenderer } from 'three'
  import { computed, ref, shallowRef, h, type VNodeChild, toRaw, nextTick } from 'vue'
  import { createSceneObjectData, type SceneObjectInput } from '@/utils/sceneFactory.ts'
  import { applyCameraSettings, applyLightSettings, applySceneSettings, applyTransform, createThreeObject, syncThreeObjectState, updateMeshGeometry, updateMeshMaterial } from '@/utils/threeObjectFactory.ts'
  import { NIcon, type TreeOption } from 'naive-ui'
  import { Cube, LogoDropbox, CubeOutline, Camera } from '@vicons/ionicons5'
  import { LightbulbFilled, MovieCreationFilled } from '@vicons/material'
  import { Cubes } from '@vicons/fa'
  import type { NotificationApiInjection } from 'naive-ui/es/notification/src/NotificationProvider'
  import type { DialogApiInjection } from 'naive-ui/es/dialog/src/DialogProvider'
  import type { AssetRef } from '@/types/asset'
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
  import { assetApi } from '@/services/assetApi'
  import { HistoryManager, AddObjectCommand, RemoveObjectCommand, UpdateTransformCommand, UpdateObjectCommand, UndoGroup } from '@/utils/commandPattern'

  /**
   * 场景编辑核心 Store：
   * - 维护逻辑层数据结构（objectDataList）
   * - 映射 three Object3D（objectsMap + threeScene）
   * - 维护撤销/重做历史（undoStack / redoStack）
   * - 负责资产引用与渲染配置（assets / rendererSettings）
   *
   * ⚠️ 当前仍是一个“大一统” Store，后续可以考虑拆分为：
   * - useSceneCoreStore：只管 objectDataList / selection / transform
   * - useSceneHistory 或 composable：只管快照、undo/redo
   * - useSceneAssetStore：只管资产、模型加载
   */
export const useSceneStore = defineStore('scene', () => {
  const name = ref('sceneStore') // store 名称
  const version = ref(1) // store 版本
  const aIds = ref(1) // 场景内对象自增ID
  const currentSceneId = ref<number | null>(null) // 当前场景ID

  
  const notification = ref<NotificationApiInjection>();
  const dialogProvider = ref<DialogApiInjection>();


  // Threejs 对象映射（扁平化，快速查找）
  const objectsMap = shallowRef(new Map<string, Object3D>());
  // 引擎逻辑层级（独立维护）
  const objectDataList = ref<SceneObjectData[]>([]);
  // 当前选中对象ID
  const selectedObjectId = ref<string | null>(null);
  const selectionVersion = ref(0);
  // Three 渲染器引用（WebGPU 或 WebGL）
  const renderer = shallowRef<WebGPURenderer | WebGLRenderer | null>(null);
  const threeScene = shallowRef<Scene | null>(null);
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
  const assets = ref<AssetRef[]>([])
  const assetFiles = shallowRef(new Map<string, File>())
  
  // 资产加载状态跟踪（用于确保动画在资产加载完成后才播放）
  const loadingAssets = ref(new Set<string>()) // 正在加载的资产ID集合
  const loadedAssets = ref(new Set<string>()) // 已加载完成的资产ID集合
  const assetLoadPromises = shallowRef(new Map<string, Promise<void>>()) // 资产加载Promise映射
  const loadedAssetScenes = shallowRef(new Map<string, any>()) // 已加载的资产场景缓存（用于克隆）
  
  // 截图函数引用（由 useRenderer 设置）
  const captureScreenshotFn = shallowRef<((width?: number, height?: number) => Promise<Blob>) | null>(null)
  
  // 设置截图函数
  function setCaptureScreenshotFn(fn: ((width?: number, height?: number) => Promise<Blob>) | null) {
    captureScreenshotFn.value = fn
  }

  // 当前选中对象数据（直接从 objectDataList 查找，避免额外的 watch 和 Map 构建导致卡顿）
  const selectedObjectData = computed(() => {
    const id = selectedObjectId.value
    if (!id) return null
    // 直接查找，对于大多数场景，数组不会太大，find 操作很快
    return objectDataList.value.find(item => item.id === id) || null
  })

  const currentObjectData = computed(() => {
    const id = selectedObjectId.value
    if (!id) return null
    // 直接查找，避免额外的 watch 和 Map 构建导致卡顿
    return objectDataList.value.find(item => item.id === id) || null
  })
  
  const transformMode = ref<'translate' | 'rotate' | 'scale'>('translate');
  const transformSpace = ref<'world' | 'local'>('world');
  
  // 变换控制器步幅（snap）
  const transformSnap = ref({
    enabled: false,   // 是否启用步幅
    translation: 0,   // 位移步幅（单位：米）
    translationEnabled: false, // 位移步幅是否启用
    rotation: 0,      // 旋转步幅（单位：弧度）
    rotationEnabled: false,    // 旋转步幅是否启用
    scale: 0,         // 缩放步幅（单位：倍数）
    scaleEnabled: false        // 缩放步幅是否启用
  });
  
  // 场景是否加载完成（用于控制撤销/重做按钮的可用状态）
  const isSceneReady = ref(false);
  
  // 是否为编辑模式（预览模式下禁用 TransformControls 等编辑功能）
  const isEditMode = ref(true);

  function getAssetById(id: string) {
    return assets.value.find(asset => asset.id === id) ?? null
  }

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

  async function resolveAssetUri(asset: AssetRef): Promise<{ url: string; revoke?: () => void } | null> {
    if (asset.uri.startsWith('local://')) {
      const file = assetFiles.value.get(asset.id)
      if (!file) return null
      const url = URL.createObjectURL(file)
      return { url, revoke: () => URL.revokeObjectURL(url) }
    }
    return { url: asset.uri }
  }

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
    
    // 如果资产已经在加载中，等待加载完成
    const existingPromise = assetLoadPromises.value.get(assetId)
    if (existingPromise) {
      await existingPromise
      // 加载完成后，从缓存中克隆模型到目标对象
      const cachedScene = loadedAssetScenes.value.get(assetId)
      if (cachedScene) {
        target.children.slice().forEach(child => target.remove(child))
        // 克隆场景（使用 clone 方法）
        const clonedScene = cachedScene.clone(true)
        target.add(clonedScene)
      }
      return
    }
    
    // 如果资产已经加载完成，从缓存中克隆
    if (loadedAssets.value.has(assetId)) {
      const cachedScene = loadedAssetScenes.value.get(assetId)
      if (cachedScene) {
        target.children.slice().forEach(child => target.remove(child))
        const clonedScene = cachedScene.clone(true)
        target.add(clonedScene)
      }
      return
    }
    
    // 创建加载Promise
    const loadPromise = (async () => {
      loadingAssets.value.add(assetId)
      let resolved: { url: string; revoke?: () => void } | null = null
      try {
        resolved = await resolveAssetUri(asset)
        if (!resolved) {
          console.warn('Model asset is missing local file:', asset.name)
          return
        }
        const loader = new GLTFLoader()
        const gltf = await loader.loadAsync(resolved.url)
        
        // 保存原始场景到缓存（用于后续克隆）
        if (gltf.scene) {
          // 先保存原始场景到缓存
          loadedAssetScenes.value.set(assetId, gltf.scene)
          // 为第一个对象添加克隆的场景（保持原始场景在缓存中）
          target.children.slice().forEach(child => target.remove(child))
          const clonedScene = gltf.scene.clone(true)
          target.add(clonedScene)
        }
        
        loadedAssets.value.add(assetId)
        console.log(`[loadModelAssetIntoObject] 资产加载完成: ${asset.name} (${assetId})`)
      } catch (error) {
        console.error(`[loadModelAssetIntoObject] 加载资产失败: ${asset.name} (${assetId})`, error)
        throw error
      } finally {
        loadingAssets.value.delete(assetId)
        resolved?.revoke?.()
      }
    })()
    
    // 保存Promise以便其他对象可以等待同一个资产的加载
    assetLoadPromises.value.set(assetId, loadPromise)
    
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

  type SceneSnapshot = {
    objectDataList: SceneObjectData[]
    selectedObjectId: string | null
    aIds: number
  }

  // ---------- 撤销 / 重做历史快照 ----------
  // 新的命令模式历史管理器（推荐使用）
  const historyManager = new HistoryManager()
  // 响应式版本号，用于触发 UI 更新（当历史栈变化时更新）
  const historyVersion = ref(0)
  // 旧的快照机制（保留作为后备，向后兼容）
  const undoStack = ref<SceneSnapshot[]>([]) // 撤回栈：保存历史快照
  const redoStack = ref<SceneSnapshot[]>([]) // 回退栈：保存已撤回的快照
  const isRestoring = ref(false) // 快照恢复中，防止递归记录
  const maxHistory = 50 // 最多保留的快照数量
  const useCommandPattern = ref(true) // 是否使用命令模式（默认开启）
  
  // 计算属性：是否可以撤销/重做（响应式）
  // 注意：依赖 historyVersion 来触发响应式更新
  // 场景未加载完成时，不响应撤销/重做
  const canUndo = computed(() => {
    // 场景未准备好时，不允许撤销
    if (!isSceneReady.value) return false
    // 读取 historyVersion 以建立响应式依赖
    void historyVersion.value
    if (useCommandPattern.value) {
      return historyManager.canUndo()
    } else {
      return undoStack.value.length > 0
    }
  })
  
  const canRedo = computed(() => {
    // 场景未准备好时，不允许重做
    if (!isSceneReady.value) return false
    // 读取 historyVersion 以建立响应式依赖
    void historyVersion.value
    if (useCommandPattern.value) {
      return historyManager.canRedo()
    } else {
      return redoStack.value.length > 0
    }
  })
  // 注意：historyDebounceMs 和 historyDebounceTimer 已不再使用（transform 更新已跳过快照创建）
  // 但保留 historyDebounceTimer 用于清理，避免内存泄漏
  const historyDebounceTimer = ref<ReturnType<typeof setTimeout> | null>(null) // 去抖计时器（用于清理）
  const lastSnapshot = shallowRef<SceneSnapshot | null>(null) // 上一次用于入栈的快照
  const pendingCriticalOperation = ref(false) // 标记是否有待处理的关键操作（增删、类型变更等）
  const snapshotKeyMode = ref<'blacklist' | 'whitelist'>('blacklist')
  const snapshotKeyList = ref<string[]>([
    'file',
    'files',
    'image',
    'images',
    'texture',
    'textures',
    '__threeObject'
  ])

  function setSnapshotKeyMode(mode: 'blacklist' | 'whitelist') {
    snapshotKeyMode.value = mode
  }

  function setSnapshotKeyList(keys: string[]) {
    snapshotKeyList.value = Array.from(new Set(keys))
  }

  /** 深拷贝并过滤不可序列化对象，保证快照稳定可用。 */
  function cloneSnapshot(value: SceneSnapshot): SceneSnapshot {
    const raw = toRaw(value)
    const seen = new WeakSet<object>()
    const json = JSON.stringify(raw, (key, val) => {
      if (key) {
        const keyList = snapshotKeyList.value
        // 白名单/黑名单：过滤掉不希望进入快照的字段
        if (snapshotKeyMode.value === 'blacklist' && keyList.includes(key)) return undefined
        if (snapshotKeyMode.value === 'whitelist' && !keyList.includes(key)) return undefined
      }
      // 过滤不可序列化对象，避免快照崩溃
      if (typeof val === 'function' || typeof val === 'symbol') return undefined
      if (typeof File !== 'undefined' && val instanceof File) return undefined
      if (typeof Blob !== 'undefined' && val instanceof Blob) return undefined
      if (typeof ImageBitmap !== 'undefined' && val instanceof ImageBitmap) return undefined
      if (typeof window !== 'undefined') {
        if (val === window) return undefined
        if (typeof Window !== 'undefined' && val instanceof Window) return undefined
      }
      if (val && typeof val === 'object') {
        // 跳过循环引用，保证 JSON 序列化稳定
        if (seen.has(val)) return undefined
        seen.add(val)
      }
      return val
    })
    return JSON.parse(json) as SceneSnapshot
  }

  /** 生成撤回/回退所需的最小快照。 */
  function createSnapshot(): SceneSnapshot {
    return cloneSnapshot({
      objectDataList: toRaw(objectDataList.value),
      selectedObjectId: selectedObjectId.value,
      aIds: aIds.value
    })
  }

  /** 推入历史栈，并清空回退栈，保持线性时间线。 */
  function pushHistorySnapshot(snapshot?: SceneSnapshot) {
    if (isRestoring.value) return
    undoStack.value.push(snapshot ? cloneSnapshot(snapshot) : createSnapshot())
    if (undoStack.value.length > maxHistory) {
      undoStack.value.shift()
    }
    redoStack.value = []
  }

  /**
   * 智能推入历史快照：
   * - 关键操作（增删、类型变更）立即推入快照
   * - transform 更新（拖动）完全跳过快照创建，避免卡顿（JSON.stringify/parse 对大量数据很耗时）
   */
  function scheduleHistorySnapshot(isCritical = false) {
    if (isRestoring.value) return
    
    // 关键操作立即推入，不走去抖
    if (isCritical) {
      // 标记关键操作，让 watch 回调知道这是关键操作（避免重复推入）
      // 注意：由于 watch 的 flush 是 'sync'，会在数据变更后立即执行，
      // 所以标记需要在推入前设置，并在下一个 tick 清除
      pendingCriticalOperation.value = true
      // 如果有待处理的去抖，先取消它并推入当前状态
      if (historyDebounceTimer.value) {
        clearTimeout(historyDebounceTimer.value)
        historyDebounceTimer.value = null
      }
      pushHistorySnapshot()
      lastSnapshot.value = createSnapshot()
      // 在下一个 tick 清除标记，确保 watch 回调能检测到
      // 使用 nextTick 确保 watch 回调先执行
      return
    }
    
    // 普通操作（transform 更新）不再创建快照，完全跳过
    // 这样可以避免拖动时的卡顿（JSON.stringify/parse 对大量数据很耗时）
    // 用户通常不会撤销拖动操作，所以跳过快照是合理的
  }

  /** 恢复快照并基于数据重建 three 对象映射。 */
  function applySnapshot(snapshot: SceneSnapshot) {
    isRestoring.value = true
    objectDataList.value = cloneSnapshot(snapshot).objectDataList
    selectedObjectId.value = snapshot.selectedObjectId
    aIds.value = snapshot.aIds

    objectsMap.value.forEach(obj => {
      if (obj.parent) obj.parent.remove(obj)
    })
    objectsMap.value.clear()
    if (threeScene.value) {
      // 按数据重新构建 three 对象
      setThreeScene(threeScene.value)
    }
    selectionVersion.value += 1
    isRestoring.value = false
    if (historyDebounceTimer.value) {
      clearTimeout(historyDebounceTimer.value)
      historyDebounceTimer.value = null
    }
    // 让快照起点与当前状态对齐，避免连续撤回不一致
    lastSnapshot.value = createSnapshot()
  }

  /** 撤回到上一条快照。 */
  function undo() {
    // 使用 canUndo 判断（已包含 isSceneReady 和历史栈检查）
    if (!canUndo.value) return
    
    if (useCommandPattern.value) {
      // 使用命令模式
      const success = historyManager.undo()
      if (success) {
        // 更新版本号，触发响应式更新
        historyVersion.value++
      }
    } else {
      // 使用旧的快照机制（向后兼容）
      const snapshot = undoStack.value.pop()
      if (!snapshot) return
      // 撤回前先把当前状态塞到回退栈
      redoStack.value.push(createSnapshot())
      applySnapshot(snapshot)
    }
  }

  /** 回退到下一条快照。 */
  function redo() {
    // 使用 canRedo 判断（已包含 isSceneReady 和历史栈检查）
    if (!canRedo.value) return
    
    if (useCommandPattern.value) {
      // 使用命令模式
      const success = historyManager.redo()
      if (success) {
        // 更新版本号，触发响应式更新
        historyVersion.value++
      }
    } else {
      // 使用旧的快照机制（向后兼容）
      const snapshot = redoStack.value.pop()
      if (!snapshot) return
      // 回退前先把当前状态塞到撤回栈
      undoStack.value.push(createSnapshot())
      applySnapshot(snapshot)
    }
  }

  async function initScene() {
    // 场景开始加载，标记为未准备好
    isSceneReady.value = false
    
    const { sceneData } = await initDB() // 初始化数据库并获取场景数据
    currentSceneId.value = sceneData.id ?? null // 设置当前场景ID
    name.value = sceneData.name // store 名称
    version.value = sceneData.version // store 版本
    aIds.value = sceneData.aIds // 场景内对象自增ID
    rendererSettings.value = {
      ...rendererSettings.value,
      ...(sceneData.rendererSettings ?? {})
    }
    assets.value = (sceneData.assets ?? []) as AssetRef[]
    isRestoring.value = true
    objectDataList.value = sceneData.objectDataList ?? [] // 引擎逻辑层级

    // 加载动画数据
    if (sceneData.animationData) {
      const { useAnimationStore } = await import('./useAnimation.store')
      const animationStore = useAnimationStore()
      animationStore.setAnimationData(sceneData.animationData)
      console.log('[Scene] 已加载动画数据，剪辑数:', sceneData.animationData.clips?.length ?? 0)
    }

    // 数据准备好后，确保 three 场景和对象同步
    const scene = threeScene.value ?? new Scene()
    setThreeScene(scene)
    isRestoring.value = false

    // 清空历史栈（新的命令模式和旧的快照模式都清空）
    historyManager.clear()
    historyVersion.value++
    undoStack.value = []
    redoStack.value = []
    lastSnapshot.value = createSnapshot()
    if (historyDebounceTimer.value) {
      clearTimeout(historyDebounceTimer.value)
      historyDebounceTimer.value = null
    }
    
    // 场景加载完成，标记为准备好
    isSceneReady.value = true
  }

  // 获取树形结构（用于层级面板），返回 TreeOption[]
  function getObjectTree(): TreeOption[] {
    const tree: TreeOption[] = []
    const map = new Map<string, TreeOption & { raw: SceneObjectData; children: TreeOption[] }>()

    // 先创建所有节点的增强版本
    objectDataList.value.forEach(data => {
      // 自定义icon
      let prefix:() => VNodeChild = () => h(Cube);
      if(data.type === 'mesh'){
        prefix = () => h(Cube)
      } else if(data.type === 'group'){ 
        prefix = () => h(LogoDropbox)
      } else if(data.type === 'helper'){
        prefix = () => h(CubeOutline)
      } else if(data.type === 'light'){
        prefix = () => h(LightbulbFilled)
      } else if(data.type === 'camera'){
        prefix = () => h(Camera)
      } else if(data.type === 'model'){
        prefix = () => h(Cubes)
      }else if(data.type === 'scene'){
        prefix = () => h(MovieCreationFilled)
      }

      map.set(data.id, {
        key: data.id,
        label: data.name ?? data.id,
        raw: data,
        children: [],
        prefix: () => h(NIcon, null, {
          default: prefix
        })
      })

    })

    // 构建树
    objectDataList.value.forEach(data => {
      const node = map.get(data.id)!

      if (data.parentId === null || data.parentId === undefined) {
        tree.push(node)
      } else {
        const parent = map.get(data.parentId)
        if (parent) {
          parent.children.push(node)
        } else {
          tree.push(node) // 没找到父节点则挂到根
        }
      }
    })

    // 清理空 children，符合 TreeOption 结构
    // map.forEach(node => {
    //   if (!node.children.length) {
    //     delete (node as any).children
    //   }
    // })

    return tree
  }

  /**
   * 将层级面板的树形数据反写到 store，保持 objectDataList/three 场景同步
   */
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
    
    // 检测 parentId 变化并记录历史（在更新数据之前）
    // 只记录被移动对象的 parentId 变化，不记录父节点的 childrenIds 变化
    // （updateSceneObjectData 会自动处理父节点的 childrenIds 更新）
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
    
    // 如果有 parentId 变化且需要记录历史
    if (parentIdChanges.length > 0 && !options?.skipHistory && useCommandPattern.value) {
      const getStoreRef = () => useSceneStore()
      const group = new UndoGroup('调整层级结构')
      
      parentIdChanges.forEach(change => {
        // 只记录 parentId 的变化
        const prevData: Partial<SceneObjectData> = { parentId: change.prevParentId }
        const newData: Partial<SceneObjectData> = { parentId: change.newParentId }
        
        const command = new UpdateObjectCommand(getStoreRef, change.id, newData, prevData)
        group.addCommand(command)
      })
      
      if (!group.isEmpty()) {
        historyManager.pushCommand(group)
        historyVersion.value++
      }
    }
    
    // 应用变化
    objectDataList.value = nextList
    nextList.forEach(item => attachThreeObject(item))
  }

  async function setThreeScene(scene: Scene | null): Promise<void> {
    threeScene.value = scene
    if (!scene) return

    // 清空之前的加载状态（新场景切换时）
    loadingAssets.value.clear()
    loadedAssets.value.clear()
    assetLoadPromises.value.clear()
    loadedAssetScenes.value.clear()

    // 确保每个数据节点都有对应的 three 对象并挂载
    const dataMap = new Map(objectDataList.value.map(item => [item.id, item]))

    // 收集所有需要加载的模型资产
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
        // 收集模型加载Promise
        const loadPromise = loadModelAssetIntoObject(data.assetId, data.id)
        modelLoadPromises.push(loadPromise)
      }
    })

    objectsMap.value.forEach((obj, id) => {
      const data = dataMap.get(id)
      if (!data) return
      if (obj.parent) obj.parent.remove(obj)
      // 处理 parentId：undefined/null/'Scene' 都表示挂载到场景根节点
      const parent = (data.parentId !== undefined && data.parentId !== null && data.parentId !== 'Scene')
        ? objectsMap.value.get(data.parentId)
        : threeScene.value
      parent?.add(obj)
    })

    const sceneData = objectDataList.value.find(item => item.type === 'scene')
    if (sceneData && threeScene.value) {
      applySceneSettings(threeScene.value, sceneData)
    }

    // 等待所有模型资产加载完成
    if (modelLoadPromises.length > 0) {
      console.log(`[setThreeScene] 等待 ${modelLoadPromises.length} 个模型资产加载完成...`)
      await Promise.allSettled(modelLoadPromises)
      console.log('[setThreeScene] 所有模型资产加载完成')
    }
  }


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

    // 处理 parentId：undefined/null 表示 Scene 根节点，其他值表示父对象
    // 注意：data.parentId 可能是 undefined（Scene 根节点）、null、或对象 ID
    const parent = (data.parentId !== undefined && data.parentId !== null && data.parentId !== 'Scene') 
      ? objectsMap.value.get(data.parentId) 
      : threeScene.value
    parent?.add(obj)
  }

  // ---------- 对象增删改查与 three 同步 ----------

  // 新增场景对象（含 three 层同步）
  function addSceneObjectData(input: SceneObjectInput, options?: { addToThree?: boolean; skipHistory?: boolean }) {
    const id = input.id ?? `obj-${aIds.value++}`;
    
    // 检查对象是否已存在（避免重复添加，但在命令执行时允许覆盖）
    const existing = objectDataList.value.find(item => item.id === id)
    if (existing && !options?.skipHistory) {
      // 只有在非命令执行时（正常添加）才跳过
      return existing
    }
    
    // 如果对象已存在且是命令执行（skipHistory=true），先删除旧对象
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
    
    const newObj = createSceneObjectData({ ...input, id });
    objectDataList.value.push(newObj);

    if (newObj.parentId) {
      addChildToParent(newObj.parentId, id);
    }

    const addToThree = options?.addToThree ?? true
    if (addToThree) {
      const obj3d = createThreeObject(newObj, { objectsMap: objectsMap.value });
      objectsMap.value.set(id, obj3d);
      attachThreeObject(newObj);// 挂载到 three 层
      
      // 如果是模型对象且有 assetId，加载模型资源
      if (newObj.type === 'model' && newObj.assetId) {
        void loadModelAssetIntoObject(newObj.assetId, id)
      }
    }

    // 推入历史记录
    if (!options?.skipHistory) {
      if (useCommandPattern.value) {
        // 使用命令模式
        const getStoreRef = () => useSceneStore()
        const clonedData = JSON.parse(JSON.stringify(newObj))
        const command = new AddObjectCommand(getStoreRef, clonedData)
        historyManager.pushCommand(command)
        // 更新版本号，触发响应式更新
        historyVersion.value++
      } else {
        // 使用旧的快照机制
        scheduleHistorySnapshot(true)
        nextTick(() => {
          pendingCriticalOperation.value = false
        })
      }
    }
    return newObj;
  }

  // 更新场景对象（含 three 层同步）
  function updateSceneObjectData(id: string, patch: Partial<SceneObjectData>, options?: { skipHistory?: boolean }) {
    const target = objectDataList.value.find(item => item.id === id) // 找到要更新的原始数据
    if (!target) return null // 如果不存在直接返回

    // 【重要】在更新之前保存旧状态，用于撤销命令
    const prevTransform = JSON.parse(JSON.stringify(target.transform))
    const prevParentId = target.parentId // 记录旧父节点用于后续判断
    // 保存 patch 中涉及的字段的初始值（用于 UpdateObjectCommand 撤销）
    // 注意：即使值是 undefined，也要保存（用于恢复 parentId: undefined 的情况）
    const prevData: Partial<SceneObjectData> = {}
    Object.keys(patch).forEach(key => {
      const k = key as keyof SceneObjectData
      // 使用 'in' 操作符检查属性是否存在，而不是检查值是否为 undefined
      if (k in target) {
        const value = (target as any)[k]
        // 对于对象和数组，使用深拷贝；对于 undefined，直接保存
        if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)) {
          ;(prevData as any)[k] = JSON.parse(JSON.stringify(value))
        } else {
          ;(prevData as any)[k] = value
        }
      }
    })
    
    const nextTransform = patch.transform ? { ...target.transform, ...patch.transform } : target.transform // 合并transform
    // 组装最新的完整数据，注意：展开运算符会忽略 undefined，所以需要显式处理
    const nextData = { ...target, transform: nextTransform } as SceneObjectData
    // 显式复制所有 patch 中的属性，包括 undefined
    // 使用 Object.defineProperty 或直接赋值来确保 undefined 值也被设置
    Object.keys(patch).forEach(key => {
      const value = (patch as any)[key]
      // 直接赋值，确保 undefined 值也被设置
      ;(nextData as any)[key] = value
    })
    // 特别处理 parentId，确保即使值是 undefined 也被正确设置
    if ('parentId' in patch) {
      nextData.parentId = patch.parentId
    }

    const typeChanged = patch.type !== undefined && patch.type !== target.type // 判断类型是否变化
    const helperChanged = patch.helper !== undefined && target.type === 'helper'
    const meshChanged = patch.mesh !== undefined && target.type === 'mesh'
    const lightTypeChanged =
      target.type === 'light'
      && patch.userData !== undefined
      && (patch.userData as any)?.lightType !== (target.userData as any)?.lightType
    const assetChanged = patch.assetId !== undefined && patch.assetId !== target.assetId
    // 检查 parentId 是否在 patch 中（包括 undefined，表示要清除 parentId）
    const parentChanged = 'parentId' in patch && patch.parentId !== prevParentId
    // 检查名称是否变更
    const nameChanged = patch.name !== undefined && patch.name !== target.name
    
    // 判断是否为关键操作：类型变更、helper变更、光源类型变更、父节点变更、资产变更、名称变更
    // 仅 transform 更新（拖拽）视为普通操作，走去抖
    const isCritical = typeChanged || helperChanged || lightTypeChanged || parentChanged || assetChanged || meshChanged || nameChanged
    let meshRebuilt = false
    if (typeChanged || helperChanged || lightTypeChanged) { // 类型或helper配置变更需要重建three对象
      const old = objectsMap.value.get(id) // 取出现有three对象
      if (old?.parent) old.parent.remove(old) // 从场景移除旧对象
      const newObj = createThreeObject(nextData, { objectsMap: objectsMap.value }) // 用最新数据创建新对象
      objectsMap.value.set(id, newObj) // 写回映射
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

    // 对于 transform 更新，直接修改 transform 属性，避免触发深度 watch（导致卡顿）
    // 关键操作使用 Object.assign 来确保所有属性都被正确更新
    if (!isCritical && patch.transform) {
      // transform 更新：直接修改 transform 属性，避免深度遍历
      target.transform.position = nextTransform.position
      target.transform.rotation = nextTransform.rotation
      target.transform.scale = nextTransform.scale
      // 其他 patch 的属性也需要更新
      if (patch.visible !== undefined) target.visible = patch.visible
      if (patch.castShadow !== undefined) target.castShadow = patch.castShadow
      if (patch.receiveShadow !== undefined) target.receiveShadow = patch.receiveShadow
      if (patch.frustumCulled !== undefined) target.frustumCulled = patch.frustumCulled
      if (patch.renderOrder !== undefined) target.renderOrder = patch.renderOrder
      if (patch.name !== undefined) target.name = patch.name
      if (patch.userData !== undefined) target.userData = { ...target.userData, ...patch.userData }
    } else {
      // 关键操作：使用 Object.assign 确保所有属性都被正确更新
      // 注意：展开运算符会忽略 undefined 值，所以需要显式处理
      const updatePatch: any = { transform: nextTransform }
      // 显式复制所有 patch 中的属性，包括 undefined
      Object.keys(patch).forEach(key => {
        updatePatch[key] = (patch as any)[key]
      })
      Object.assign(target, updatePatch)
      // 特别处理 parentId，确保即使值是 undefined 也被正确设置
      if ('parentId' in patch) {
        target.parentId = patch.parentId
      }
    }

    const obj = objectsMap.value.get(id) // 获取对应three对象
    // 对于 transform 更新，同步执行 syncThreeObjectState（必须立即更新视觉）
    // 对于关键操作，也同步执行（确保状态一致）
    if (obj) {
      if (!isCritical && patch.transform) {
        // transform 更新：只同步 transform，其他操作延迟
        console.log('transform 更新')
        console.log(nextData)
        console.log(id)
        console.log(patch.transform)
        console.log(prevTransform)
        applyTransform(obj, nextData)
      } else {
        // 关键操作：完整同步
        syncThreeObjectState(obj, nextData)
      }
    }

    // 非关键操作延迟执行，避免阻塞主线程导致 INP 延迟
    if (parentChanged) { // 父节点变了需要更新关系和挂载
      // 从旧父节点移除引用（prevParentId 可能是 undefined，表示之前是 Scene 根节点）
      if (prevParentId !== undefined && prevParentId !== null) {
        removeChildFromParent(prevParentId, id)
      }
      // 添加到新父节点引用（patch.parentId 可能是 undefined，表示要移到 Scene 根节点）
      if (patch.parentId !== undefined && patch.parentId !== null) {
        addChildToParent(patch.parentId, id)
      }
    }

    if (typeChanged || helperChanged || parentChanged || meshRebuilt) {
      // 关键操作立即执行，transform 更新延迟执行
      if (isCritical) {
        attachThreeObject(nextData)
      } else {
        setTimeout(() => attachThreeObject(nextData), 0)
      }
    }

    if ((typeChanged || helperChanged || meshChanged || parentChanged) && selectedObjectId.value === id) {
      selectionVersion.value += 1
    }

    // 场景/相机/光源设置延迟执行，避免阻塞
    if (nextData.type === 'scene' && threeScene.value) {
      if (isCritical) {
        applySceneSettings(threeScene.value, nextData)
      } else {
        setTimeout(() => applySceneSettings(threeScene.value!, nextData), 0)
      }
    }
    if (nextData.type === 'camera') {
      const obj = objectsMap.value.get(id)
      if (obj && (obj as any).isPerspectiveCamera) {
        if (isCritical) {
          applyCameraSettings(obj as any, nextData)
        } else {
          setTimeout(() => applyCameraSettings(obj as any, nextData), 0)
        }
      }
    }
    if (nextData.type === 'light') {
      const obj = objectsMap.value.get(id)
      if (obj) {
        if (isCritical) {
          applyLightSettings(obj as any, nextData)
        } else {
          setTimeout(() => applyLightSettings(obj as any, nextData), 0)
        }
      }
    }
    if (nextData.type === 'model' && (assetChanged || typeChanged) && nextData.assetId) {
      void loadModelAssetIntoObject(nextData.assetId, id)
    }

    // 推入历史记录
    if (!options?.skipHistory) {
      if (useCommandPattern.value) {
        // 使用命令模式
        const getStoreRef = () => useSceneStore()
        if (!isCritical && patch.transform) {
          // Transform 更新，使用可合并的命令
          // 传入 prevTransform（更新前保存的状态）以确保撤销正确
          const command = new UpdateTransformCommand(getStoreRef, id, nextTransform, prevTransform)
          historyManager.pushCommand(command)
          historyVersion.value++
        } else if (isCritical) {
          // 关键操作，使用普通更新命令
          // 传入 prevData（更新前保存的状态）以确保撤销正确
          const command = new UpdateObjectCommand(getStoreRef, id, patch, prevData)
          historyManager.pushCommand(command)
          historyVersion.value++
        }
        // transform 更新（非关键）在命令模式中也会记录，支持撤销
      } else {
        // 使用旧的快照机制
        // - 关键操作立即推入快照
        // - transform 更新（拖动）完全跳过快照创建，避免卡顿
        if (isCritical) {
          scheduleHistorySnapshot(true)
          // 清除标记（在下一个 tick，确保 watch 回调已执行）
          nextTick(() => {
            pendingCriticalOperation.value = false
          })
        }
        // transform 更新不创建快照，完全跳过
      }
    }
    return target // 返回更新后的数据
  }

  // 删除场景对象（默认递归删除子级，同时清理 three 层）
  function removeSceneObjectData(id: string, options?: { removeChildren?: boolean; skipHistory?: boolean }) {
    const removeChildren = options?.removeChildren ?? true
    
    // 【重要】先创建命令（在删除对象之前），保存对象数据用于撤销
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
      selectedObjectId.value = null
    }

    // 推入历史记录（命令已在删除前创建）
    if (!options?.skipHistory) {
      if (useCommandPattern.value && command) {
        // 使用命令模式
        historyManager.pushCommand(command)
        historyVersion.value++
      } else if (!useCommandPattern.value) {
        // 使用旧的快照机制
        scheduleHistorySnapshot(true)
        // 清除关键操作标记（在下一个 tick，确保 watch 回调已执行）
        nextTick(() => {
          pendingCriticalOperation.value = false
        })
      }
    }
  }

  // function disposeMaterial(material: any, disposedMaterials: Set<unknown>, disposedTextures: Set<unknown>) {
  //   if (!material || disposedMaterials.has(material)) return
  //   const textureKeys = [
  //     'map',
  //     'lightMap',
  //     'aoMap',
  //     'emissiveMap',
  //     'bumpMap',
  //     'normalMap',
  //     'displacementMap',
  //     'roughnessMap',
  //     'metalnessMap',
  //     'alphaMap',
  //     'envMap',
  //     'specularMap',
  //     'gradientMap',
  //     'matcap'
  //   ]
  //   textureKeys.forEach(key => {
  //     const texture = material[key]
  //     if (texture && typeof texture.dispose === 'function' && !disposedTextures.has(texture)) {
  //       texture.dispose()
  //       disposedTextures.add(texture)
  //     }
  //   })
  //   if (typeof material.dispose === 'function') {
  //     material.dispose()
  //   }
  //   disposedMaterials.add(material)
  // }

  // function disposeObject(obj: Object3D, seen: Set<Object3D>, disposedGeometries: Set<unknown>, disposedMaterials: Set<unknown>, disposedTextures: Set<unknown>) {
  //   if (seen.has(obj)) return
  //   seen.add(obj)

  //   obj.children.slice().forEach(child => disposeObject(child, seen, disposedGeometries, disposedMaterials, disposedTextures))

  //   const anyObj = obj as any
  //   if (anyObj.geometry && typeof anyObj.geometry.dispose === 'function' && !disposedGeometries.has(anyObj.geometry)) {
  //     anyObj.geometry.dispose()
  //     disposedGeometries.add(anyObj.geometry)
  //   }
  //   if (anyObj.material) {
  //     if (Array.isArray(anyObj.material)) {
  //       anyObj.material.forEach((mat: any) => disposeMaterial(mat, disposedMaterials, disposedTextures))
  //     } else {
  //       disposeMaterial(anyObj.material, disposedMaterials, disposedTextures)
  //     }
  //   }
  //   const disposeFn = (anyObj as any).dispose
  //   if (typeof disposeFn === 'function') {
  //     disposeFn.call(anyObj)
  //   }
  //   if (obj.parent) {
  //     obj.parent.remove(obj)
  //   }
  // }

  function clearScene() {
    // 停止当前渲染循环，但 renderer 的创建/销毁由 useRenderer 负责
    renderer.value?.setAnimationLoop(null as any)

    objectsMap.value.clear()
    objectDataList.value = []
    selectedObjectId.value = null

    threeScene.value?.clear()
    threeScene.value = null
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

    // 使用 sceneApi 保存，优先保存到云端
    const { sceneApi } = await import('@/services/sceneApi')
    try {
      // 尝试截取场景截图并上传
      let thumbnailUrl: string | undefined = undefined
      try {
        if (captureScreenshotFn.value) {
          // 使用 useRenderer 提供的截图函数（在渲染循环中截图，确保正确的摄像机和时机）
          const screenshotBlob = await captureScreenshotFn.value(800, 600)
          
          // 转换为 File 对象
          const { blobToFile } = await import('@/utils/screenshot')
          const screenshotFile = blobToFile(screenshotBlob, `scene-${targetId}-thumbnail.png`)
          
          // 上传到云存储（全局共享）
          const { assetApi } = await import('@/services/assetApi')
          if (assetApi.isStorageAvailable()) {
            const result = await uploadAsset(screenshotFile, 'image')
            thumbnailUrl = result.uri
            console.log('✅ 场景截图已上传:', thumbnailUrl)
          } else {
            console.warn('云存储未配置，跳过截图上传')
          }
        } else {
          console.warn('截图函数未初始化，跳过截图')
        }
      } catch (error: any) {
        // 截图失败不影响保存，只记录警告
        console.warn('截取场景截图失败:', error)
      }
      
      // 获取动画数据
      const { useAnimationStore } = await import('./useAnimation.store')
      const animationStore = useAnimationStore()
      const animationData = animationStore.getAnimationData()
      
      await sceneApi.saveScene(targetId, {
        name: name.value,
        aIds: aIds.value,
        version: version.value,
        objectDataList: objectDataList.value,
        assets: assets.value,
        rendererSettings: rendererSettings.value,
        animationData: animationData,
        thumbnail: thumbnailUrl
      })
      
      // 标记动画数据已保存
      animationStore.markSaved()
      
      notification.value!!.success({
        content: '保存成功！',
        duration: 2500,
        keepAliveOnHover: true
      })
    } catch (error: any) {
      console.error('保存场景失败:', error)
      notification.value?.error({
        content: `保存失败: ${error.message || '未知错误'}`,
        duration: 2500
      })
    }
  }

  /** 
   * 统一监听器：自动检测数据变化并推入历史。
   * 注意：关键操作（增删、类型变更）已在各自函数中立即推入（通过 scheduleHistorySnapshot(true)），
   * 这里主要作为兜底机制，处理一些直接修改 objectDataList 的情况。
   * 
   * 彻底优化：完全移除这个 watch，因为：
   * 1. 关键操作已经在各自函数中处理
   * 2. transform 更新已经跳过快照创建
   * 3. 其他直接修改 objectDataList 的情况很少见，如果需要撤销，应该在操作前手动调用 scheduleHistorySnapshot(true)
   * 4. 保留这个 watch 只会增加不必要的性能开销
   */
  // watch 已移除，避免不必要的性能开销

  return {
    initScene,
    name,
    version,
    aIds,
    currentSceneId,
    objectsMap,
    objectDataList,
    // 当前选中对象ID
    selectedObjectId,
    selectionVersion,
    selectedObjectData,
    currentObjectData,
    setThreeScene,
    addSceneObjectData,
    updateSceneObjectData,
    removeSceneObjectData,
    importModelFile,
    registerLocalAsset,
    registerRemoteAsset,
    uploadAsset,
    getAssetById,
    resolveAssetUri,
    undo,
    redo,
    // 撤销/重做状态（响应式）
    canUndo,
    canRedo,
    // 获取树形结构
    getObjectTree,
    applyObjectTree,

    threeScene,
    renderer,
    rendererSettings,
    assets,

    clearScene,
    saveScene,
    
    transformMode,
    transformSpace,
    transformSnap,

    notification,
    dialogProvider,
    undoStack,
    redoStack,
    snapshotKeyMode,
    snapshotKeyList,
    setSnapshotKeyMode,
    setSnapshotKeyList,
    
    // 命令模式相关
    historyManager,
    useCommandPattern,
    historyVersion,
    
    // 场景状态
    isSceneReady,
    isEditMode,
    
    // 截图函数引用（由 useRenderer 设置）
    captureScreenshotFn,
    setCaptureScreenshotFn
  }
})
