<script setup lang="ts">
/**
 * 时间轴主组件
 * 
 * 功能：
 * - 动画播放控制
 * - 时间刻度显示
 * - 轨道和关键帧编辑
 * - 播放指针
 */

import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useAnimationStore } from '@/stores/modules/useAnimation.store'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { useMessage, useDialog } from 'naive-ui'
import TimelineHeader from './TimelineHeader.vue'
import TimelineTrack from './TimelineTrack.vue'
import TimelineControls from './TimelineControls.vue'

const animationStore = useAnimationStore()
const sceneStore = useSceneStore()
const message = useMessage()
const dialog = useDialog()

// 剪辑名称编辑状态
const editingClipId = ref<string | null>(null)
const editingClipName = ref('')

// 删除关键帧（带反馈）
function handleDeleteKeyframe() {
  const count = animationStore.timelineSelection.keyframeIds.length
  if (count === 0) {
    message.warning('请先选择要删除的关键帧')
    return
  }
  
  const deleted = animationStore.deleteSelectedKeyframes()
  if (deleted > 0) {
    message.success(`已删除 ${deleted} 个关键帧`)
  }
}

// 删除轨道（带反馈）
function handleDeleteTrack(trackId: string, propertyName: string) {
  if (!animationStore.activeClip) return
  
  const success = animationStore.deleteTrack(animationStore.activeClip.id, trackId)
  if (success) {
    message.success(`已删除轨道: ${propertyName}`)
  } else {
    message.error('删除轨道失败')
  }
}

// 删除物体的所有轨道（带反馈）
function handleDeleteObjectTracks(_objectId: string, objectName: string, tracks: Array<{ id: string }>) {
  if (!animationStore.activeClip) return
  
  let deletedCount = 0
  for (const track of tracks) {
    if (animationStore.deleteTrack(animationStore.activeClip.id, track.id)) {
      deletedCount++
    }
  }
  
  if (deletedCount > 0) {
    message.success(`已删除 ${objectName} 的 ${deletedCount} 条轨道`)
  } else {
    message.error('删除轨道失败')
  }
}

// 添加关键帧（带反馈）
function handleAddKeyframe() {
  if (!animationStore.activeClip) {
    message.warning('请先创建动画剪辑')
    return
  }
  
  if (!sceneStore.selectedObjectId) {
    message.warning('请先在场景中选择一个物体')
    return
  }
  
  // 调试信息
  const selectedId = sceneStore.selectedObjectId
  const objData = sceneStore.objectDataList.find(o => o.id === selectedId)
  console.log('=== 添加关键帧调试 ===')
  console.log('选中物体ID:', selectedId)
  console.log('物体数据:', objData)
  console.log('物体transform:', objData?.transform)
  console.log('当前时间:', animationStore.currentTime)
  console.log('活动剪辑:', animationStore.activeClip?.id)
  
  const keyframes = animationStore.keyframeSelectedTransform()
  
  if (keyframes.length > 0) {
    message.success(`已在 ${animationStore.currentTime.toFixed(2)}s 添加 ${keyframes.length} 个关键帧`)
    console.log('添加的关键帧:', keyframes)
    console.log('当前轨道:', animationStore.activeClip?.tracks)
  } else {
    message.error('添加关键帧失败，请查看控制台获取详细信息')
    console.log('关键帧添加失败！检查以上调试信息')
  }
}

// 时间轴容器引用
const timelineContainer = ref<HTMLElement | null>(null)
// 左侧标签列表引用
const trackLabelsList = ref<HTMLElement | null>(null)

// 拖拽状态
const isDraggingCursor = ref(false)

// 滚动同步标志（防止循环更新）
const isSyncingScroll = ref(false)

// 计算像素到时间的转换
const pixelsPerSecond = computed(() => 100 * animationStore.timelineView.zoom)

// 物体颜色调色板
const objectColors = [
  '#4a90d9', // 蓝色
  '#e67e22', // 橙色
  '#27ae60', // 绿色
  '#9b59b6', // 紫色
  '#e74c3c', // 红色
  '#1abc9c', // 青色
  '#f39c12', // 黄色
  '#3498db', // 天蓝色
]

// 折叠状态
const collapsedGroups = ref<Set<string>>(new Set())

// 切换物体组折叠状态
function toggleGroupCollapse(objectId: string) {
  if (collapsedGroups.value.has(objectId)) {
    collapsedGroups.value.delete(objectId)
  } else {
    collapsedGroups.value.add(objectId)
  }
}

// 当前剪辑的轨道，按目标对象分组
const groupedTracks = computed(() => {
  if (!animationStore.activeClip) return []
  
  const groups: Array<{
    objectId: string
    objectName: string
    color: string
    tracks: typeof animationStore.activeClip.tracks
    collapsed: boolean
  }> = []
  
  const objectMap = new Map<string, typeof animationStore.activeClip.tracks>()
  
  for (const track of animationStore.activeClip.tracks) {
    if (!objectMap.has(track.targetId)) {
      objectMap.set(track.targetId, [])
    }
    objectMap.get(track.targetId)!.push(track)
  }
  
  let colorIndex = 0
  for (const [objectId, tracks] of objectMap) {
    const objData = sceneStore.objectDataList.find(o => o.id === objectId)
    groups.push({
      objectId,
      objectName: objData?.name ?? objectId,
      color: objectColors[colorIndex % objectColors.length] ?? '#4a90d9',
      tracks,
      collapsed: collapsedGroups.value.has(objectId)
    })
    colorIndex++
  }
  
  return groups
})

// 时间轴宽度（根据剪辑时长和缩放）
const timelineWidth = computed(() => {
  if (!animationStore.activeClip) return 1000
  return animationStore.activeClip.duration * pixelsPerSecond.value + 200 // 额外200px空间
})

// 播放指针位置
const cursorPosition = computed(() => {
  return animationStore.currentTime * pixelsPerSecond.value
})

// 像素到时间
function pixelsToTime(pixels: number): number {
  return pixels / pixelsPerSecond.value
}

// 处理时间轴点击（跳转到指定时间）
function handleTimelineClick(event: MouseEvent) {
  if (!timelineContainer.value || !animationStore.activeClip) return
  
  const rect = timelineContainer.value.getBoundingClientRect()
  // 使用实际滚动位置而不是 store 中的值
  const scrollLeft = timelineContainer.value.scrollLeft
  const x = event.clientX - rect.left + scrollLeft
  const time = pixelsToTime(x)
  
  animationStore.seek(Math.max(0, Math.min(time, animationStore.activeClip.duration)))
}

// 处理播放指针拖拽
function handleCursorDragStart(_event: MouseEvent) {
  isDraggingCursor.value = true
  document.addEventListener('mousemove', handleCursorDrag)
  document.addEventListener('mouseup', handleCursorDragEnd)
}

function handleCursorDrag(event: MouseEvent) {
  if (!isDraggingCursor.value || !timelineContainer.value || !animationStore.activeClip) return
  
  const rect = timelineContainer.value.getBoundingClientRect()
  // 使用实际滚动位置而不是 store 中的值
  const scrollLeft = timelineContainer.value.scrollLeft
  const x = event.clientX - rect.left + scrollLeft
  const time = pixelsToTime(x)
  
  animationStore.seek(Math.max(0, Math.min(time, animationStore.activeClip.duration)))
}

function handleCursorDragEnd() {
  isDraggingCursor.value = false
  document.removeEventListener('mousemove', handleCursorDrag)
  document.removeEventListener('mouseup', handleCursorDragEnd)
}

// 缩放控制
function handleZoom(delta: number) {
  const newZoom = Math.max(0.1, Math.min(10, animationStore.timelineView.zoom + delta * 0.1))
  animationStore.timelineView.zoom = newZoom
}

// 滚轮缩放
function handleWheel(event: WheelEvent) {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault()
    handleZoom(-event.deltaY / 100)
  }
}

// 键盘快捷键
function handleKeyDown(event: KeyboardEvent) {
  if (event.target !== document.body) return
  
  switch (event.code) {
    case 'Space':
      event.preventDefault()
      if (animationStore.isPlaying) {
        animationStore.pause()
      } else {
        animationStore.play()
      }
      break
    case 'Home':
      animationStore.seek(0)
      break
    case 'End':
      if (animationStore.activeClip) {
        animationStore.seek(animationStore.activeClip.duration)
      }
      break
    case 'ArrowLeft':
      if (event.shiftKey) {
        animationStore.goToPreviousKeyframe()
      } else {
        animationStore.seek(animationStore.currentTime - 1 / 30)
      }
      break
    case 'ArrowRight':
      if (event.shiftKey) {
        animationStore.goToNextKeyframe()
      } else {
        animationStore.seek(animationStore.currentTime + 1 / 30)
      }
      break
    case 'KeyK':
      // 添加关键帧
      handleAddKeyframe()
      break
    case 'Delete':
    case 'Backspace':
      animationStore.deleteSelectedKeyframes()
      break
  }
}

// 格式化时间显示
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  const frames = Math.floor((seconds % 1) * (animationStore.activeClip?.fps ?? 30))
  
  if (animationStore.timelineView.showFrames) {
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toFixed(2).padStart(5, '0')}`
}

// 创建新剪辑
function handleCreateClip() {
  const name = `动画 ${animationStore.clips.length + 1}`
  animationStore.createClip({ name })
  message.success(`已创建动画剪辑: ${name}`)
}

// 删除当前剪辑
function handleDeleteClip() {
  if (!animationStore.activeClip) return
  
  const clipName = animationStore.activeClip.name
  dialog.warning({
    title: '确认删除',
    content: `确定要删除动画剪辑 "${clipName}" 吗？此操作不可撤销。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: () => {
      animationStore.deleteClip(animationStore.activeClip!.id)
      message.success(`已删除动画剪辑: ${clipName}`)
    }
  })
}

// 切换活动剪辑
function handleSwitchClip(clipId: string | null) {
  if (clipId) {
    // 停止当前播放
    animationStore.stop()
    // 切换到新剪辑
    animationStore.activeClipId = clipId
    // 重置时间到开始
    animationStore.seek(0)
  }
}

// 开始编辑剪辑名称
function handleStartEditClipName(clip: { id: string; name: string }) {
  editingClipId.value = clip.id
  editingClipName.value = clip.name
}

// 完成编辑剪辑名称
function handleFinishEditClipName() {
  if (editingClipId.value && editingClipName.value.trim()) {
    animationStore.updateClip(editingClipId.value, { name: editingClipName.value.trim() })
    message.success('已更新剪辑名称')
  }
  editingClipId.value = null
  editingClipName.value = ''
}

// 取消编辑剪辑名称
function handleCancelEditClipName() {
  editingClipId.value = null
  editingClipName.value = ''
}

// 剪辑选项（用于下拉选择器）
const clipOptions = computed(() => 
  animationStore.clips.map(clip => ({
    label: clip.name,
    value: clip.id
  }))
)

// 处理右侧时间轴容器的滚动（同步到左侧标签列表和更新 store）
function handleTimelineScroll() {
  if (!timelineContainer.value || isSyncingScroll.value) return
  
  isSyncingScroll.value = true
  
  const scrollLeft = timelineContainer.value.scrollLeft
  const scrollTop = timelineContainer.value.scrollTop
  
  // 同步左侧标签列表的垂直滚动
  if (trackLabelsList.value) {
    trackLabelsList.value.scrollTop = scrollTop
  }
  
  // 更新 store 中的滚动位置
  animationStore.timelineView.scrollX = scrollLeft
  animationStore.timelineView.scrollY = scrollTop
  
  isSyncingScroll.value = false
}

// 处理左侧标签列表的滚动（同步到右侧时间轴容器）
function handleLabelsScroll() {
  if (!trackLabelsList.value || !timelineContainer.value || isSyncingScroll.value) return
  
  isSyncingScroll.value = true
  
  const scrollTop = trackLabelsList.value.scrollTop
  
  // 同步右侧时间轴容器的垂直滚动
  timelineContainer.value.scrollTop = scrollTop
  
  // 更新 store 中的垂直滚动位置
  animationStore.timelineView.scrollY = scrollTop
  
  isSyncingScroll.value = false
}

// 设置滚动监听器
function setupScrollListeners() {
  if (timelineContainer.value) {
    timelineContainer.value.addEventListener('scroll', handleTimelineScroll)
  }
  if (trackLabelsList.value) {
    trackLabelsList.value.addEventListener('scroll', handleLabelsScroll)
  }
}

// 移除滚动监听器
function removeScrollListeners() {
  if (timelineContainer.value) {
    timelineContainer.value.removeEventListener('scroll', handleTimelineScroll)
  }
  if (trackLabelsList.value) {
    trackLabelsList.value.removeEventListener('scroll', handleLabelsScroll)
  }
}

// 监听 ref 变化，确保在 DOM 元素可用时添加监听器
watch([timelineContainer, trackLabelsList], () => {
  nextTick(() => {
    removeScrollListeners()
    setupScrollListeners()
  })
}, { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  setupScrollListeners()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  removeScrollListeners()
})
</script>

<template>
  <div class="timeline-container" @wheel="handleWheel">
    <!-- 剪辑管理栏 -->
    <div class="clip-manager" v-if="animationStore.clips.length > 0 || !animationStore.activeClip">
      <div class="clip-manager-left">
        <n-select
          v-if="animationStore.clips.length > 0"
          :value="animationStore.activeClipId"
          :options="clipOptions"
          size="small"
          style="width: 200px"
          placeholder="选择动画剪辑"
          @update:value="handleSwitchClip"
        />
        <span v-else class="no-clips-hint">暂无动画剪辑</span>
      </div>
      <div class="clip-manager-right">
        <n-button 
          quaternary 
          size="small" 
          @click="handleCreateClip"
          title="创建新动画剪辑"
        >
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
          </template>
          新建
        </n-button>
        <n-button 
          v-if="animationStore.activeClip"
          quaternary 
          size="small" 
          @click="handleStartEditClipName(animationStore.activeClip)"
          title="重命名"
        >
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
            </svg>
          </template>
        </n-button>
        <n-button 
          v-if="animationStore.activeClip"
          quaternary 
          size="small" 
          @click="handleDeleteClip"
          title="删除当前剪辑"
        >
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
            </svg>
          </template>
        </n-button>
      </div>
    </div>
    
    <!-- 剪辑名称编辑对话框 -->
    <div v-if="editingClipId && animationStore.activeClip && editingClipId === animationStore.activeClip.id" class="clip-name-editor">
      <span class="edit-label">重命名:</span>
      <n-input
        v-model:value="editingClipName"
        size="small"
        placeholder="输入剪辑名称"
        @keyup.enter="handleFinishEditClipName"
        @keyup.esc="handleCancelEditClipName"
        style="width: 200px"
        autofocus
      />
      <n-button size="small" type="primary" @click="handleFinishEditClipName">确定</n-button>
      <n-button size="small" @click="handleCancelEditClipName">取消</n-button>
    </div>
    
    <!-- 顶部控制栏 -->
    <TimelineControls 
      :current-time="animationStore.currentTime"
      :duration="animationStore.activeClip?.duration ?? 0"
      :is-playing="animationStore.isPlaying"
      :format-time="formatTime"
      :has-selected-keyframes="animationStore.timelineSelection.keyframeIds.length > 0"
      @play="animationStore.play()"
      @pause="animationStore.pause()"
      @stop="animationStore.stop()"
      @go-to-start="animationStore.seek(0)"
      @go-to-end="animationStore.activeClip && animationStore.seek(animationStore.activeClip.duration)"
      @prev-keyframe="animationStore.goToPreviousKeyframe()"
      @next-keyframe="animationStore.goToNextKeyframe()"
      @add-keyframe="handleAddKeyframe"
      @delete-keyframe="handleDeleteKeyframe"
      @zoom-in="handleZoom(1)"
      @zoom-out="handleZoom(-1)"
    />
    
    <!-- 时间轴主体 -->
    <div class="timeline-body" v-if="animationStore.activeClip">
      <!-- 左侧轨道标签 -->
      <div class="track-labels">
        <div class="track-labels-header">轨道</div>
        <div class="track-labels-list" ref="trackLabelsList">
          <template v-for="group in groupedTracks" :key="group.objectId">
            <div 
              class="track-group-header"
              @click="toggleGroupCollapse(group.objectId)"
            >
              <div class="group-color-bar" :style="{ backgroundColor: group.color }"></div>
              <svg 
                class="collapse-icon" 
                :class="{ collapsed: group.collapsed }"
                width="12" height="12" viewBox="0 0 24 24" fill="currentColor"
              >
                <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
              </svg>
              <span class="object-name">{{ group.objectName }}</span>
              <span class="track-count">({{ group.tracks.length }})</span>
              <button 
                class="group-delete-btn"
                title="删除该物体的所有轨道"
                @click.stop="handleDeleteObjectTracks(group.objectId, group.objectName, group.tracks)"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                </svg>
              </button>
            </div>
            <template v-if="!group.collapsed">
              <div 
                v-for="track in group.tracks" 
                :key="track.id"
                class="track-label"
                :class="{ disabled: !track.enabled }"
              >
                <div class="track-color-dot" :style="{ backgroundColor: group.color }"></div>
                <span class="property-name">{{ track.property }}</span>
                <n-switch 
                  size="small" 
                  :value="track.enabled"
                  @update:value="animationStore.updateTrack(animationStore.activeClip!.id, track.id, { enabled: $event })"
                />
                <button 
                  class="track-delete-btn"
                  title="删除轨道"
                  @click.stop="handleDeleteTrack(track.id, track.property)"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                  </svg>
                </button>
              </div>
            </template>
          </template>
        </div>
      </div>
      
      <!-- 右侧时间轴 -->
      <div 
        class="timeline-tracks-area"
        ref="timelineContainer"
        @click="handleTimelineClick"
      >
        <!-- 时间刻度 -->
        <TimelineHeader 
          :duration="animationStore.activeClip.duration"
          :pixels-per-second="pixelsPerSecond"
          :scroll-x="animationStore.timelineView.scrollX"
          :format-time="formatTime"
        />
        
        <!-- 轨道内容 -->
        <div 
          class="tracks-scroll-area"
          :style="{ width: `${timelineWidth}px` }"
        >
          <template v-for="group in groupedTracks" :key="group.objectId">
            <div class="track-group-spacer" :style="{ borderLeft: `3px solid ${group.color}` }"></div>
            <template v-if="!group.collapsed">
              <TimelineTrack
                v-for="track in group.tracks"
                :key="track.id"
                :track="track"
                :track-color="group.color"
                :pixels-per-second="pixelsPerSecond"
                :duration="animationStore.activeClip.duration"
                @keyframe-click="(kf) => animationStore.selectKeyframes([kf.id])"
                @keyframe-move="(kfId, newTime) => animationStore.updateKeyframe(track.id, kfId, { time: newTime })"
              />
            </template>
          </template>
        </div>
        
        <!-- 播放指针（纵向固定：用 translateY 抵消滚动；不占布局） -->
        <div class="playhead-layer" :style="{ width: `${timelineWidth}px`, transform: `translateY(${animationStore.timelineView.scrollY}px)` }">
          <div 
            class="playhead"
            :style="{ left: `${cursorPosition}px` }"
            @mousedown="handleCursorDragStart"
          >
            <div class="playhead-head"></div>
            <div class="playhead-line"></div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 无动画剪辑提示 -->
    <div v-else class="no-clip-message">
      <n-empty description="暂无动画剪辑">
        <template #extra>
          <n-button type="primary" @click="handleCreateClip">
            创建动画
          </n-button>
        </template>
      </n-empty>
    </div>
  </div>
</template>

<style scoped>
.timeline-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fafafa;
  color: #333;
  user-select: none;
}

/* 剪辑管理栏 */
.clip-manager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  background: #fff;
  border-bottom: 1px solid #e0e0e0;
  gap: 12px;
}

.clip-manager-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.clip-manager-right {
  display: flex;
  align-items: center;
  gap: 4px;
}

.no-clips-hint {
  font-size: 12px;
  color: #999;
}

.clip-name-editor {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  background: #fff3cd;
  border-bottom: 1px solid #e0e0e0;
}

.edit-label {
  font-size: 12px;
  color: #666;
}

.timeline-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* 左侧轨道标签 */
.track-labels {
  width: 200px;
  flex-shrink: 0;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  background: #fff;
}

.track-labels-header {
  height: 30px;
  line-height: 30px;
  padding: 0 8px;
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
  font-size: 12px;
  color: #666;
}

.track-labels-list {
  flex: 1;
  overflow-y: auto;
}

.track-group-header {
  height: 24px;
  line-height: 24px;
  padding: 0 4px;
  background: #f0f0f0;
  font-size: 12px;
  font-weight: 500;
  color: #333;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
  transition: background 0.15s;
}

.track-group-header:hover {
  background: #e8e8e8;
}

.group-color-bar {
  width: 3px;
  height: 16px;
  border-radius: 2px;
  flex-shrink: 0;
}

.collapse-icon {
  flex-shrink: 0;
  transition: transform 0.2s;
  color: #666;
}

.collapse-icon.collapsed {
  transform: rotate(-90deg);
}

.object-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-count {
  font-size: 10px;
  color: #999;
  margin-left: 4px;
}

.group-delete-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  margin-left: auto;
  padding: 0;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.track-group-header:hover .group-delete-btn {
  opacity: 1;
}

.group-delete-btn:hover {
  background: #ffebee;
  color: #e53935;
}

.track-label {
  height: 24px;
  line-height: 24px;
  padding: 0 8px 0 8px;
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
  border-bottom: 1px solid #eee;
  color: #555;
}

.track-color-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.track-label .property-name {
  flex: 1;
}

.track-label.disabled {
  opacity: 0.5;
}

.track-delete-btn {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s, color 0.15s;
}

.track-label:hover .track-delete-btn {
  opacity: 1;
}

.track-delete-btn:hover {
  background: #ffebee;
  color: #e53935;
}

.property-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 右侧时间轴区域 */
.timeline-tracks-area {
  flex: 1;
  position: relative;
  overflow: auto;
  background: #fff;
}

.tracks-scroll-area {
  position: relative;
  min-height: 100%;
}

.track-group-spacer {
  height: 24px;
  background: #f0f0f0;
}

/* 播放指针覆盖层：绝对覆盖，不参与布局 */
.playhead-layer {
  position: absolute;
  top: 30px; /* 时间刻度条高度（TimelineHeader 为 30px） */
  left: 0;
  bottom: 0;
  pointer-events: none; /* 不遮挡时间轴点击/选择 */
  z-index: 20; /* 高于轨道内容，低于可能的弹层 */
}

/* 播放指针 */
.playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  cursor: ew-resize;
  z-index: 100;
  pointer-events: auto; /* 允许拖拽播放指针 */
}

.playhead-head {
  width: 12px;
  height: 12px;
  background: #e53935;
  position: absolute;
  top: 0;
  left: -6px;
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}

.playhead-line {
  position: absolute;
  top: 12px;
  bottom: 0;
  left: 0;
  width: 1px;
  background: #e53935;
}

/* 无剪辑提示 */
.no-clip-message {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}
</style>
