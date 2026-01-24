import Stats from 'stats.js'
import { ref, shallowRef, readonly } from 'vue'
import type { WebGLRenderer } from 'three'
import type { WebGPURenderer } from 'three/webgpu'

/**
 * 场景统计信息接口
 */
export interface SceneInfo {
  /** 三角面数量 */
  triangles: number
  /** 几何体数量 */
  geometries: number
  /** 纹理数量 */
  textures: number
  /** 绘制调用次数 */
  calls: number
  /** 着色器程序数量 */
  programs: number
  /** 点数量 */
  points: number
  /** 线段数量 */
  lines: number
}

/**
 * 性能监控 Composable
 * 
 * 提供：
 * - stats.js 的 FPS/MS/MB 监控
 * - Three.js renderer.info 的场景统计
 */
export function useStats() {
  const stats = shallowRef<Stats | null>(null)
  const enabled = ref(false)
  const sceneInfo = ref<SceneInfo>({
    triangles: 0,
    geometries: 0,
    textures: 0,
    calls: 0,
    programs: 0,
    points: 0,
    lines: 0
  })

  /**
   * 初始化 Stats.js
   * @param panel 初始面板类型: 0=FPS, 1=MS, 2=MB
   */
  function initStats(panel: 0 | 1 | 2 = 0): Stats {
    if (stats.value) {
      return stats.value
    }
    
    const s = new Stats()
    s.showPanel(panel)
    
    // 设置样式：右上角定位
    s.dom.style.cssText = 'position:relative;'
    
    stats.value = s
    enabled.value = true
    
    return s
  }

  /**
   * 销毁 Stats.js
   */
  function destroyStats() {
    if (stats.value) {
      stats.value.dom.remove()
      stats.value = null
      enabled.value = false
    }
  }

  /**
   * 获取 Stats DOM 元素
   */
  function getStatsDom(): HTMLDivElement | null {
    return stats.value?.dom ?? null
  }

  /**
   * 开始帧计时（在渲染循环开始时调用）
   */
  function begin() {
    stats.value?.begin()
  }

  /**
   * 结束帧计时（在渲染循环结束时调用）
   */
  function end() {
    stats.value?.end()
  }

  /**
   * 切换显示面板
   * @param panel 面板类型: 0=FPS, 1=MS, 2=MB
   */
  function showPanel(panel: 0 | 1 | 2) {
    stats.value?.showPanel(panel)
  }

  /**
   * 从 renderer.info 更新场景统计信息
   * @param renderer Three.js 渲染器
   */
  function updateSceneInfo(renderer: WebGLRenderer | WebGPURenderer | null) {
    if (!renderer) return

    const info = renderer.info

    sceneInfo.value = {
      triangles: info.render?.triangles ?? 0,
      geometries: info.memory?.geometries ?? 0,
      textures: info.memory?.textures ?? 0,
      calls: info.render?.calls ?? 0,
      programs: (info as any).programs?.length ?? 0,
      points: info.render?.points ?? 0,
      lines: info.render?.lines ?? 0
    }
  }

  /**
   * 格式化数字显示（添加千位分隔符）
   */
  function formatNumber(num: number): string {
    return num.toLocaleString('en-US')
  }

  return {
    // 状态
    stats: readonly(stats),
    enabled: readonly(enabled),
    sceneInfo: readonly(sceneInfo),
    
    // 方法
    initStats,
    destroyStats,
    getStatsDom,
    begin,
    end,
    showPanel,
    updateSceneInfo,
    formatNumber
  }
}

// 创建全局单例
let globalStatsInstance: ReturnType<typeof useStats> | null = null

/**
 * 获取全局 Stats 单例
 */
export function useGlobalStats(): ReturnType<typeof useStats> {
  if (!globalStatsInstance) {
    globalStatsInstance = useStats()
  }
  return globalStatsInstance
}
