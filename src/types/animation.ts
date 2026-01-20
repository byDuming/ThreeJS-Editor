/**
 * 动画系统类型定义
 * 
 * 设计原则：
 * 1. 数据驱动 - 所有动画数据可序列化
 * 2. 灵活性 - 支持任意属性动画
 * 3. 可扩展 - 支持自定义插值和缓动
 */

// ==================== 核心类型 ====================

/**
 * 动画剪辑 - 包含多个轨道的动画容器
 */
export interface AnimationClip {
  /** 唯一标识 */
  id: string
  /** 剪辑名称 */
  name: string
  /** 总时长（秒） */
  duration: number
  /** 帧率，用于时间轴显示 */
  fps: number
  /** 是否循环播放 */
  loop: boolean
  /** 循环次数（-1 为无限循环） */
  loopCount: number
  /** 播放模式：'auto' 进入场景就播放，'manual' 手动调用 */
  playMode: 'auto' | 'manual'
  /** 播放完成后是否重置到开始位置 */
  resetOnComplete: boolean
  /** 包含的动画轨道 */
  tracks: AnimationTrack[]
  /** 创建时间 */
  createdAt: Date
  /** 更新时间 */
  updatedAt: Date
}

/**
 * 动画轨道 - 控制单个对象的单个属性
 */
export interface AnimationTrack {
  /** 唯一标识 */
  id: string
  /** 目标对象ID */
  targetId: string
  /** 目标属性路径 */
  property: AnimatableProperty
  /** 关键帧列表 */
  keyframes: Keyframe[]
  /** 插值类型 */
  interpolation: InterpolationType
  /** 是否启用 */
  enabled: boolean
  /** 是否锁定（防止编辑） */
  locked: boolean
  /** 轨道颜色（用于UI显示） */
  color?: string
}

/**
 * 关键帧
 */
export interface Keyframe {
  /** 唯一标识 */
  id: string
  /** 时间点（秒） */
  time: number
  /** 值（类型取决于属性） */
  value: KeyframeValue
  /** 缓动函数 */
  easing: EasingType
  /** 贝塞尔控制点（当使用贝塞尔插值时） */
  handles?: BezierHandles
  /** 是否选中（UI状态） */
  selected?: boolean
}

/**
 * 贝塞尔控制点
 */
export interface BezierHandles {
  /** 左控制点（入切线） */
  left: [number, number]
  /** 右控制点（出切线） */
  right: [number, number]
  /** 是否断开左右控制点 */
  broken: boolean
}

// ==================== 属性类型 ====================

/**
 * 可动画的属性路径
 */
export type AnimatableProperty =
  // Transform
  | 'position.x' | 'position.y' | 'position.z'
  | 'rotation.x' | 'rotation.y' | 'rotation.z'
  | 'scale.x' | 'scale.y' | 'scale.z'
  // Visibility
  | 'visible'
  | 'opacity'
  // Material
  | 'material.color'
  | 'material.opacity'
  | 'material.emissive'
  | 'material.emissiveIntensity'
  | 'material.metalness'
  | 'material.roughness'
  // Light
  | 'light.intensity'
  | 'light.color'
  | 'light.distance'
  | 'light.angle'
  // Camera
  | 'camera.fov'
  | 'camera.near'
  | 'camera.far'
  // Custom
  | `userData.${string}`
  | string

/**
 * 关键帧值类型
 */
export type KeyframeValue =
  | number
  | boolean
  | string
  | [number, number, number]  // Vector3
  | [number, number, number, number]  // Quaternion / Color with alpha

/**
 * 属性类型映射
 */
export const PropertyTypeMap: Record<string, 'number' | 'boolean' | 'color' | 'vector3'> = {
  'position.x': 'number',
  'position.y': 'number',
  'position.z': 'number',
  'rotation.x': 'number',
  'rotation.y': 'number',
  'rotation.z': 'number',
  'scale.x': 'number',
  'scale.y': 'number',
  'scale.z': 'number',
  'visible': 'boolean',
  'opacity': 'number',
  'material.color': 'color',
  'material.opacity': 'number',
  'material.emissive': 'color',
  'material.emissiveIntensity': 'number',
  'material.metalness': 'number',
  'material.roughness': 'number',
  'light.intensity': 'number',
  'light.color': 'color',
  'light.distance': 'number',
  'light.angle': 'number',
  'camera.fov': 'number',
  'camera.near': 'number',
  'camera.far': 'number',
}

// ==================== 插值类型 ====================

/**
 * 插值类型
 */
export type InterpolationType =
  | 'linear'      // 线性插值
  | 'step'        // 阶跃（无插值）
  | 'bezier'      // 贝塞尔曲线
  | 'catmullrom'  // Catmull-Rom 样条
  | 'constant'    // 常量（同 step）

/**
 * 插值类型选项（用于UI）
 */
export const InterpolationOptions: Array<{ label: string; value: InterpolationType }> = [
  { label: '线性', value: 'linear' },
  { label: '阶跃', value: 'step' },
  { label: '贝塞尔', value: 'bezier' },
  { label: '样条', value: 'catmullrom' },
]

// ==================== 缓动类型 ====================

/**
 * 缓动函数类型
 */
export type EasingType =
  // 基础
  | 'linear'
  // Quad
  | 'easeInQuad' | 'easeOutQuad' | 'easeInOutQuad'
  // Cubic
  | 'easeInCubic' | 'easeOutCubic' | 'easeInOutCubic'
  // Quart
  | 'easeInQuart' | 'easeOutQuart' | 'easeInOutQuart'
  // Quint
  | 'easeInQuint' | 'easeOutQuint' | 'easeInOutQuint'
  // Sine
  | 'easeInSine' | 'easeOutSine' | 'easeInOutSine'
  // Expo
  | 'easeInExpo' | 'easeOutExpo' | 'easeInOutExpo'
  // Circ
  | 'easeInCirc' | 'easeOutCirc' | 'easeInOutCirc'
  // Back
  | 'easeInBack' | 'easeOutBack' | 'easeInOutBack'
  // Elastic
  | 'easeInElastic' | 'easeOutElastic' | 'easeInOutElastic'
  // Bounce
  | 'easeInBounce' | 'easeOutBounce' | 'easeInOutBounce'

/**
 * 缓动函数选项（用于UI）
 */
export const EasingOptions: Array<{ label: string; value: EasingType; category: string }> = [
  { label: '线性', value: 'linear', category: '基础' },
  // Quad
  { label: '二次方入', value: 'easeInQuad', category: '二次方' },
  { label: '二次方出', value: 'easeOutQuad', category: '二次方' },
  { label: '二次方入出', value: 'easeInOutQuad', category: '二次方' },
  // Cubic
  { label: '三次方入', value: 'easeInCubic', category: '三次方' },
  { label: '三次方出', value: 'easeOutCubic', category: '三次方' },
  { label: '三次方入出', value: 'easeInOutCubic', category: '三次方' },
  // Elastic
  { label: '弹性入', value: 'easeInElastic', category: '弹性' },
  { label: '弹性出', value: 'easeOutElastic', category: '弹性' },
  { label: '弹性入出', value: 'easeInOutElastic', category: '弹性' },
  // Bounce
  { label: '弹跳入', value: 'easeInBounce', category: '弹跳' },
  { label: '弹跳出', value: 'easeOutBounce', category: '弹跳' },
  { label: '弹跳入出', value: 'easeInOutBounce', category: '弹跳' },
  // Back
  { label: '回弹入', value: 'easeInBack', category: '回弹' },
  { label: '回弹出', value: 'easeOutBack', category: '回弹' },
  { label: '回弹入出', value: 'easeInOutBack', category: '回弹' },
]

// ==================== 播放状态 ====================

/**
 * 播放状态
 */
export type PlaybackState = 'stopped' | 'playing' | 'paused'

/**
 * 播放方向
 */
export type PlaybackDirection = 'forward' | 'backward' | 'pingpong'

/**
 * 播放器状态
 */
export interface PlaybackStatus {
  /** 当前状态 */
  state: PlaybackState
  /** 当前时间（秒） */
  currentTime: number
  /** 播放速度 */
  speed: number
  /** 播放方向 */
  direction: PlaybackDirection
  /** 当前循环次数 */
  currentLoop: number
}

// ==================== 时间轴 UI 状态 ====================

/**
 * 时间轴视图状态
 */
export interface TimelineViewState {
  /** 缩放级别 */
  zoom: number
  /** 水平滚动位置（秒） */
  scrollX: number
  /** 垂直滚动位置（像素） */
  scrollY: number
  /** 是否显示帧数（否则显示秒） */
  showFrames: boolean
  /** 是否自动滚动跟随播放头 */
  autoScroll: boolean
  /** 是否吸附到帧 */
  snapToFrames: boolean
  /** 吸附到关键帧 */
  snapToKeyframes: boolean
}

/**
 * 时间轴选择状态
 */
export interface TimelineSelection {
  /** 选中的关键帧ID列表 */
  keyframeIds: string[]
  /** 选中的轨道ID列表 */
  trackIds: string[]
  /** 框选范围（用于拖拽选择） */
  boxSelect?: {
    startTime: number
    endTime: number
    startTrackIndex: number
    endTrackIndex: number
  }
}

// ==================== 工具函数类型 ====================

/**
 * 创建关键帧的参数
 */
export interface CreateKeyframeParams {
  trackId: string
  time: number
  value?: KeyframeValue  // 不传则使用当前值
  easing?: EasingType
}

/**
 * 创建轨道的参数
 */
export interface CreateTrackParams {
  clipId: string
  targetId: string
  property: AnimatableProperty
  interpolation?: InterpolationType
}

/**
 * 创建剪辑的参数
 */
export interface CreateClipParams {
  name: string
  duration?: number
  fps?: number
  loop?: boolean
}

// ==================== 事件类型 ====================

/**
 * 动画事件
 */
export interface AnimationEvent {
  /** 事件类型 */
  type: 'start' | 'end' | 'loop' | 'pause' | 'resume' | 'seek' | 'keyframe'
  /** 当前时间 */
  time: number
  /** 剪辑ID */
  clipId: string
  /** 相关关键帧ID（仅 keyframe 事件） */
  keyframeId?: string
}

/**
 * 动画事件监听器
 */
export type AnimationEventListener = (event: AnimationEvent) => void

// ==================== 动画触发 API ====================

/**
 * 播放动画的选项
 */
export interface PlayAnimationOptions {
  /** 从指定时间开始播放（秒） */
  startTime?: number
  /** 播放速度（默认 1） */
  speed?: number
  /** 是否循环（覆盖剪辑设置） */
  loop?: boolean
  /** 播放方向 */
  direction?: PlaybackDirection
  /** 播放完成后的回调 */
  onComplete?: () => void
  /** 每次循环完成后的回调 */
  onLoop?: () => void
}

/**
 * 动画剪辑信息（用于外部获取可用动画列表）
 */
export interface AnimationClipInfo {
  id: string
  name: string
  duration: number
  fps: number
  loop: boolean
  trackCount: number
  /** 涉及的目标物体ID列表 */
  targetIds: string[]
}

// ==================== 序列化类型 ====================

/**
 * 可序列化的动画剪辑（用于保存/加载）
 */
export interface SerializedAnimationClip {
  id: string
  name: string
  duration: number
  fps: number
  loop: boolean
  loopCount: number
  playMode?: 'auto' | 'manual'  // 可选以兼容旧数据
  resetOnComplete?: boolean  // 可选以兼容旧数据
  tracks: AnimationTrack[]
  createdAt: string  // ISO 日期字符串
  updatedAt: string  // ISO 日期字符串
}

/**
 * 动画数据存储格式
 */
export interface AnimationStorageData {
  version: string
  clips: SerializedAnimationClip[]
  activeClipId: string | null
}

// ==================== 默认值 ====================

/**
 * 默认剪辑配置
 */
export const DEFAULT_CLIP: Omit<AnimationClip, 'id' | 'createdAt' | 'updatedAt'> = {
  name: '新动画',
  duration: 5,
  fps: 30,
  loop: false,
  loopCount: -1,
  playMode: 'manual',
  resetOnComplete: true,
  tracks: []
}

/**
 * 默认轨道配置
 */
export const DEFAULT_TRACK: Omit<AnimationTrack, 'id' | 'targetId' | 'property'> = {
  keyframes: [],
  interpolation: 'linear',
  enabled: true,
  locked: false
}

/**
 * 默认关键帧配置
 */
export const DEFAULT_KEYFRAME: Omit<Keyframe, 'id' | 'time' | 'value'> = {
  easing: 'linear'
}

/**
 * 默认时间轴视图状态
 */
export const DEFAULT_TIMELINE_VIEW: TimelineViewState = {
  zoom: 1,
  scrollX: 0,
  scrollY: 0,
  showFrames: false,
  autoScroll: true,
  snapToFrames: true,
  snapToKeyframes: true
}
