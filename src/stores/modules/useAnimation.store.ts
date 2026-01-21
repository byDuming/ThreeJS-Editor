/**
 * 动画系统 Store
 * 
 * 职责：
 * - 管理动画剪辑列表
 * - 控制动画播放状态
 * - 处理关键帧的增删改
 * - 实时应用动画到场景对象
 */

import { defineStore } from 'pinia'
import { ref, computed, shallowRef } from 'vue'
import { useSceneStore } from './useScene.store'
import type {
  AnimationClip,
  AnimationTrack,
  Keyframe,
  AnimatableProperty,
  KeyframeValue,
  EasingType,
  PlaybackState,
  PlaybackDirection,
  PlaybackStatus,
  TimelineViewState,
  TimelineSelection,
  CreateClipParams,
  CreateTrackParams,
  CreateKeyframeParams,
  AnimationEvent,
  AnimationEventListener,
  PlayAnimationOptions,
  AnimationClipInfo,
  SerializedAnimationClip,
  AnimationStorageData
} from '@/types/animation'

// ==================== 存储常量 ====================
const STORAGE_VERSION = '1.0'

// 缓动函数实现
const easingFunctions: Record<EasingType, (t: number) => number> = {
  linear: t => t,
  // Quad
  easeInQuad: t => t * t,
  easeOutQuad: t => t * (2 - t),
  easeInOutQuad: t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
  // Cubic
  easeInCubic: t => t * t * t,
  easeOutCubic: t => (--t) * t * t + 1,
  easeInOutCubic: t => t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,
  // Quart
  easeInQuart: t => t * t * t * t,
  easeOutQuart: t => 1 - (--t) * t * t * t,
  easeInOutQuart: t => t < 0.5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t,
  // Quint
  easeInQuint: t => t * t * t * t * t,
  easeOutQuint: t => 1 + (--t) * t * t * t * t,
  easeInOutQuint: t => t < 0.5 ? 16 * t * t * t * t * t : 1 + 16 * (--t) * t * t * t * t,
  // Sine
  easeInSine: t => 1 - Math.cos(t * Math.PI / 2),
  easeOutSine: t => Math.sin(t * Math.PI / 2),
  easeInOutSine: t => -(Math.cos(Math.PI * t) - 1) / 2,
  // Expo
  easeInExpo: t => t === 0 ? 0 : Math.pow(2, 10 * (t - 1)),
  easeOutExpo: t => t === 1 ? 1 : 1 - Math.pow(2, -10 * t),
  easeInOutExpo: t => {
    if (t === 0) return 0
    if (t === 1) return 1
    if (t < 0.5) return Math.pow(2, 20 * t - 10) / 2
    return (2 - Math.pow(2, -20 * t + 10)) / 2
  },
  // Circ
  easeInCirc: t => 1 - Math.sqrt(1 - t * t),
  easeOutCirc: t => Math.sqrt(1 - (--t) * t),
  easeInOutCirc: t => t < 0.5
    ? (1 - Math.sqrt(1 - 4 * t * t)) / 2
    : (Math.sqrt(1 - Math.pow(-2 * t + 2, 2)) + 1) / 2,
  // Back
  easeInBack: t => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return c3 * t * t * t - c1 * t * t
  },
  easeOutBack: t => {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  },
  easeInOutBack: t => {
    const c1 = 1.70158
    const c2 = c1 * 1.525
    return t < 0.5
      ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
      : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2
  },
  // Elastic
  easeInElastic: t => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4)
  },
  easeOutElastic: t => {
    const c4 = (2 * Math.PI) / 3
    return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
  },
  easeInOutElastic: t => {
    const c5 = (2 * Math.PI) / 4.5
    return t === 0 ? 0 : t === 1 ? 1
      : t < 0.5
        ? -(Math.pow(2, 20 * t - 10) * Math.sin((20 * t - 11.125) * c5)) / 2
        : (Math.pow(2, -20 * t + 10) * Math.sin((20 * t - 11.125) * c5)) / 2 + 1
  },
  // Bounce
  easeInBounce: t => 1 - easingFunctions.easeOutBounce(1 - t),
  easeOutBounce: t => {
    const n1 = 7.5625
    const d1 = 2.75
    if (t < 1 / d1) return n1 * t * t
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375
    return n1 * (t -= 2.625 / d1) * t + 0.984375
  },
  easeInOutBounce: t => t < 0.5
    ? (1 - easingFunctions.easeOutBounce(1 - 2 * t)) / 2
    : (1 + easingFunctions.easeOutBounce(2 * t - 1)) / 2,
}

export const useAnimationStore = defineStore('animation', () => {
  const sceneStore = useSceneStore()

  // ==================== 动画数据 ====================
  
  /** 所有动画剪辑 */
  const clips = ref<AnimationClip[]>([])
  
  /** 当前活动的剪辑ID */
  const activeClipId = ref<string | null>(null)
  
  /** 当前活动的剪辑 */
  const activeClip = computed(() => 
    clips.value.find(c => c.id === activeClipId.value) ?? null
  )

  // ==================== 播放状态 ====================
  
  /** 播放状态 */
  const playbackState = ref<PlaybackState>('stopped')
  
  /** 当前播放时间（秒） */
  const currentTime = ref(0)
  
  /** 播放速度 */
  const playbackSpeed = ref(1)
  
  /** 播放方向 */
  const playbackDirection = ref<PlaybackDirection>('forward')
  
  /** 当前循环次数 */
  const currentLoop = ref(0)
  
  /** 是否正在播放 */
  const isPlaying = computed(() => playbackState.value === 'playing')
  
  /** 是否暂停 */
  const isPaused = computed(() => playbackState.value === 'paused')
  
  /** 播放状态汇总 */
  const playbackStatus = computed<PlaybackStatus>(() => ({
    state: playbackState.value,
    currentTime: currentTime.value,
    speed: playbackSpeed.value,
    direction: playbackDirection.value,
    currentLoop: currentLoop.value
  }))

  // ==================== 时间轴UI状态 ====================
  
  /** 时间轴视图状态 */
  const timelineView = ref<TimelineViewState>({
    zoom: 1,
    scrollX: 0,
    scrollY: 0,
    showFrames: false,
    autoScroll: true,
    snapToFrames: true,
    snapToKeyframes: true
  })
  
  /** 时间轴选择状态 */
  const timelineSelection = ref<TimelineSelection>({
    keyframeIds: [],
    trackIds: []
  })

  // ==================== 播放循环 ====================
  
  let animationFrameId: number | null = null
  let lastFrameTime = 0
  
  /** 后台播放的剪辑状态（用于同时播放多个剪辑） */
  interface BackgroundClipState {
    clipId: string
    currentTime: number
    speed: number
    direction: PlaybackDirection
    loop: boolean
    loopCount: number
    lastFrameTime: number
    onComplete?: () => void
    onLoop?: () => void
    frameId: number | null
  }
  
  const backgroundClips = ref<Map<string, BackgroundClipState>>(new Map())
  
  /** 事件监听器 */
  const eventListeners = shallowRef<AnimationEventListener[]>([])

  // ==================== 剪辑管理 ====================
  
  /**
   * 创建新的动画剪辑
   */
  function createClip(params: CreateClipParams): AnimationClip {
    const now = new Date()
    const clip: AnimationClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: params.name,
      duration: params.duration ?? 5,
      fps: params.fps ?? 30,
      loop: params.loop ?? false,
      loopCount: -1,
      playMode: 'manual',
      enabled: true, // 默认启用
      queueOnAutoPlay: true, // 默认排队播放
      resetOnComplete: true,
      tracks: [],
      createdAt: now,
      updatedAt: now
    }
    
    clips.value.push(clip)
    activeClipId.value = clip.id
    
    markDirty()
    
    return clip
  }
  
  /**
   * 删除动画剪辑
   */
  function deleteClip(clipId: string): boolean {
    const index = clips.value.findIndex(c => c.id === clipId)
    if (index === -1) return false
    
    // 如果删除的是当前活动剪辑，切换到其他剪辑或清空
    if (activeClipId.value === clipId) {
      stop()
      activeClipId.value = clips.value[index - 1]?.id ?? clips.value[index + 1]?.id ?? null
    }
    
    clips.value.splice(index, 1)
    
    markDirty()
    
    return true
  }
  
  /**
   * 更新剪辑属性
   */
  function updateClip(clipId: string, patch: Partial<AnimationClip>): boolean {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return false
    
    Object.assign(clip, patch, { updatedAt: new Date() })
    
    markDirty()
    
    return true
  }
  
  /**
   * 复制剪辑
   */
  function duplicateClip(clipId: string): AnimationClip | null {
    const source = clips.value.find(c => c.id === clipId)
    if (!source) return null
    
    const now = new Date()
    const newClip: AnimationClip = {
      ...JSON.parse(JSON.stringify(source)),
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: `${source.name} (副本)`,
      createdAt: now,
      updatedAt: now
    }
    
    // 重新生成轨道和关键帧ID
    newClip.tracks.forEach(track => {
      track.id = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      track.keyframes.forEach(kf => {
        kf.id = `kf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    })
    
    clips.value.push(newClip)
    return newClip
  }

  // ==================== 轨道管理 ====================
  
  /**
   * 添加动画轨道
   */
  function addTrack(params: CreateTrackParams): AnimationTrack | null {
    const clip = clips.value.find(c => c.id === params.clipId)
    if (!clip) return null
    
    // 检查是否已存在相同目标和属性的轨道
    const existing = clip.tracks.find(
      t => t.targetId === params.targetId && t.property === params.property
    )
    if (existing) return existing
    
    const track: AnimationTrack = {
      id: `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      targetId: params.targetId,
      property: params.property,
      keyframes: [],
      interpolation: params.interpolation ?? 'linear',
      enabled: true,
      locked: false
    }
    
    clip.tracks.push(track)
    clip.updatedAt = new Date()
    
    markDirty()
    
    return track
  }
  
  /**
   * 删除轨道
   */
  function deleteTrack(clipId: string, trackId: string): boolean {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return false
    
    const index = clip.tracks.findIndex(t => t.id === trackId)
    if (index === -1) return false
    
    clip.tracks.splice(index, 1)
    clip.updatedAt = new Date()
    
    // 从选择中移除
    timelineSelection.value.trackIds = timelineSelection.value.trackIds.filter(id => id !== trackId)
    
    markDirty()
    
    return true
  }
  
  /**
   * 更新轨道属性
   */
  function updateTrack(clipId: string, trackId: string, patch: Partial<AnimationTrack>): boolean {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return false
    
    const track = clip.tracks.find(t => t.id === trackId)
    if (!track) return false
    
    Object.assign(track, patch)
    clip.updatedAt = new Date()
    
    markDirty()
    
    return true
  }

  // ==================== 关键帧管理 ====================
  
  /**
   * 查找轨道
   */
  function findTrack(trackId: string): { clip: AnimationClip; track: AnimationTrack } | null {
    for (const clip of clips.value) {
      const track = clip.tracks.find(t => t.id === trackId)
      if (track) return { clip, track }
    }
    return null
  }
  
  /**
   * 添加关键帧
   */
  function addKeyframe(params: CreateKeyframeParams): Keyframe | null {
    const result = findTrack(params.trackId)
    if (!result) {
      console.warn(`[addKeyframe] 找不到轨道: ${params.trackId}`)
      return null
    }
    
    const { clip, track } = result
    
    // 检查是否已存在该时间点的关键帧
    const existingIndex = track.keyframes.findIndex(
      k => Math.abs(k.time - params.time) < 0.001
    )
    
    // 获取值（如果没有传入，使用当前对象的值）
    let value = params.value
    if (value === undefined) {
      value = getPropertyValue(track.targetId, track.property)
    }
    
    if (value === undefined) {
      console.warn(`[addKeyframe] 获取属性值失败: ${track.property} for ${track.targetId}`)
      return null
    }
    
    const keyframe: Keyframe = {
      id: `kf-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      time: params.time,
      value,
      easing: params.easing ?? 'linear'
    }
    
    if (existingIndex >= 0) {
      // 替换已存在的关键帧
      track.keyframes[existingIndex] = keyframe
    } else {
      // 添加新关键帧并排序
      track.keyframes.push(keyframe)
      track.keyframes.sort((a, b) => a.time - b.time)
    }
    
    clip.updatedAt = new Date()
    
    markDirty()
    
    return keyframe
  }
  
  /**
   * 删除关键帧
   */
  function deleteKeyframe(trackId: string, keyframeId: string): boolean {
    const result = findTrack(trackId)
    if (!result) return false
    
    const { clip, track } = result
    const index = track.keyframes.findIndex(k => k.id === keyframeId)
    if (index === -1) return false
    
    track.keyframes.splice(index, 1)
    clip.updatedAt = new Date()
    
    // 从选择中移除
    timelineSelection.value.keyframeIds = timelineSelection.value.keyframeIds.filter(id => id !== keyframeId)
    
    markDirty()
    
    return true
  }
  
  /**
   * 更新关键帧
   */
  function updateKeyframe(trackId: string, keyframeId: string, patch: Partial<Keyframe>): boolean {
    const result = findTrack(trackId)
    if (!result) return false
    
    const { clip, track } = result
    const keyframe = track.keyframes.find(k => k.id === keyframeId)
    if (!keyframe) return false
    
    Object.assign(keyframe, patch)
    
    // 如果时间变了，重新排序
    if (patch.time !== undefined) {
      track.keyframes.sort((a, b) => a.time - b.time)
    }
    
    clip.updatedAt = new Date()
    
    markDirty()
    
    return true
  }
  
  /**
   * 在当前时间为选中对象的指定属性添加关键帧
   */
  function keyframeSelectedObject(property: AnimatableProperty): Keyframe | null {
    const selectedId = sceneStore.selectedObjectId
    if (!selectedId || !activeClip.value) return null
    
    // 查找或创建轨道
    let track: AnimationTrack | null | undefined = activeClip.value.tracks.find(
      t => t.targetId === selectedId && t.property === property
    )
    
    if (!track) {
      track = addTrack({
        clipId: activeClip.value.id,
        targetId: selectedId,
        property
      })
    }
    
    if (!track) return null
    
    return addKeyframe({
      trackId: track.id,
      time: currentTime.value
    })
  }
  
  /**
   * 为选中对象的所有 transform 属性添加关键帧
   */
  function keyframeSelectedTransform(): Keyframe[] {
    const properties: AnimatableProperty[] = [
      'position.x', 'position.y', 'position.z',
      'rotation.x', 'rotation.y', 'rotation.z',
      'scale.x', 'scale.y', 'scale.z'
    ]
    
    return properties
      .map(prop => keyframeSelectedObject(prop))
      .filter((kf): kf is Keyframe => kf !== null)
  }

  // ==================== 属性值操作 ====================
  
  /**
   * 从场景对象获取属性值
   */
  function getPropertyValue(targetId: string, property: AnimatableProperty): KeyframeValue | undefined {
    const objData = sceneStore.objectDataList.find(o => o.id === targetId)
    if (!objData) {
      console.warn(`[getPropertyValue] 找不到物体: ${targetId}`)
      return undefined
    }
    
    if (!objData.transform) {
      console.warn(`[getPropertyValue] 物体没有 transform: ${targetId}`, objData)
      return undefined
    }
    
    // 处理数组索引（如 position.x 实际上是 transform.position[0]）
    if (property.startsWith('position.')) {
      const axis = property.split('.')[1]
      const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
      const value = objData.transform.position?.[index]
      console.log(`[getPropertyValue] ${property} = ${value}`)
      return value
    }
    if (property.startsWith('rotation.')) {
      const axis = property.split('.')[1]
      const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
      const value = objData.transform.rotation?.[index]
      console.log(`[getPropertyValue] ${property} = ${value}`)
      return value
    }
    if (property.startsWith('scale.')) {
      const axis = property.split('.')[1]
      const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
      const value = objData.transform.scale?.[index]
      console.log(`[getPropertyValue] ${property} = ${value}`)
      return value
    }
    
    // 其他属性使用通用方式
    const parts = property.split('.')
    let value: any = objData
    
    for (const part of parts) {
      if (value === undefined || value === null) return undefined
      value = value[part]
    }
    
    return value
  }
  
  /**
   * 设置场景对象的属性值
   */
  function setPropertyValue(targetId: string, property: AnimatableProperty, value: KeyframeValue) {
    const objData = sceneStore.objectDataList.find(o => o.id === targetId)
    if (!objData) return
    
    // 处理 transform 属性
    if (property.startsWith('position.')) {
      const axis = property.split('.')[1]
      const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
      const newPosition = [...objData.transform.position] as [number, number, number]
      newPosition[index] = value as number
      sceneStore.updateSceneObjectData(targetId, {
        transform: { ...objData.transform, position: newPosition }
      }, { skipHistory: true } as any)
      return
    }
    if (property.startsWith('rotation.')) {
      const axis = property.split('.')[1]
      const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
      const newRotation = [...objData.transform.rotation] as [number, number, number]
      newRotation[index] = value as number
      sceneStore.updateSceneObjectData(targetId, {
        transform: { ...objData.transform, rotation: newRotation }
      }, { skipHistory: true } as any)
      return
    }
    if (property.startsWith('scale.')) {
      const axis = property.split('.')[1]
      const index = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
      const newScale = [...objData.transform.scale] as [number, number, number]
      newScale[index] = value as number
      sceneStore.updateSceneObjectData(targetId, {
        transform: { ...objData.transform, scale: newScale }
      }, { skipHistory: true } as any)
      return
    }
    
    // 其他属性使用通用方式
    // TODO: 实现其他属性的设置
  }

  // ==================== 插值计算 ====================
  
  /**
   * 在指定时间对轨道进行插值
   */
  function interpolateTrack(track: AnimationTrack, time: number): KeyframeValue | null {
    const { keyframes, interpolation } = track
    
    if (keyframes.length === 0) return null
    
    const firstKeyframe = keyframes[0]
    const lastKeyframe = keyframes[keyframes.length - 1]
    
    if (!firstKeyframe || !lastKeyframe) return null
    
    if (keyframes.length === 1) return firstKeyframe.value
    
    // 边界情况
    if (time <= firstKeyframe.time) return firstKeyframe.value
    if (time >= lastKeyframe.time) return lastKeyframe.value
    
    // 找到前后关键帧
    let prevIndex = 0
    for (let i = 0; i < keyframes.length - 1; i++) {
      const nextKf = keyframes[i + 1]
      if (nextKf && nextKf.time > time) {
        prevIndex = i
        break
      }
    }
    
    const prev = keyframes[prevIndex]
    const next = keyframes[prevIndex + 1]
    
    if (!prev || !next) return null
    
    // 计算局部时间 t (0-1)
    let t = (time - prev.time) / (next.time - prev.time)
    
    // 应用缓动
    const easingFn = easingFunctions[next.easing] ?? easingFunctions.linear
    t = easingFn(t)
    
    // 根据插值类型计算值
    switch (interpolation) {
      case 'step':
      case 'constant':
        return prev.value
        
      case 'linear':
      default:
        return lerpValue(prev.value, next.value, t)
    }
  }
  
  /**
   * 线性插值
   */
  function lerpValue(a: KeyframeValue, b: KeyframeValue, t: number): KeyframeValue {
    // 数字
    if (typeof a === 'number' && typeof b === 'number') {
      return a + (b - a) * t
    }
    
    // 布尔值
    if (typeof a === 'boolean' && typeof b === 'boolean') {
      return t < 0.5 ? a : b
    }
    
    // 颜色字符串
    if (typeof a === 'string' && typeof b === 'string') {
      // 简单处理：小于0.5返回a，否则返回b
      // TODO: 实现颜色插值
      return t < 0.5 ? a : b
    }
    
    // Vector3
    if (Array.isArray(a) && Array.isArray(b) && a.length === 3 && b.length === 3) {
      return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
        a[2] + (b[2] - a[2]) * t
      ] as [number, number, number]
    }
    
    return a
  }

  // ==================== 播放控制 ====================
  
  /**
   * 播放
   */
  function play() {
    if (!activeClip.value) return
    if (playbackState.value === 'playing') return
    
    playbackState.value = 'playing'
    lastFrameTime = performance.now()
    
    emitEvent({ type: 'start', time: currentTime.value, clipId: activeClip.value.id })
    
    tick()
  }
  
  /**
   * 暂停
   */
  function pause() {
    if (playbackState.value !== 'playing') return
    
    playbackState.value = 'paused'
    
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    
    if (activeClip.value) {
      emitEvent({ type: 'pause', time: currentTime.value, clipId: activeClip.value.id })
    }
  }
  
  /**
   * 停止
   * @param shouldReset 是否重置到开始位置
   *   - 默认 true（手动停止时总是重置）
   *   - 播放完成时传入 resetOnComplete 的值来决定
   */
  function stop(shouldReset: boolean = true) {
    const wasPlaying = playbackState.value === 'playing'
    
    playbackState.value = 'stopped'
    
    // 根据 shouldReset 决定是否重置
    // shouldReset = true：重置
    // shouldReset = false：不重置，保持在当前位置
    if (shouldReset) {
      currentTime.value = 0
      currentLoop.value = 0
      // 应用初始状态
      applyAnimationAtTime(0)
    }
    
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    
    if (activeClip.value) {
      emitEvent({ type: 'end', time: currentTime.value, clipId: activeClip.value.id })
    }
    
    // 触发完成回调
    if (wasPlaying && onCompleteCallback) {
      const callback = onCompleteCallback
      onCompleteCallback = null
      onLoopCallback = null
      callback()
    }
  }
  
  /**
   * 跳转到指定时间
   */
  function seek(time: number) {
    if (!activeClip.value) return
    
    currentTime.value = Math.max(0, Math.min(time, activeClip.value.duration))
    applyAnimationAtTime(currentTime.value)
    
    emitEvent({ type: 'seek', time: currentTime.value, clipId: activeClip.value.id })
  }
  
  /**
   * 跳转到上一个关键帧
   */
  function goToPreviousKeyframe() {
    if (!activeClip.value) return
    
    let prevTime = 0
    for (const track of activeClip.value.tracks) {
      for (const kf of track.keyframes) {
        if (kf.time < currentTime.value - 0.001 && kf.time > prevTime) {
          prevTime = kf.time
        }
      }
    }
    
    seek(prevTime)
  }
  
  /**
   * 跳转到下一个关键帧
   */
  function goToNextKeyframe() {
    if (!activeClip.value) return
    
    let nextTime = activeClip.value.duration
    for (const track of activeClip.value.tracks) {
      for (const kf of track.keyframes) {
        if (kf.time > currentTime.value + 0.001 && kf.time < nextTime) {
          nextTime = kf.time
        }
      }
    }
    
    seek(nextTime)
  }
  
  /**
   * 播放循环
   */
  function tick() {
    if (playbackState.value !== 'playing' || !activeClip.value) return
    
    const now = performance.now()
    const delta = (now - lastFrameTime) / 1000 * playbackSpeed.value
    lastFrameTime = now
    
    // 更新时间
    if (playbackDirection.value === 'forward') {
      currentTime.value += delta
    } else if (playbackDirection.value === 'backward') {
      currentTime.value -= delta
    }
    
    // 处理边界
    if (currentTime.value >= activeClip.value.duration) {
      if (activeClip.value.loop) {
        currentLoop.value++
        if (activeClip.value.loopCount > 0 && currentLoop.value >= activeClip.value.loopCount) {
          // 循环完成，根据 resetOnComplete 选项决定是否重置
          stop(activeClip.value.resetOnComplete)
          return
        }
        
        if (playbackDirection.value === 'pingpong') {
          playbackDirection.value = 'backward'
          currentTime.value = activeClip.value.duration
        } else {
          currentTime.value = currentTime.value % activeClip.value.duration
        }
        
        emitEvent({ type: 'loop', time: currentTime.value, clipId: activeClip.value.id })
        
        // 触发循环回调
        if (onLoopCallback) {
          onLoopCallback()
        }
      } else {
        currentTime.value = activeClip.value.duration
        // 播放完成，根据 resetOnComplete 选项决定是否重置
        stop(activeClip.value.resetOnComplete)
        return
      }
    } else if (currentTime.value <= 0) {
      if (activeClip.value.loop && playbackDirection.value === 'pingpong') {
        playbackDirection.value = 'forward'
        currentTime.value = 0
        currentLoop.value++
        
        if (activeClip.value.loopCount > 0 && currentLoop.value >= activeClip.value.loopCount) {
          // 循环完成，根据 resetOnComplete 选项决定是否重置
          stop(activeClip.value.resetOnComplete)
          return
        }
        
        emitEvent({ type: 'loop', time: currentTime.value, clipId: activeClip.value.id })
        
        // 触发循环回调
        if (onLoopCallback) {
          onLoopCallback()
        }
      } else if (playbackDirection.value === 'backward') {
        currentTime.value = 0
        // 反向播放完成，根据 resetOnComplete 选项决定是否重置
        stop(activeClip.value.resetOnComplete)
        return
      }
    }
    
    // 应用动画
    applyAnimationAtTime(currentTime.value)
    
    animationFrameId = requestAnimationFrame(tick)
  }
  
  /**
   * 在指定时间应用动画
   */
  function applyAnimationAtTime(time: number, clipId?: string) {
    const clip = clipId 
      ? clips.value.find(c => c.id === clipId)
      : activeClip.value
    
    if (!clip) return
    
    for (const track of clip.tracks) {
      if (!track.enabled || track.keyframes.length === 0) continue
      
      const value = interpolateTrack(track, time)
      if (value !== null) {
        setPropertyValue(track.targetId, track.property, value)
      }
    }
  }
  
  /**
   * 后台剪辑的播放循环
   */
  function backgroundTick(clipId: string) {
    const state = backgroundClips.value.get(clipId)
    if (!state) return
    
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) {
      // 剪辑已删除，停止播放
      stopBackgroundClip(clipId)
      return
    }
    
    const now = performance.now()
    const delta = (now - state.lastFrameTime) / 1000 * state.speed
    state.lastFrameTime = now
    
    // 更新时间
    if (state.direction === 'forward') {
      state.currentTime += delta
    } else if (state.direction === 'backward') {
      state.currentTime -= delta
    }
    
    // 处理边界
    if (state.currentTime >= clip.duration) {
      if (state.loop) {
        state.loopCount++
        if (clip.loopCount > 0 && state.loopCount >= clip.loopCount) {
          // 循环完成
          stopBackgroundClip(clipId)
          if (state.onComplete) state.onComplete()
          return
        }
        
        if (state.direction === 'pingpong') {
          state.direction = 'backward'
          state.currentTime = clip.duration
        } else {
          state.currentTime = state.currentTime % clip.duration
        }
        
        if (state.onLoop) state.onLoop()
      } else {
        state.currentTime = clip.duration
        stopBackgroundClip(clipId)
        if (state.onComplete) state.onComplete()
        return
      }
    } else if (state.currentTime <= 0) {
      if (state.loop && state.direction === 'pingpong') {
        state.direction = 'forward'
        state.currentTime = 0
        state.loopCount++
        
        if (clip.loopCount > 0 && state.loopCount >= clip.loopCount) {
          stopBackgroundClip(clipId)
          if (state.onComplete) state.onComplete()
          return
        }
        
        if (state.onLoop) state.onLoop()
      } else if (state.direction === 'backward') {
        state.currentTime = 0
        stopBackgroundClip(clipId)
        if (state.onComplete) state.onComplete()
        return
      }
    }
    
    // 应用动画
    applyAnimationAtTime(state.currentTime, clipId)
    
    // 继续下一帧
    state.frameId = requestAnimationFrame(() => backgroundTick(clipId))
  }
  
  /**
   * 停止后台播放的剪辑
   */
  function stopBackgroundClip(clipId: string) {
    const state = backgroundClips.value.get(clipId)
    if (!state) {
      backgroundClips.value.delete(clipId)
      return
    }
    if (state.frameId !== null) {
      cancelAnimationFrame(state.frameId)
    }
    backgroundClips.value.delete(clipId)
  }

  // ==================== 事件系统 ====================
  
  /**
   * 添加事件监听器
   */
  function addEventListener(listener: AnimationEventListener) {
    eventListeners.value = [...eventListeners.value, listener]
  }
  
  /**
   * 移除事件监听器
   */
  function removeEventListener(listener: AnimationEventListener) {
    eventListeners.value = eventListeners.value.filter(l => l !== listener)
  }
  
  /**
   * 触发事件
   */
  function emitEvent(event: AnimationEvent) {
    for (const listener of eventListeners.value) {
      try {
        listener(event)
      } catch (e) {
        console.error('Animation event listener error:', e)
      }
    }
  }

  // ==================== 选择操作 ====================
  
  /**
   * 选择关键帧
   */
  function selectKeyframes(keyframeIds: string[], addToSelection = false) {
    if (addToSelection) {
      const newIds = new Set([...timelineSelection.value.keyframeIds, ...keyframeIds])
      timelineSelection.value.keyframeIds = Array.from(newIds)
    } else {
      timelineSelection.value.keyframeIds = keyframeIds
    }
  }
  
  /**
   * 清除选择
   */
  function clearSelection() {
    timelineSelection.value.keyframeIds = []
    timelineSelection.value.trackIds = []
    timelineSelection.value.boxSelect = undefined
  }
  
  /**
   * 删除选中的关键帧
   */
  function deleteSelectedKeyframes(): number {
    let count = 0
    
    for (const kfId of [...timelineSelection.value.keyframeIds]) {
      // 查找包含该关键帧的轨道
      for (const clip of clips.value) {
        for (const track of clip.tracks) {
          if (track.keyframes.some(k => k.id === kfId)) {
            if (deleteKeyframe(track.id, kfId)) {
              count++
            }
            break
          }
        }
      }
    }
    
    clearSelection()
    return count
  }

  // ==================== 保存状态 ====================
  
  /** 上次保存的版本号 */
  const savedVersion = ref(0)
  
  /** 当前数据版本号（每次修改递增） */
  const dataVersion = ref(0)
  
  /** 是否有未保存的更改 */
  const hasUnsavedChanges = computed(() => dataVersion.value !== savedVersion.value)
  
  /** 标记数据已修改 */
  function markDirty() {
    dataVersion.value++
  }
  
  /** 标记数据已保存 */
  function markSaved() {
    savedVersion.value = dataVersion.value
  }

  // ==================== 序列化工具 ====================
  
  /**
   * 序列化动画剪辑（转换 Date 为字符串）
   */
  function serializeClip(clip: AnimationClip): SerializedAnimationClip {
    return {
      ...clip,
      createdAt: clip.createdAt.toISOString(),
      updatedAt: clip.updatedAt.toISOString()
    }
  }
  
  /**
   * 反序列化动画剪辑（转换字符串为 Date）
   */
  function deserializeClip(data: SerializedAnimationClip): AnimationClip {
    return {
      ...data,
      playMode: data.playMode ?? 'manual',  // 兼容旧数据，默认为手动
      enabled: data.enabled ?? true,  // 兼容旧数据，默认为启用
      queueOnAutoPlay: data.queueOnAutoPlay ?? true,  // 兼容旧数据，默认为排队
      resetOnComplete: data.resetOnComplete ?? true,  // 兼容旧数据，默认为重置
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt)
    }
  }

  // ==================== 场景集成 ====================
  
  /**
   * 获取动画数据（用于与场景一起保存）
   */
  function getAnimationData(): AnimationStorageData {
    return {
      version: STORAGE_VERSION,
      clips: clips.value.map(serializeClip),
      activeClipId: activeClipId.value
    }
  }
  
  /**
   * 设置动画数据（用于从场景加载）
   */
  function setAnimationData(data: AnimationStorageData | null): boolean {
    if (!data) {
      clips.value = []
      activeClipId.value = null
      return true
    }
    
    try {
      if (!data.clips || !Array.isArray(data.clips)) {
        throw new Error('Invalid animation data format')
      }
      
      clips.value = data.clips.map(deserializeClip)
      activeClipId.value = data.activeClipId
      
      // 重置版本号
      dataVersion.value = 0
      savedVersion.value = 0
      
      return true
    } catch (e) {
      console.error('[Animation] 设置动画数据失败:', e)
      return false
    }
  }

  // ==================== 动画触发 API ====================
  
  /** 播放完成回调 */
  let onCompleteCallback: (() => void) | null = null
  
  /** 循环完成回调 */
  let onLoopCallback: (() => void) | null = null
  
  /**
   * 获取所有动画剪辑信息（供外部 UI 使用）
   */
  function getClipList(): AnimationClipInfo[] {
    return clips.value.map(clip => {
      const targetIds = new Set<string>()
      for (const track of clip.tracks) {
        targetIds.add(track.targetId)
      }
      
      return {
        id: clip.id,
        name: clip.name,
        duration: clip.duration,
        fps: clip.fps,
        loop: clip.loop,
        trackCount: clip.tracks.length,
        targetIds: Array.from(targetIds)
      }
    })
  }
  
  /**
   * 根据 ID 播放指定剪辑
   */
  function playClip(clipId: string, options: PlayAnimationOptions = {}): boolean {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) {
      console.warn(`[Animation] 找不到剪辑: ${clipId}`)
      return false
    }
    
    // 如果是后台播放，使用独立的播放循环
    if (options.background) {
      // 停止之前的后台播放（如果存在）
      stopBackgroundClip(clipId)
      
      const startTime = options.startTime ?? 0
      const state: BackgroundClipState = {
        clipId,
        currentTime: startTime,
        speed: options.speed ?? 1,
        direction: options.direction ?? 'forward',
        loop: options.loop ?? clip.loop,
        loopCount: 0,
        lastFrameTime: performance.now(),
        onComplete: options.onComplete ?? undefined,
        onLoop: options.onLoop ?? undefined,
        frameId: null
      }
      
      backgroundClips.value.set(clipId, state)
      
      // 应用初始状态
      applyAnimationAtTime(startTime, clipId)
      
      // 开始播放循环
      state.frameId = requestAnimationFrame(() => backgroundTick(clipId))
      
      console.log(`[Animation] 后台播放剪辑: ${clip.name}`, options)
      return true
    }
    
    // 前台播放：设置为活动剪辑
    activeClipId.value = clipId
    
    // 应用选项
    if (options.speed !== undefined) {
      playbackSpeed.value = options.speed
    }
    
    if (options.direction !== undefined) {
      playbackDirection.value = options.direction
    }
    
    // 临时覆盖循环设置
    if (options.loop !== undefined) {
      clip.loop = options.loop
    }
    
    // 设置回调
    onCompleteCallback = options.onComplete ?? null
    onLoopCallback = options.onLoop ?? null
    
    // 跳转到开始时间
    const startTime = options.startTime ?? 0
    seek(startTime)
    
    // 开始播放
    play()
    
    console.log(`[Animation] 播放剪辑: ${clip.name}`, options)
    return true
  }
  
  /**
   * 根据名称播放剪辑
   */
  function playClipByName(name: string, options: PlayAnimationOptions = {}): boolean {
    const clip = clips.value.find(c => c.name === name)
    if (!clip) {
      console.warn(`[Animation] 找不到名为 "${name}" 的剪辑`)
      return false
    }
    return playClip(clip.id, options)
  }
  
  /**
   * 停止当前播放并重置
   */
  function stopAnimation(): void {
    stop()
    onCompleteCallback = null
    onLoopCallback = null
  }
  
  /**
   * 检查指定剪辑是否存在
   */
  function hasClip(clipId: string): boolean {
    return clips.value.some(c => c.id === clipId)
  }
  
  /**
   * 根据名称检查剪辑是否存在
   */
  function hasClipByName(name: string): boolean {
    return clips.value.some(c => c.name === name)
  }
  
  /**
   * 获取指定剪辑信息
   */
  function getClipInfo(clipId: string): AnimationClipInfo | null {
    const clip = clips.value.find(c => c.id === clipId)
    if (!clip) return null
    
    const targetIds = new Set<string>()
    for (const track of clip.tracks) {
      targetIds.add(track.targetId)
    }
    
    return {
      id: clip.id,
      name: clip.name,
      duration: clip.duration,
      fps: clip.fps,
      loop: clip.loop,
      trackCount: clip.tracks.length,
      targetIds: Array.from(targetIds)
    }
  }

  // ==================== 导入导出 ====================
  
  /**
   * 导出动画数据为 JSON
   */
  function exportToJSON(): string {
    return JSON.stringify(getAnimationData(), null, 2)
  }
  
  /**
   * 从 JSON 导入动画数据
   */
  function importFromJSON(json: string): boolean {
    try {
      const data: AnimationStorageData = JSON.parse(json)
      return setAnimationData(data)
    } catch (e) {
      console.error('Failed to import animation data:', e)
      return false
    }
  }

  // ==================== 返回 ====================
  
  return {
    // 数据
    clips,
    activeClipId,
    activeClip,
    
    // 播放状态
    playbackState,
    currentTime,
    playbackSpeed,
    playbackDirection,
    currentLoop,
    isPlaying,
    isPaused,
    playbackStatus,
    
    // 时间轴状态
    timelineView,
    timelineSelection,
    
    // 保存状态
    hasUnsavedChanges,
    markSaved,
    
    // 剪辑管理
    createClip,
    deleteClip,
    updateClip,
    duplicateClip,
    
    // 轨道管理
    addTrack,
    deleteTrack,
    updateTrack,
    findTrack,
    
    // 关键帧管理
    addKeyframe,
    deleteKeyframe,
    updateKeyframe,
    keyframeSelectedObject,
    keyframeSelectedTransform,
    
    // 播放控制
    play,
    pause,
    stop,
    seek,
    goToPreviousKeyframe,
    goToNextKeyframe,
    applyAnimationAtTime,
    
    // 选择操作
    selectKeyframes,
    clearSelection,
    deleteSelectedKeyframes,
    
    // 事件系统
    addEventListener,
    removeEventListener,
    
    // 场景数据集成（用于场景保存/加载）
    getAnimationData,
    setAnimationData,
    
    // 动画触发 API（供外部按钮调用）
    getClipList,
    playClip,
    playClipByName,
    stopAnimation,
    hasClip,
    hasClipByName,
    getClipInfo,
    
    // 导入导出
    exportToJSON,
    importFromJSON
  }
})
