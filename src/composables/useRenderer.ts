import { ref, shallowRef, onBeforeUnmount, watch } from 'vue'
import { Scene, PerspectiveCamera, Color, type ToneMapping } from 'three'
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

/**
 * 渲染器与交互控制逻辑（纯三维层，不关心 UI）：
 * - 创建并管理 WebGPU/WebGL Renderer（根据 store.rendererSettings 决定类型）
 * - 维护相机、MapControls、TransformControls
 * - 负责射线选择（点击选中场景对象）、快捷键（W/E/R/V/F、Ctrl+Z/Y、Ctrl+S）
 *
 * 设计原则：
 * - three 场景和对象的数据来源完全依赖 useSceneStore（单一数据源）
 * - 渲染器的生命周期（创建 / 销毁）由本 composable 管理，store 只保存引用
 * - 清理逻辑尽量对称（rebuildRenderer / dispose）防止内存泄漏
 */
export function useRenderer(opts: { antialias?: boolean } = {}) {
  const sceneStore = useSceneStore()
  const container = ref<HTMLElement | null>(null)
  const camera = shallowRef<PerspectiveCamera | null>(null)
  const controls = shallowRef<MapControls | null>(null)
  const transformControls = shallowRef<TransformControls | null>(null)
  const raycaster = new Raycaster()
  const pointer = new Vector2()
  let pointerDownPos: { x: number; y: number } | null = null
  let isDraggingTransform = false // 标记是否正在拖动 TransformControls
  let pendingTransformUpdate: { id: string; transform: { position: [number, number, number]; rotation: [number, number, number]; scale: [number, number, number] } } | null = null // 待提交的 transform 更新
  let keyboardListenerAdded = false // 标记键盘事件监听器是否已添加

  function findCameraFromStore() {
    const map = sceneStore.objectsMap as unknown as Map<string, PerspectiveCamera>
    for (const obj of map.values()) {
      if ((obj as any).userData?.sceneObjectType === 'camera' && obj instanceof PerspectiveCamera) {
        return obj
      }
    }
    return null
  }

  function ensureCamera() {
    const existing = findCameraFromStore()
    if (existing) {
      camera.value = existing
      return existing
    }

    const cameraData = sceneStore.objectDataList.find(item => item.type === 'camera')
    const cameraObj = cameraData ? sceneStore.objectsMap.get(cameraData.id) : null
    if (cameraObj instanceof PerspectiveCamera) {
      camera.value = cameraObj
      return cameraObj
    }

    const newCameraData = sceneStore.addSceneObjectData({
      type: 'camera',
      name: 'Main Camera',
      parentId: 'Scene',
      transform: { position: [25, 30, 20] }
    })
    const created = sceneStore.objectsMap.get(newCameraData.id)
    if (created instanceof PerspectiveCamera) {
      camera.value = created
      return created
    }
    return null
  }

  function resize() {
    if (!container.value || !sceneStore.renderer || !camera.value) return
    const w = container.value.clientWidth || window.innerWidth
    const h = container.value.clientHeight || window.innerHeight
    sceneStore.renderer.setSize(w, h)
    camera.value.aspect = w / h
    camera.value.updateProjectionMatrix()
  }

  function start() {
    if (!camera.value) ensureCamera()
    if (!sceneStore.renderer || !sceneStore.threeScene || !camera.value) return
    sceneStore.renderer.setAnimationLoop(() => {
      controls.value?.update()
      if (transformControls.value?.object && !isInSceneGraph(transformControls.value.object)) {
        transformControls.value.detach()
      }
      // WebGPU 和 WebGL 都使用统一的渲染调用
      // TransformControls 在拖动时会自动触发渲染，这里确保场景正常渲染
      sceneStore.renderer!.render(sceneStore.threeScene!, camera.value!)
      
      // 渲染完成后处理截图请求
      processScreenshot()
    })
  }

  function stop() {
    sceneStore.renderer?.setAnimationLoop(null as any)
  }

  function dispose() {
    stop()
    const pendingTransform = detachTransformControls()
    const pendingControls = controls.value
    controls.value = null
    // 渲染器的真正销毁交给 rebuildRenderer / 组件卸载统一处理
    try {
      pendingTransform?.dispose()
    } catch (e) {
      // ignore
    }
    try {
      pendingControls?.dispose()
    } catch (e) {
      // ignore
    }
    // const dom = sceneStore.webGPURenderer?.domElement
    container.value?.removeEventListener('pointerdown', handlePointerDown)
    container.value?.removeEventListener('pointerup', handlePointerUp)
    // 移除键盘事件监听器
    if (keyboardListenerAdded) {
      window.removeEventListener('keydown', handleKeyDown)
      keyboardListenerAdded = false
    }
    sceneStore.renderer = null
    sceneStore.threeScene = null
    camera.value = null
    transformControls.value = null
  }

  let pendingAttachId: string | null = null

  function isInSceneGraph(obj: Object3D) {
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
    const getSceneObjectId = (obj: Object3D | null) => {
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
      // Ctrl/Cmd + Z 撤回，Ctrl/Cmd + Shift + Z 回退
      if (event.shiftKey) {
        sceneStore.redo()
      } else {
        sceneStore.undo()
      }
      return
    }
    // Ctrl/Cmd + Y 回退（Windows 习惯）
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

  function initSceneBackground() {
    container.value?.addEventListener('pointerup', handlePointerUp)
    container.value?.addEventListener('pointerdown', handlePointerDown)
    
    // 确保键盘事件监听器只添加一次
    if (!keyboardListenerAdded) {
      window.addEventListener('keydown', handleKeyDown)
      keyboardListenerAdded = true
    }
    
    const scene = new Scene()
    if (!sceneStore.threeScene) {
      scene.background = new Color('#CFD8DC')
    } else if (!sceneStore.threeScene.background) {
      sceneStore.threeScene.background = new Color('#CFD8DC')
    }
    sceneStore.setThreeScene(scene)

    ensureCamera()

    rebuildRenderer()

    window.addEventListener('resize', resize)
  }

  watch(() => sceneStore.selectedObjectId, (id) => {
    attachTransformControl(id)
  }, { immediate: true })

  watch(() => sceneStore.selectionVersion, () => {
    attachTransformControl(sceneStore.selectedObjectId)
  })

  watch(() => sceneStore.transformMode, (mode) => {
    transformControls.value?.setMode(mode)
  })

  watch(() => sceneStore.transformSpace, (space) => {
    transformControls.value?.setSpace(space)
  })

  watch(() => sceneStore.rendererSettings, () => {
    applyRendererSettings()
  }, { deep: true })

  watch(() => sceneStore.rendererSettings.rendererType, () => {
    rebuildRenderer()
  })

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
        ;(renderer as any).shadowMap.type = shadowTypeMap[settings.shadowType]
      }
    }
  }

  function rebuildRenderer() {
    stop()
    const pendingTransform = detachTransformControls()
    const pendingControls = controls.value
    controls.value = null
    if (sceneStore.renderer) {
      try {
        sceneStore.renderer.dispose()
      } catch (e) {
        // ignore
      }
      const dom = sceneStore.renderer.domElement
      dom?.parentElement?.removeChild(dom)
      sceneStore.renderer = null
    }
    try {
      pendingTransform?.dispose()
    } catch (e) {
      // ignore
    }
    try {
      pendingControls?.dispose()
    } catch (e) {
      // ignore
    }

    if (!container.value) return
    const antialias = opts.antialias ?? sceneStore.rendererSettings.antialias
    if (sceneStore.rendererSettings.rendererType === 'webgl') {
      sceneStore.renderer = new WebGLRenderer({ antialias })
    } else {
      sceneStore.renderer = new WebGPURenderer({ antialias })
    }
    container.value.appendChild(sceneStore.renderer.domElement)

    if (camera.value) {
      controls.value = new MapControls(camera.value, container.value)

      transformControls.value = new TransformControls(camera.value, sceneStore.renderer.domElement)
      transformControls.value.addEventListener('dragging-changed', (event) => {
        const isDragging = event.value === true
        isDraggingTransform = isDragging
        if (controls.value) controls.value.enabled = !isDragging
        
        // 拖动结束时，提交最终的 transform 更新到 store
        // 使用 setTimeout 异步执行，避免阻塞主线程导致 INP 延迟
        if (!isDragging && pendingTransformUpdate) {
          const update = pendingTransformUpdate
          pendingTransformUpdate = null
          // 异步执行，避免阻塞交互响应
          setTimeout(() => {
            // 如果使用命令模式，updateSceneObjectData 会自动创建命令
            // 如果使用旧的快照模式，这里会跳过快照（保持原有行为）
            sceneStore.updateSceneObjectData(update.id, {
              transform: update.transform
            })
          }, 0)
        }
      })
      // 拖动过程中只缓存 transform，不立即更新 store（避免频繁 store 更新导致卡顿）
      // 拖动结束时通过 dragging-changed 事件提交最终状态
      transformControls.value.addEventListener('objectChange', () => {
        if (!isDraggingTransform) return // 非拖动状态才立即更新（理论上不会触发，但保险起见）
        
        const obj = transformControls.value?.object
        const id = obj?.userData?.sceneObjectId
        if (!obj || !id) return
        
        // 拖动时只缓存，不更新 store（避免 WebGPU 下频繁 store 更新导致卡顿）
        pendingTransformUpdate = {
          id,
          transform: {
            position: [obj.position.x, obj.position.y, obj.position.z],
            rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
            scale: [obj.scale.x, obj.scale.y, obj.scale.z]
          }
        }
      })

      const gizmo = transformControls.value.getHelper()
      sceneStore.threeScene?.add(gizmo)
      attachTransformControl(sceneStore.selectedObjectId)
      transformControls.value.setMode(sceneStore.transformMode)
      transformControls.value.setSpace(sceneStore.transformSpace)
    }
    applyRendererSettings()
    resize()
    start()
  }

  function detachTransformControls() {
    if (!transformControls.value) return null
    const helper = transformControls.value.getHelper()
    sceneStore.threeScene?.remove(helper)
    transformControls.value.detach()
    const pending = transformControls.value
    transformControls.value = null
    return pending
  }

  // 截图相关
  let pendingScreenshot: {
    resolve: (blob: Blob) => void
    reject: (error: Error) => void
    width?: number
    height?: number
  } | null = null

  /**
   * 截取当前场景截图
   * 在渲染循环中截图，确保使用正确的摄像机和时机
   */
  function captureScreenshot(width?: number, height?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!sceneStore.renderer || !sceneStore.threeScene || !camera.value) {
        reject(new Error('渲染器未初始化'))
        return
      }
      
      // 设置待处理的截图请求
      pendingScreenshot = { resolve, reject, width, height }
    })
  }

  /**
   * 处理截图（在渲染循环中调用）
   */
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
      
      // 同步获取 canvas 内容
      const dataUrl = canvas.toDataURL('image/png')
      
      // 如果需要缩放
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
          
          // 使用 cover 模式：保持宽高比，裁剪多余部分填满目标区域
          const srcAspect = img.width / img.height
          const dstAspect = width / height
          let sx = 0, sy = 0, sw = img.width, sh = img.height
          
          if (srcAspect > dstAspect) {
            // 原图更宽，裁剪左右两侧
            sw = img.height * dstAspect
            sx = (img.width - sw) / 2
          } else if (srcAspect < dstAspect) {
            // 原图更高，裁剪上下两侧
            sh = img.width / dstAspect
            sy = (img.height - sh) / 2
          }
          
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)
          tempCanvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob)
              } else {
                reject(new Error('截图失败'))
              }
            },
            'image/png',
            1.0
          )
        }
        img.onerror = () => reject(new Error('图片加载失败'))
        img.src = dataUrl
      } else {
        // 不需要缩放，直接转换
        fetch(dataUrl)
          .then(res => res.blob())
          .then(resolve)
          .catch(reject)
      }
    } catch (error) {
      reject(error as Error)
    }
  }

  onBeforeUnmount(() => {
    window.removeEventListener('resize', resize)
    if (keyboardListenerAdded) {
      window.removeEventListener('keydown', handleKeyDown)
      keyboardListenerAdded = false
    }
    dispose()
  })

  return {
    initSceneBackground,
    container,
    camera,
    controls,
    transformControls,
    start,
    stop,
    resize,
    dispose,
    captureScreenshot
  }
}
