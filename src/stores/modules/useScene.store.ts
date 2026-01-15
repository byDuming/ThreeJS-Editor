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
    rendererType: 'webgpu',
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
   * 上传资产到云端存储
   * @param file 文件对象
   * @param type 资产类型
   * @param sceneId 场景ID（可选，用于组织文件路径）
   * @returns 上传后的资产引用
   */
  async function uploadAsset(file: File, type: AssetRef['type'], sceneId?: number): Promise<AssetRef> {
    if (!assetApi.isStorageAvailable()) {
      throw new Error('Supabase Storage 未配置，无法上传资产')
    }

    const result = await assetApi.uploadAsset({ file, type, sceneId })
    const asset = registerRemoteAsset(result.asset)
    return asset
  }

  async function resolveAssetUri(asset: AssetRef) {
    if (asset.uri.startsWith('local://')) {
      const file = assetFiles.value.get(asset.id)
      if (!file) return null
      const url = URL.createObjectURL(file)
      return { url, revoke: () => URL.revokeObjectURL(url) }
    }
    return { url: asset.uri }
  }

  async function loadModelAssetIntoObject(assetId: string, objectId: string) {
    const asset = getAssetById(assetId)
    if (!asset) return
    const target = objectsMap.value.get(objectId)
    if (!target) return
    const resolved = await resolveAssetUri(asset)
    if (!resolved) {
      console.warn('Model asset is missing local file:', asset.name)
      return
    }
    const loader = new GLTFLoader()
    try {
      const gltf = await loader.loadAsync(resolved.url)
      target.children.slice().forEach(child => target.remove(child))
      if (gltf.scene) target.add(gltf.scene)
    } finally {
      resolved.revoke?.()
    }
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
  const undoStack = ref<SceneSnapshot[]>([]) // 撤回栈：保存历史快照
  const redoStack = ref<SceneSnapshot[]>([]) // 回退栈：保存已撤回的快照
  const isRestoring = ref(false) // 快照恢复中，防止递归记录
  const maxHistory = 50 // 最多保留的快照数量
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
    const snapshot = undoStack.value.pop()
    if (!snapshot) return
    // 撤回前先把当前状态塞到回退栈
    redoStack.value.push(createSnapshot())
    applySnapshot(snapshot)
  }

  /** 回退到下一条快照。 */
  function redo() {
    const snapshot = redoStack.value.pop()
    if (!snapshot) return
    // 回退前先把当前状态塞到撤回栈
    undoStack.value.push(createSnapshot())
    applySnapshot(snapshot)
  }

  async function initScene() {
    const { sceneData } = await initDB() // 初始化数据库并获取场景数据
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

    // 数据准备好后，确保 three 场景和对象同步
    const scene = threeScene.value ?? new Scene()
    setThreeScene(scene)
    isRestoring.value = false

    undoStack.value = []
    redoStack.value = []
    lastSnapshot.value = createSnapshot()
    if (historyDebounceTimer.value) {
      clearTimeout(historyDebounceTimer.value)
      historyDebounceTimer.value = null
    }
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
  function applyObjectTree(tree: TreeOption[]) {
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
    objectDataList.value = nextList
    nextList.forEach(item => attachThreeObject(item))
  }

  function setThreeScene(scene: Scene | null) {
    threeScene.value = scene
    if (!scene) return

    // 确保每个数据节点都有对应的 three 对象并挂载
    const dataMap = new Map(objectDataList.value.map(item => [item.id, item]))

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
        void loadModelAssetIntoObject(data.assetId, data.id)
      }
    })

    objectsMap.value.forEach((obj, id) => {
      const data = dataMap.get(id)
      if (!data) return
      if (obj.parent) obj.parent.remove(obj)
      const parent = data.parentId ? objectsMap.value.get(data.parentId) : threeScene.value
      parent?.add(obj)
    })

    const sceneData = objectDataList.value.find(item => item.type === 'scene')
    if (sceneData && threeScene.value) {
      applySceneSettings(threeScene.value, sceneData)
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

    const parent = data.parentId && data.parentId !== 'Scene' ? objectsMap.value.get(data.parentId) : threeScene.value
    parent?.add(obj)
  }

  // ---------- 对象增删改查与 three 同步 ----------

  // 新增场景对象（含 three 层同步）
  function addSceneObjectData(input: SceneObjectInput, options?: { addToThree?: boolean }) {
    const id = input.id ?? `obj-${aIds.value++}`;
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
    }

    // 新增对象是关键操作，立即推入历史
    scheduleHistorySnapshot(true)
    // 清除关键操作标记（在下一个 tick，确保 watch 回调已执行）
    nextTick(() => {
      pendingCriticalOperation.value = false
    })
    return newObj;
  }

  // 更新场景对象（含 three 层同步）
  function updateSceneObjectData(id: string, patch: Partial<SceneObjectData>) {
    const target = objectDataList.value.find(item => item.id === id) // 找到要更新的原始数据
    if (!target) return null // 如果不存在直接返回

    const prevParentId = target.parentId // 记录旧父节点用于后续判断
    const nextTransform = patch.transform ? { ...target.transform, ...patch.transform } : target.transform // 合并transform
    const nextData: SceneObjectData = { ...target, ...patch, transform: nextTransform } // 组装最新的完整数据

    const typeChanged = patch.type !== undefined && patch.type !== target.type // 判断类型是否变化
    const helperChanged = patch.helper !== undefined && target.type === 'helper'
    const meshChanged = patch.mesh !== undefined && target.type === 'mesh'
    const lightTypeChanged =
      target.type === 'light'
      && patch.userData !== undefined
      && (patch.userData as any)?.lightType !== (target.userData as any)?.lightType
    const assetChanged = patch.assetId !== undefined && patch.assetId !== target.assetId
    const parentChanged = patch.parentId !== undefined && patch.parentId !== prevParentId
    
    // 判断是否为关键操作：类型变更、helper变更、光源类型变更、父节点变更、资产变更
    // 仅 transform 更新（拖拽）视为普通操作，走去抖
    const isCritical = typeChanged || helperChanged || lightTypeChanged || parentChanged || assetChanged || meshChanged
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
      Object.assign(target, { ...patch, transform: nextTransform })
    }

    const obj = objectsMap.value.get(id) // 获取对应three对象
    // 对于 transform 更新，同步执行 syncThreeObjectState（必须立即更新视觉）
    // 对于关键操作，也同步执行（确保状态一致）
    if (obj) {
      if (!isCritical && patch.transform) {
        // transform 更新：只同步 transform，其他操作延迟
        applyTransform(obj, nextData)
      } else {
        // 关键操作：完整同步
        syncThreeObjectState(obj, nextData)
      }
    }

    // 非关键操作延迟执行，避免阻塞主线程导致 INP 延迟
    if (parentChanged) { // 父节点变了需要更新关系和挂载
      if (prevParentId) removeChildFromParent(prevParentId, id) // 从旧父节点移除引用
      if (patch.parentId) addChildToParent(patch.parentId, id) // 添加到新父节点引用
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

    // 根据操作类型决定推入策略：
    // - 关键操作立即推入快照
    // - transform 更新（拖动）完全跳过快照创建，避免卡顿（用户通常不会撤销拖动操作）
    if (isCritical) {
      scheduleHistorySnapshot(true)
      // 清除标记（在下一个 tick，确保 watch 回调已执行）
      nextTick(() => {
        pendingCriticalOperation.value = false
      })
    }
    // transform 更新不创建快照，完全跳过
    return target // 返回更新后的数据
  }

  // 删除场景对象（默认递归删除子级，同时清理 three 层）
  function removeSceneObjectData(id: string, options?: { removeChildren?: boolean }) {
    const removeChildren = options?.removeChildren ?? true
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
      if (obj?.parent) obj.parent.remove(obj)
      objectsMap.value.delete(removeId)
    })

    objectDataList.value = objectDataList.value.filter(item => !idsToRemove.has(item.id))

    if (selectedObjectId.value && idsToRemove.has(selectedObjectId.value)) {
      selectedObjectId.value = null
    }

    // 删除对象是关键操作，立即推入历史
    scheduleHistorySnapshot(true)
    // 清除关键操作标记（在下一个 tick，确保 watch 回调已执行）
    nextTick(() => {
      pendingCriticalOperation.value = false
    })
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
      await sceneApi.saveScene(targetId, {
        name: name.value,
        aIds: aIds.value,
        version: version.value,
        objectDataList: objectDataList.value,
        assets: assets.value,
        rendererSettings: rendererSettings.value
      })
      
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

    notification,
    dialogProvider,
    undoStack,
    redoStack,
    snapshotKeyMode,
    snapshotKeyList,
    setSnapshotKeyMode,
    setSnapshotKeyList
  }
})
