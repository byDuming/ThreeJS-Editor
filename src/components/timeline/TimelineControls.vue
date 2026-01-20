<script setup lang="ts">
/**
 * 时间轴控制栏组件
 */

import { useAnimationStore } from '@/stores/modules/useAnimation.store'

const props = defineProps<{
  currentTime: number
  duration: number
  isPlaying: boolean
  formatTime: (seconds: number) => string
  hasSelectedKeyframes: boolean
}>()

const emit = defineEmits<{
  (e: 'play'): void
  (e: 'pause'): void
  (e: 'stop'): void
  (e: 'go-to-start'): void
  (e: 'go-to-end'): void
  (e: 'prev-keyframe'): void
  (e: 'next-keyframe'): void
  (e: 'add-keyframe'): void
  (e: 'delete-keyframe'): void
  (e: 'zoom-in'): void
  (e: 'zoom-out'): void
}>()

const animationStore = useAnimationStore()

// 播放速度选项
const speedOptions = [
  { label: '0.25x', value: 0.25 },
  { label: '0.5x', value: 0.5 },
  { label: '1x', value: 1 },
  { label: '1.5x', value: 1.5 },
  { label: '2x', value: 2 },
]

// 播放模式选项
const playModeOptions = [
  { label: '进入场景播放', value: 'auto' },
  { label: '手动调用', value: 'manual' },
]
</script>

<template>
  <div class="timeline-controls">
    <!-- 左侧：播放控制 -->
    <div class="control-group">
      <!-- 跳到开始 -->
      <n-button quaternary size="small" @click="emit('go-to-start')" title="跳到开始">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h2v12H6V6zm3.5 6l8.5 6V6l-8.5 6z"/>
          </svg>
        </template>
      </n-button>
      
      <!-- 上一个关键帧 -->
      <n-button quaternary size="small" @click="emit('prev-keyframe')" title="上一个关键帧 (Shift+←)">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 16.59L10.83 12l4.58-4.59L14 6l-6 6 6 6 1.41-1.41z"/>
          </svg>
        </template>
      </n-button>
      
      <!-- 播放/暂停 -->
      <n-button quaternary size="small" @click="isPlaying ? emit('pause') : emit('play')" title="播放/暂停 (Space)">
        <template #icon>
          <svg v-if="!isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7L8 5z"/>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
          </svg>
        </template>
      </n-button>
      
      <!-- 停止 -->
      <n-button quaternary size="small" @click="emit('stop')" title="停止">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 6h12v12H6V6z"/>
          </svg>
        </template>
      </n-button>
      
      <!-- 下一个关键帧 -->
      <n-button quaternary size="small" @click="emit('next-keyframe')" title="下一个关键帧 (Shift+→)">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
          </svg>
        </template>
      </n-button>
      
      <!-- 跳到结束 -->
      <n-button quaternary size="small" @click="emit('go-to-end')" title="跳到结束">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 18l8.5-6L6 6v12zm2-12v12h2V6h-2zm8.5 6L8 6v12l8.5-6z" transform="scale(-1,1) translate(-24,0)"/>
          </svg>
        </template>
      </n-button>
    </div>
    
    <!-- 中间：时间显示 -->
    <div class="time-display">
      <span class="current-time">{{ formatTime(currentTime) }}</span>
      <span class="time-separator">/</span>
      <span class="total-time">{{ formatTime(duration) }}</span>
    </div>
    
    <!-- 右侧：其他控制 -->
    <div class="control-group">
      <!-- 添加关键帧 -->
      <n-button quaternary size="small" @click="emit('add-keyframe')" title="添加关键帧 (K)">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2L2 12l10 10 10-10L12 2zm0 15l-5-5 5-5 5 5-5 5z"/>
          </svg>
        </template>
        添加
      </n-button>
      
      <!-- 删除关键帧 -->
      <n-button 
        quaternary 
        size="small" 
        :disabled="!hasSelectedKeyframes"
        @click="emit('delete-keyframe')" 
        title="删除选中关键帧 (Delete)"
      >
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
          </svg>
        </template>
        删除
      </n-button>
      
      <!-- 循环切换 -->
      <n-button 
        quaternary 
        size="small" 
        :type="animationStore.activeClip?.loop ? 'primary' : 'default'"
        @click="animationStore.activeClip && animationStore.updateClip(animationStore.activeClip.id, { loop: !animationStore.activeClip.loop })"
        title="循环播放"
      >
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
        </template>
      </n-button>
      
      <!-- 播放完成后重置 -->
      <n-tooltip>
        <template #trigger>
          <n-switch
            v-if="animationStore.activeClip"
            :value="animationStore.activeClip.resetOnComplete"
            size="small"
            @update:value="(value: boolean) => animationStore.activeClip && animationStore.updateClip(animationStore.activeClip.id, { resetOnComplete: value })"
          />
        </template>
        {{ animationStore.activeClip?.resetOnComplete ? '播放完成后重置' : '播放完成后不重置' }}
      </n-tooltip>
      <span v-if="animationStore.activeClip" class="reset-label" :title="animationStore.activeClip.resetOnComplete ? '播放完成后重置到开始' : '播放完成后保持在结束位置'">
        {{ animationStore.activeClip.resetOnComplete ? '重置' : '保持' }}
      </span>
      
      <!-- 播放模式 -->
      <n-select
        v-if="animationStore.activeClip"
        :value="animationStore.activeClip.playMode"
        :options="playModeOptions"
        size="small"
        style="width: 120px"
        @update:value="(value: 'auto' | 'manual') => animationStore.activeClip && animationStore.updateClip(animationStore.activeClip.id, { playMode: value })"
        title="播放模式"
      />
      
      <!-- 播放速度 -->
      <n-select
        v-model:value="animationStore.playbackSpeed"
        :options="speedOptions"
        size="small"
        style="width: 80px"
      />
      
      <!-- 分隔线 -->
      <n-divider vertical />
      
      <!-- 缩放控制 -->
      <n-button quaternary size="small" @click="emit('zoom-out')" title="缩小">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13H5v-2h14v2z"/>
          </svg>
        </template>
      </n-button>
      
      <span class="zoom-level">{{ Math.round(animationStore.timelineView.zoom * 100) }}%</span>
      
      <n-button quaternary size="small" @click="emit('zoom-in')" title="放大">
        <template #icon>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
          </svg>
        </template>
      </n-button>
    </div>
  </div>
</template>

<style scoped>
.timeline-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  gap: 16px;
}

.control-group {
  display: flex;
  align-items: center;
  gap: 4px;
}

.time-display {
  font-family: monospace;
  font-size: 13px;
  color: #333;
}

.current-time {
  color: #1976d2;
}

.time-separator {
  margin: 0 4px;
  color: #999;
}

.total-time {
  color: #666;
}

.zoom-level {
  font-size: 11px;
  color: #666;
  min-width: 40px;
  text-align: center;
}

.reset-label {
  font-size: 11px;
  color: #666;
  margin-left: 4px;
  white-space: nowrap;
}
</style>
