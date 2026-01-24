<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useGlobalStats } from '@/composables/useStats'
import { SpeedometerOutline, TriangleOutline, ImagesOutline, CodeSlashOutline, EllipseOutline, HelpCircleOutline } from '@vicons/ionicons5'

const globalStats = useGlobalStats()
const statsContainer = ref<HTMLDivElement | null>(null)
const collapsed = ref(false)

// 格式化大数字
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(2) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// 图标统一浅色
const iconColor = 'rgba(255, 255, 255, 0.7)'

// 场景统计数据
const sceneStats = computed(() => [
  { 
    label: '三角面', 
    value: formatNumber(globalStats.sceneInfo.value.triangles),
    unit: '',
    icon: TriangleOutline,
    color: iconColor,
    help: '每帧渲染的三角面总数。三角面是 3D 渲染的基本单位，数量越多 GPU 负担越大。建议：移动端 < 100K，桌面端 < 1M，超过可能导致卡顿。'
  },
  { 
    label: '绘制调用', 
    value: globalStats.sceneInfo.value.calls.toString(),
    unit: '次/帧',
    icon: SpeedometerOutline,
    color: iconColor,
    help: '每帧 GPU 绘制调用次数 (Draw Calls)。每个不同材质/网格组合通常需要一次调用。调用次数过多会导致 CPU 瓶颈。建议：< 100 为优，< 500 可接受，> 1000 需要优化（合并网格、使用实例化）。'
  },
  { 
    label: '几何体', 
    value: globalStats.sceneInfo.value.geometries.toString(),
    unit: '个',
    icon: EllipseOutline,
    color: iconColor,
    help: '显存中的几何体数量。每个几何体占用显存存储顶点、法线、UV 等数据。相同形状的物体应共享几何体以节省内存。'
  },
  { 
    label: '纹理', 
    value: globalStats.sceneInfo.value.textures.toString(),
    unit: '张',
    icon: ImagesOutline,
    color: iconColor,
    help: '显存中的纹理数量。纹理是显存消耗的主要来源，一张 2048x2048 RGBA 纹理约占 16MB。建议：使用纹理压缩、合理的 mipmap、纹理图集来优化。'
  },
  { 
    label: '着色器', 
    value: globalStats.sceneInfo.value.programs.toString(),
    unit: '个',
    icon: CodeSlashOutline,
    color: iconColor,
    help: '编译后的着色器程序数量。每种不同的材质配置会生成一个着色器程序。程序切换有开销，数量过多会影响性能。建议：尽量复用材质，减少材质变体。'
  }
])

onMounted(() => {
  // 初始化 stats.js
  globalStats.initStats(0)
  
  // 挂载 stats.js DOM 到容器
  const dom = globalStats.getStatsDom()
  if (dom && statsContainer.value) {
    statsContainer.value.appendChild(dom)
  }
})

onBeforeUnmount(() => {
  // 移除 stats.js DOM
  const dom = globalStats.getStatsDom()
  if (dom && dom.parentElement) {
    dom.parentElement.removeChild(dom)
  }
})

function toggleCollapse() {
  collapsed.value = !collapsed.value
}

// 切换 stats.js 面板显示模式
function cyclePanel() {
  const panels = [0, 1, 2] as const
  const dom = globalStats.getStatsDom()
  if (dom) {
    // 点击 stats.js 的 canvas 来切换面板
    dom.click()
  }
}
</script>

<template>
  <div class="stats-panel" :class="{ collapsed }">
    <!-- 头部 -->
    <div class="stats-header" @click="toggleCollapse">
      <span class="stats-title">性能监控</span>
      <n-button quaternary size="tiny" class="collapse-btn">
        <template #icon>
          <n-icon>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path v-if="collapsed" d="m6 9 6 6 6-6"/>
              <path v-else d="m18 15-6-6-6 6"/>
            </svg>
          </n-icon>
        </template>
      </n-button>
    </div>

    <!-- 内容区 -->
    <div v-show="!collapsed" class="stats-content">
      <!-- Stats.js 面板 -->
      <div class="stats-js-container" ref="statsContainer" @click="cyclePanel"></div>
      
      <!-- 分隔线 -->
      <n-divider style="margin: 8px 0" />
      
      <!-- 场景统计 -->
      <div class="scene-stats">
        <div 
          v-for="stat in sceneStats" 
          :key="stat.label" 
          class="stat-item"
        >
          <n-icon :style="{ color: stat.color }" size="14">
            <component :is="stat.icon" />
          </n-icon>
          <span class="stat-label">{{ stat.label }}</span>
          <n-tooltip trigger="hover" placement="right" :style="{ maxWidth: '280px' }">
            <template #trigger>
              <n-icon class="help-icon" size="12">
                <HelpCircleOutline />
              </n-icon>
            </template>
            <div class="help-content">{{ stat.help }}</div>
          </n-tooltip>
          <span class="stat-value">{{ stat.value }}<span class="stat-unit">{{ stat.unit }}</span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.stats-panel {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 100;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 8px;
  backdrop-filter: blur(10px);
  min-width: 160px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.stats-panel.collapsed {
  min-width: auto;
}

.stats-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  cursor: pointer;
  background: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  transition: background 0.2s;
}

.stats-header:hover {
  background: rgba(255, 255, 255, 0.1);
}

.stats-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.9);
  user-select: none;
}

.collapse-btn {
  color: rgba(255, 255, 255, 0.7);
  padding: 0;
  min-width: 20px;
  height: 20px;
}

.stats-content {
  padding: 8px;
}

.stats-js-container {
  display: flex;
  justify-content: center;
  cursor: pointer;
}

.stats-js-container :deep(canvas) {
  border-radius: 4px;
}

.scene-stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 6px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  transition: background 0.2s;
}

.stat-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.stat-item .stat-value {
  margin-left: auto;
}

.stat-label {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.7);
}

.help-icon {
  color: rgba(255, 255, 255, 0.4);
  cursor: help;
  margin-left: 2px;
  flex-shrink: 0;
  transition: color 0.2s;
}

.help-icon:hover {
  color: rgba(255, 255, 255, 0.8);
}

.help-content {
  font-size: 12px;
  line-height: 1.5;
}

.stat-value {
  font-size: 12px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.95);
  font-family: 'Monaco', 'Menlo', monospace;
}

.stat-unit {
  font-size: 10px;
  font-weight: 400;
  color: rgba(255, 255, 255, 0.6);
  margin-left: 2px;
}
</style>
