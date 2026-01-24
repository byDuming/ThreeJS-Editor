import { ref, shallowRef, onBeforeUnmount, watch } from 'vue'
import { Scene, PerspectiveCamera, Color, Clock, type ToneMapping, type ShadowMapType } from 'three'
import { WebGPURenderer } from 'three/webgpu'
import {
  WebGLRenderer,
  NoToneMapping,
  LinearToneMapping,
  ReinhardToneMapping,
  CineonToneMapping,
  ACESFilmicToneMapping,
  SRGBColorSpace,
  LinearSRGBColorSpace,
  BasicShadowMap,
  PCFShadowMap,
  PCFSoftShadowMap,
  VSMShadowMap
} from 'three'
import { Raycaster, Vector2, Box3, Vector3, Object3D } from 'three'
import { useSceneStore } from '@/stores/modules/useScene.store.ts'
import { MapControls } from 'three/addons/controls/MapControls.js'
import { TransformControls } from 'three/addons/controls/TransformControls.js'
import { useUiEditorStore } from '@/stores/modules/uiEditor.store.ts'
import { pluginManager } from '@/core'
import { useGlobalStats } from '@/composables/useStats'

/**
 * 渲染器与交互控制逻辑（纯三维层，不关心 UI）：
 * - 创建并管理 WebGPU/WebGL Renderer
 * - 维护相机、MapControls、TransformControls
 * - 负责射线选择、快捷键
 * - 提供统一的场景切换接口 switchScene()
 *
 * 设计原则：
 * - 场景切换时保留渲染器，只替换场景内容
 * - 所有初始化按正确顺序执行：场景 → 对象 → 相机 → 控制器 → 渲染
 */
export function useRenderer(opts: { antialias?: boolean } = {}) {
  const sceneStore = useSceneStore()
  const globalStats = useGlobalStats()
  const container = ref<HTMLElement | null>(null)
  const camera = shallowRef<PerspectiveCamera | null>(null)
  const controls = shallowRef<MapControls | null>(null)
  const transformControls = shallowRef<TransformControls | null>(null)
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let pointerDownPos: { x: number; y: number } | null = null
  let isDraggingTransform = false
  let pendingTransformUpdate: { id: string; transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } } | null = null
  let keyboardListenerAdded = false
  let isInitialized = false
  let resizeObserver: ResizeObserver | null = null
  const clock = new Clock()

  // ==================== 相机管理 ====================

  function findCameraFromStore(): PerspectiveCamera | null {
    for (const obj of sceneStore.objectsMap.values()) {
      if ((obj as any).userData?.sceneObjectType === 'camera' && obj instanceof PerspectiveCamera) {
        return obj
      }
    }
    return null
  }

  function ensureCamera(): PerspectiveCamera | null {
    // 1. 先从 objectsMap 中查找
    let cam = findCameraFromStore()
    if (cam) {
      camera.value = cam
      updateCameraAspect()
      return cam
    }

    // 2. 从 objectDataList 中查找
    const cameraData = sceneStore.objectDataList.find(item => item.type === 'camera')
    if (cameraData) {
      cam = sceneStore.objectsMap.get(cameraData.id) as PerspectiveCamera | undefined ?? null
      if (cam instanceof PerspectiveCamera) {
        camera.value = cam
        updateCameraAspect()
        return cam
      }
    }

    // 3. 创建默认相机
    const newCameraData = sceneStore.addSceneObjectData({
      type: 'camera',
      name: 'Main Camera',
      parentId: 'Scene',
      transform: { position: [25, 30, 20] }
    })
    cam = sceneStore.objectsMap.get(newCameraData.id) as PerspectiveCamera | undefined ?? null
    if (cam instanceof PerspectiveCamera) {
      camera.value = cam
      updateCameraAspect()
      return cam
    }
    return null
  }

  function updateCameraAspect() {
    if (!camera.value || !container.value) return
    const w = container.value.clientWidth || window.innerWidth
    const h = container.value.clientHeight || window.innerHeight
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
  }

  // ==================== 控制器管理 ====================

  function setupControls() {
    if (!camera.value || !container.value || !sceneStore.renderer) return

    // 清理旧的控制器
    if (controls.value) {
      controls.value.dispose()
      controls.value = null
    }
    if (transformControls.value) {
      const gizmo = transformControls.value.getHelper()
      sceneStore.threeScene?.remove(gizmo)
      transformControls.value.dispose()
      transformControls.value = null
    }

    // 创建 MapControls
    controls.value = new MapControls(camera.value, container.value)
    
    // 从保存的数据恢复目标点，如果没有则使用默认值
    const cameraData = sceneStore.objectDataList.find(item => item.type === 'camera')
    const savedTarget = cameraData?.camera?.target
    if (savedTarget) {
      controls.value.target.set(savedTarget[0], savedTarget[1], savedTarget[2])
      console.log('[setupControls] 从保存数据恢复相机目标点:', savedTarget)
    } else {
      controls.value.target.set(0, 0, 0)
    }
    
    // 监听 controls 变化，同步目标点到 store（用于保存）
    controls.value.addEventListener('change', () => {
      if (controls.value) {
        sceneStore.setCameraControlsTarget([
          controls.value.target.x,
          controls.value.target.y,
          controls.value.target.z
        ])
      }
    })
    // 初始化时也同步一次
    sceneStore.setCameraControlsTarget([
      controls.value.target.x,
      controls.value.target.y,
      controls.value.target.z
    ])

    // 创建 TransformControls
    transformControls.value = new TransformControls(camera.value, sceneStore.renderer.domElement)
    
    transformControls.value.addEventListener('dragging-changed', (event) => {
      const isDragging = event.value === true
      isDraggingTransform = isDragging
      if (controls.value) controls.value.enabled = !isDragging
      
      if (!isDragging && pendingTransformUpdate) {
        const update = pendingTransformUpdate
        pendingTransformUpdate = null
        setTimeout(() => {
          sceneStore.updateSceneObjectData(update.id, { transform: update.transform })
        }, 0)
      }
    })

    transformControls.value.addEventListener('objectChange', () => {
      if (!isDraggingTransform) return
      const obj = transformControls.value?.object
      const id = obj?.userData?.sceneObjectId
      if (!obj || !id) return
      pendingTransformUpdate = {
        id,
        transform: {
          position: [obj.position.x, obj.position.y, obj.position.z],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z]
        }
      }
    })

    // 添加 gizmo 到场景
    const gizmo = transformControls.value.getHelper()
    sceneStore.threeScene?.add(gizmo)

    // 设置模式和空间
    transformControls.value.setMode(sceneStore.transformMode)
    transformControls.value.setSpace(sceneStore.transformSpace)
    
    // 设置步幅
    updateTransformSnap()

    // 附加到选中的对象
    attachTransformControl(sceneStore.selectedObjectId)
  }
  
  // 更新变换控制器步幅
  function updateTransformSnap() {
    if (!transformControls.value) return
    const snap = sceneStore.transformSnap
    // 只有当总体启用且对应的变换类型启用时，才应用步幅
    transformControls.value.translationSnap = (snap.enabled && snap.translationEnabled && snap.translation > 0) ? snap.translation : null
    transformControls.value.rotationSnap = (snap.enabled && snap.rotationEnabled && snap.rotation > 0) ? snap.rotation : null
    transformControls.value.scaleSnap = (snap.enabled && snap.scaleEnabled && snap.scale > 0) ? snap.scale : null
  }

  function updateControlsCamera() {
    if (!camera.value) return
    
    if (controls.value) {
      controls.value.object = camera.value
      controls.value.update()
    }
    
    if (transformControls.value) {
      transformControls.value.camera = camera.value
    }
  }

  // ==================== 渲染管理 ====================

  function resize() {
    if (!container.value || !sceneStore.renderer || !camera.value) return
    const w = container.value.clientWidth || window.innerWidth
    const h = container.value.clientHeight || window.innerHeight
    sceneStore.renderer.setSize(w, h)
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
  }

  function start() {
    if (!sceneStore.renderer || !sceneStore.threeScene || !camera.value) {
      console.warn('[useRenderer] start() 跳过：缺少必要组件')
      return
    }
    sceneStore.renderer.setAnimationLoop(() => {
      // 性能统计：开始计时
      globalStats.begin()
      
      // delta（秒）
      const delta = clock.getDelta()
      // 同步 context.three 引用（相机/场景可能在切场景时变化）
      const ctx = pluginManager.getContext?.() ?? null
      if (ctx) {
        ctx.three.scene = sceneStore.threeScene
        ctx.three.camera = camera.value
        ctx.three.renderer = sceneStore.renderer as any
      }
      if (ctx) pluginManager.callHook('onBeforeRender', delta, ctx as any)
      controls.value?.update()
      if (transformControls.value?.object && !isInSceneGraph(transformControls.value.object)) {
        transformControls.value.detach()
      }
      sceneStore.renderer!.render(sceneStore.threeScene!, camera.value!)
      if (ctx) pluginManager.callHook('onAfterRender', delta, ctx as any)
      processScreenshot()
      
      // 性能统计：更新场景信息并结束计时
      globalStats.updateSceneInfo(sceneStore.renderer)
      globalStats.end()
    })
  }

  function stop() {
    sceneStore.renderer?.setAnimationLoop(null as any)
  }

  function applyRendererSettings() {
    const renderer = sceneStore.renderer
    if (!renderer) return
    const settings = sceneStore.rendererSettings
    const toneMappingMap: Record<string, number> = {
      none: NoToneMapping,
      linear: LinearToneMapping,
      reinhard: ReinhardToneMapping,
      cineon: CineonToneMapping,
      acesFilmic: ACESFilmicToneMapping
    }
    const colorSpaceMap: Record<string, string> = {
      srgb: SRGBColorSpace,
      linear: LinearSRGBColorSpace
    }
    if (settings.toneMapping in toneMappingMap) {
      renderer.toneMapping = toneMappingMap[settings.toneMapping] as ToneMapping
    }
    if (typeof settings.toneMappingExposure === 'number') {
      renderer.toneMappingExposure = settings.toneMappingExposure
    }
    if (settings.outputColorSpace in colorSpaceMap) {
      ;(renderer as any).outputColorSpace = colorSpaceMap[settings.outputColorSpace]
    }
    if ((renderer as any).isWebGLRenderer) {
      ;(renderer as any).useLegacyLights = settings.useLegacyLights
    }
    if ((renderer as any).shadowMap) {
      ;(renderer as any).shadowMap.enabled = settings.shadows
    }
    if ((renderer as any).shadowMap && (renderer as any).isWebGLRenderer) {
      const shadowTypeMap: Record<string, number> = {
        basic: BasicShadowMap,
        pcf: PCFShadowMap,
        pcfSoft: PCFSoftShadowMap,
        vsm: VSMShadowMap
      }
      if (settings.shadowType in shadowTypeMap) {
        const newType = shadowTypeMap[settings.shadowType]
        const oldType = (renderer as any).shadowMap.type
        ;(renderer as any).shadowMap.type = newType
        console.log(`[Shadow] 切换阴影类型: ${oldType} -> ${newType} (VSM=${VSMShadowMap})`)
        // 切换阴影类型时需要强制更新阴影贴图
        if (oldType !== newType) {
          // 清除所有灯光的阴影贴图，强制重新创建
          if (sceneStore.threeScene) {
            sceneStore.threeScene.traverse((obj: any) => {
              if (obj.isLight && obj.shadow) {
                console.log(`[Shadow] 灯光: ${obj.name}, castShadow=${obj.castShadow}, radius=${obj.shadow.radius}, blurSamples=${obj.shadow.blurSamples}`)
                if (obj.shadow.map) {
                  obj.shadow.map.dispose()
                  obj.shadow.map = null
                }
              }
            })
          }
          ;(renderer as any).shadowMap.needsUpdate = true
        }
      }
    } else if ((renderer as any).shadowMap) {
      console.warn('[Shadow] 当前使用 WebGPU 渲染器，VSM 阴影可能不支持')
    }
  }

  function createRenderer() {
    if (!container.value) return

    // 清理旧渲染器
    if (sceneStore.renderer) {
      try {
        sceneStore.renderer.dispose()
      } catch (e) { /* ignore */ }
      const dom = sceneStore.renderer.domElement
      dom?.parentElement?.removeChild(dom)
      sceneStore.renderer = null
    }

    // 创建新渲染器
    const antialias = opts.antialias ?? sceneStore.rendererSettings.antialias
    if (sceneStore.rendererSettings.rendererType === 'webgl') {
      const renderer = new WebGLRenderer({ antialias })
      // 在创建时就启用阴影
      renderer.shadowMap.enabled = sceneStore.rendererSettings.shadows
      // 设置阴影类型
      const shadowTypeMap: Record<string, number> = {
        basic: BasicShadowMap,
        pcf: PCFShadowMap,
        pcfSoft: PCFSoftShadowMap,
        vsm: VSMShadowMap
      }
      const shadowType = sceneStore.rendererSettings.shadowType
      if (shadowType in shadowTypeMap) {
        renderer.shadowMap.type = shadowTypeMap[shadowType] as ShadowMapType
      }
      console.log(`[Shadow] 创建 WebGL 渲染器, 阴影类型: ${shadowType} (${renderer.shadowMap.type}), VSM=${VSMShadowMap}`)
      sceneStore.renderer = renderer
    } else {
      sceneStore.renderer = new WebGPURenderer({ antialias })
    }
    container.value.appendChild(sceneStore.renderer.domElement)
    applyRendererSettings()
  }

  // ==================== 场景切换（核心方法）====================

  /**
   * 切换到新场景（统一入口）
   * 按正确顺序执行：停止渲染 → 清理 → 创建场景 → 同步对象 → 设置相机 → 设置控制器 → 开始渲染
   * 现在会等待所有资产加载完成
   */
  async function switchScene() {
    console.log('[useRenderer] switchScene() 开始')
    
    // 1. 停止当前渲染
    stop()

    // 2. 清理旧的 transformControls gizmo（但保留控制器实例）
    if (transformControls.value && sceneStore.threeScene) {
      const gizmo = transformControls.value.getHelper()
      sceneStore.threeScene.remove(gizmo)
      transformControls.value.detach()
    }

    // 3. 创建新的 Three.js 场景
    const scene = new Scene()
    scene.background = new Color('#CFD8DC')
    
    // 4. 设置场景到 store（这会创建所有 three.js 对象并挂载，并等待所有资产加载完成）
    await sceneStore.setThreeScene(scene)

    // 5. 从 store 中找到或创建相机
    const cam = ensureCamera()
    if (!cam) {
      console.error('[useRenderer] 无法获取相机')
      return
    }

    // 6. 更新控制器的相机引用
    updateControlsCamera()
    
    // 6.5 从保存的数据恢复相机目标点
    if (controls.value) {
      const cameraData = sceneStore.objectDataList.find(item => item.type === 'camera')
      const savedTarget = cameraData?.camera?.target
      if (savedTarget) {
        controls.value.target.set(savedTarget[0], savedTarget[1], savedTarget[2])
        controls.value.update()
        // 同步到 store
        sceneStore.setCameraControlsTarget([savedTarget[0], savedTarget[1], savedTarget[2]])
        console.log('[switchScene] 从保存数据恢复相机目标点:', savedTarget)
      }
    }

    // 7. 确保 transformControls 的 gizmo 在新场景中
    if (transformControls.value && sceneStore.threeScene) {
      const gizmo = transformControls.value.getHelper()
      if (gizmo.parent !== sceneStore.threeScene) {
        if (gizmo.parent) gizmo.parent.remove(gizmo)
        sceneStore.threeScene.add(gizmo)
      }
      // 重新附加到选中对象
      attachTransformControl(sceneStore.selectedObjectId)
    }

    // 8. 调整大小并开始渲染
    resize()
    start()

    console.log('[useRenderer] switchScene() 完成（所有资产已加载）')
  }

  // ==================== 初始化（首次挂载）====================

  /**
   * 初始化渲染环境（只在组件首次挂载时调用）
   */
  function init() {
    if (isInitialized) {
      console.warn('[useRenderer] 已初始化，跳过')
      return
    }
    isInitialized = true
    console.log('[useRenderer] init() 开始')

    // 1. 添加事件监听器
    container.value?.addEventListener('pointerup', handlePointerUp)
    container.value?.addEventListener('pointerdown', handlePointerDown)
    if (!keyboardListenerAdded) {
      window.addEventListener('keydown', handleKeyDown)
      keyboardListenerAdded = true
    }
    window.addEventListener('resize', resize)
    
    // 使用 ResizeObserver 监听容器大小变化（处理布局变化）
    if (container.value) {
      resizeObserver = new ResizeObserver(() => {
        resize()
      })
      resizeObserver.observe(container.value)
    }

    // 2. 创建渲染器
    createRenderer()

    // 3. 创建初始场景
    const scene = new Scene()
    scene.background = new Color('#CFD8DC')
    sceneStore.setThreeScene(scene)

    // 4. 确保相机存在
    ensureCamera()

    // 5. 设置控制器
    setupControls()

    // 6. 调整大小并开始渲染
    resize()
    start()

    console.log('[useRenderer] init() 完成')
  }

  // ==================== 清理 ====================

  function dispose() {
    console.log('[useRenderer] dispose()')
    stop()
    
    // 清理 transformControls
    if (transformControls.value) {
      const gizmo = transformControls.value.getHelper()
      sceneStore.threeScene?.remove(gizmo)
      transformControls.value.dispose()
      transformControls.value = null
    }
    
    // 清理 controls
    if (controls.value) {
      controls.value.dispose()
      controls.value = null
    }
    
    // 移除事件监听器
    container.value?.removeEventListener('pointerdown', handlePointerDown)
    container.value?.removeEventListener('pointerup', handlePointerUp)
    if (keyboardListenerAdded) {
      window.removeEventListener('keydown', handleKeyDown)
      keyboardListenerAdded = false
    }
    window.removeEventListener('resize', resize)
    
    // 清理 ResizeObserver
    if (resizeObserver) {
      resizeObserver.disconnect()
      resizeObserver = null
    }
    
    // 清理渲染器
    if (sceneStore.renderer) {
      sceneStore.renderer.dispose()
      const dom = sceneStore.renderer.domElement
      dom?.parentElement?.removeChild(dom)
      sceneStore.renderer = null
    }
    
    // 清理场景数据
    sceneStore.threeScene = null
    sceneStore.objectsMap.clear()
    sceneStore.objectDataList = []
    sceneStore.selectedObjectId = null
    
    camera.value = null
    isInitialized = false
    
    useUiEditorStore().closeAssetPanel()
  }

  // ==================== 交互逻辑 ====================

  let pendingAttachId: string | null = null

  function isInSceneGraph(obj: Object3D): boolean {
    let current: Object3D | null = obj
    const scene = sceneStore.threeScene
    if (!scene) return false
    while (current) {
      if (current === scene) return true
      current = current.parent as Object3D | null
    }
    return false
  }

  function attachTransformControl(id: string | null) {
    if (!transformControls.value) return
    
    // 预览模式下不显示变换控制器
    if (!sceneStore.isEditMode) {
      transformControls.value.detach()
      pendingAttachId = null
      return
    }
    
    if (!id) {
      transformControls.value.detach()
      pendingAttachId = null
      return
    }
    const target = sceneStore.objectsMap.get(id)
    if (!target) {
      transformControls.value.detach()
      return
    }
    if (!isInSceneGraph(target)) {
      if (pendingAttachId !== id) {
        pendingAttachId = id
        requestAnimationFrame(() => {
          if (pendingAttachId === id) attachTransformControl(id)
        })
      }
      return
    }
    pendingAttachId = null
    transformControls.value.attach(target)
  }

  function handlePointerDown(event: PointerEvent) {
    pointerDownPos = { x: event.clientX, y: event.clientY }
  }

  function handlePointerUp(event: PointerEvent) {
    const dom = sceneStore.renderer?.domElement
    if (!camera.value || !dom || transformControls.value?.dragging) return
    const moved = pointerDownPos
      ? Math.hypot(event.clientX - pointerDownPos.x, event.clientY - pointerDownPos.y)
      : 0
    pointerDownPos = null

    if (moved > 2) return

    const rect = dom.getBoundingClientRect()
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    raycaster.setFromCamera(pointer, camera.value)
    const objects = Array.from(sceneStore.objectsMap.values())
    const intersections = raycaster.intersectObjects(objects, true)
    const getSceneObjectId = (obj: Object3D | null): string | null => {
      let current: Object3D | null = obj
      while (current) {
        const id = (current as any).userData?.sceneObjectId as string | undefined
        if (id) return id
        current = current.parent as Object3D | null
      }
      return null
    }
    const hit = intersections.find(item => {
      const id = getSceneObjectId(item.object)
      if (!id) return false
      const data = sceneStore.objectDataList.find(entry => entry.id === id)
      if (data?.selectable === false) return false
      ;(item as any).__sceneObjectId = id
      return true
    })

    const hitId = (hit as any)?.__sceneObjectId ?? null
    if (!hitId) {
      sceneStore.selectedObjectId = null
      return
    }
    const selected = sceneStore.objectDataList.find(item => item.id === hitId)
    if (selected?.type === 'helper') {
      const helperTargetId = (selected.helper as any)?.targetId as string | undefined
      if (helperTargetId && sceneStore.objectDataList.some(item => item.id === helperTargetId)) {
        sceneStore.selectedObjectId = helperTargetId
        return
      }
    }
    sceneStore.selectedObjectId = hitId
  }

  function focusSelectedObject() {
    if (!controls.value || !camera.value) return
    const id = sceneStore.selectedObjectId
    if (!id) return
    const obj = sceneStore.objectsMap.get(id)
    if (!obj) return
    const box = new Box3().setFromObject(obj)
    const center = box.getCenter(new Vector3())
    const size = box.getSize(new Vector3())
    const distance = Math.max(size.x, size.y, size.z) * 2 || 10
    const dir = new Vector3().subVectors(camera.value.position, controls.value.target).normalize()
    controls.value.target.copy(center)
    camera.value.position.copy(center).addScaledVector(dir, distance)
    controls.value.update()
  }

  function handleKeyDown(event: KeyboardEvent) {
    const tag = (event.target as HTMLElement | null)?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (event.target as HTMLElement | null)?.isContentEditable) return
    
    if (event.key.toLowerCase() === 'z' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      if (event.shiftKey) {
        sceneStore.redo()
      } else {
        sceneStore.undo()
      }
      return
    }
    if (event.key.toLowerCase() === 'y' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      sceneStore.redo()
      return
    }
    if (event.key.toLowerCase() === 's' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      sceneStore.saveScene?.()
      return
    }
    switch (event.key.toLowerCase()) {
      case 'w':
        sceneStore.transformMode = 'translate'
        transformControls.value?.setMode('translate')
        break
      case 'e':
        sceneStore.transformMode = 'rotate'
        transformControls.value?.setMode('rotate')
        break
      case 'r':
        sceneStore.transformMode = 'scale'
        transformControls.value?.setMode('scale')
        break
      case 'v': {
        const nextSpace = sceneStore.transformSpace === 'world' ? 'local' : 'world'
        sceneStore.transformSpace = nextSpace as any
        transformControls.value?.setSpace(nextSpace)
        break
      }
      case 'f':
        focusSelectedObject()
        break
    }
  }

  // ==================== 截图 ====================

  let pendingScreenshot: {
    resolve: (blob: Blob) => void
    reject: (error: Error) => void
    width?: number
    height?: number
  } | null = null

  function captureScreenshot(width?: number, height?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!sceneStore.renderer || !sceneStore.threeScene || !camera.value) {
        reject(new Error('渲染器未初始化'))
        return
      }
      pendingScreenshot = { resolve, reject, width, height }
    })
  }

  function processScreenshot() {
    if (!pendingScreenshot || !sceneStore.renderer || !camera.value) return
    
    const { resolve, reject, width, height } = pendingScreenshot
    pendingScreenshot = null
    
    try {
      const canvas = sceneStore.renderer.domElement as HTMLCanvasElement
      if (!canvas) {
        reject(new Error('Canvas 不存在'))
        return
      }
      
      const dataUrl = canvas.toDataURL('image/png')
      
      if (width && height && (width !== canvas.width || height !== canvas.height)) {
        const img = new Image()
        img.onload = () => {
          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = width
          tempCanvas.height = height
          const ctx = tempCanvas.getContext('2d')
          if (!ctx) {
            reject(new Error('无法创建 2D 上下文'))
            return
          }
          ctx.imageSmoothingEnabled = true
          ctx.imageSmoothingQuality = 'high'
          
          const srcAspect = img.width / img.height
          const dstAspect = width / height
          let sx = 0, sy = 0, sw = img.width, sh = img.height
          
          if (srcAspect > dstAspect) {
            sw = img.height * dstAspect
            sx = (img.width - sw) / 2
          } else if (srcAspect < dstAspect) {
            sh = img.width / dstAspect
            sy = (img.height - sh) / 2
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
          tempCanvas.toBlob(
            (blob) => {
              if (blob) resolve(blob)
              else reject(new Error('截图失败'))
            },
            'image/png',
            1.0
          )
        }
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = dataUrl
      } else {
        fetch(dataUrl)
          .then(res => res.blob())
          .then(resolve)
          .catch(reject)
      }
    } catch (error) {
      reject(error as Error)
    }
  }

  // ==================== Watchers ====================

  watch(() => sceneStore.selectedObjectId, (id) => {
    attachTransformControl(id)
  }, { immediate: true })

  watch(() => sceneStore.selectionVersion, () => {
    attachTransformControl(sceneStore.selectedObjectId)
  })

  // 监听编辑模式变化，切换到编辑模式时重新附加控制器
  watch(() => sceneStore.isEditMode, (isEdit) => {
    if (isEdit && sceneStore.selectedObjectId) {
      attachTransformControl(sceneStore.selectedObjectId)
    } else if (!isEdit) {
      // 切换到预览模式时，移除控制器
      transformControls.value?.detach()
    }
  })

  watch(() => sceneStore.transformMode, (mode) => {
    transformControls.value?.setMode(mode)
  })

  watch(() => sceneStore.transformSpace, (space) => {
    transformControls.value?.setSpace(space)
  })

  watch(() => sceneStore.transformSnap, () => {
    updateTransformSnap()
  }, { deep: true })

  watch(() => sceneStore.rendererSettings, () => {
    applyRendererSettings()
  }, { deep: true })

  watch(() => sceneStore.rendererSettings.rendererType, () => {
    // 渲染器类型变化时需要重建
    if (isInitialized) {
      stop()
      createRenderer()
      setupControls()
      resize()
      start()
    }
  })

  // ==================== 生命周期 ====================

  onBeforeUnmount(() => {
    console.log('[useRenderer] onBeforeUnmount')
    dispose()
  })

  return {
    // 核心方法
    init,
    switchScene,
    dispose,
    
    // 状态
    container,
    camera,
    controls,
    transformControls,
    
    // 渲染控制
    start,
    stop,
    resize,
    
    // 截图
    captureScreenshot
  }
}
