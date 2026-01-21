<script setup lang="ts">
import { computed } from 'vue'
import { dialogStore, closeDialog } from './dialogStore'

const dialogs = computed(() => dialogStore.dialogs)

function anchorTransform(anchor?: string) {
  switch (anchor) {
    case 'top':
      return 'translate3d(-50%, -100%, 0)'
    case 'bottom':
      return 'translate3d(-50%, 0%, 0)'
    case 'center':
    default:
      return 'translate3d(-50%, -50%, 0)'
  }
}
</script>

<template>
  <div class="dialog-overlay-root">
    <div
      v-for="d in dialogs"
      :key="d.id"
      class="dialog-item"
      :class="{ hidden: !d.visible || !d.screen.inFrustum }"
      :style="{
        transform: `translate3d(${d.screen.x + d.offset.x}px, ${d.screen.y + d.offset.y}px, 0) ${anchorTransform((d.target as any).anchor)}`,
        zIndex: 1000
      }"
    >
      <div class="dialog-frame">
        <div v-if="d.title" class="dialog-title">
          <span class="title-text">{{ d.title }}</span>
          <button class="close-btn" @click="closeDialog(d.id)">×</button>
        </div>
        <component :is="d.content.component" v-bind="d.content.props" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.dialog-overlay-root {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.dialog-item {
  position: fixed; /* 用 viewport 定位，避免容器滚动影响 */
  left: 0;
  top: 0;
  pointer-events: none;
  will-change: transform;
}

.dialog-item.hidden {
  display: none;
}

.dialog-frame {
  pointer-events: auto;
  min-width: 160px;
  max-width: 360px;
  background: rgba(20, 20, 20, 0.85);
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(8px);
  padding: 10px 12px;
}

.dialog-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 12px;
  opacity: 0.95;
}

.title-text {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close-btn {
  border: 0;
  background: transparent;
  color: #fff;
  cursor: pointer;
  font-size: 14px;
  line-height: 14px;
  padding: 2px 6px;
  opacity: 0.8;
}
.close-btn:hover {
  opacity: 1;
}
</style>

