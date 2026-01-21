<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps<{
  value: number | null | undefined
  min?: number
  max?: number
  step?: number
  precision?: number
  placeholder?: string
  label?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:value', value: number | null): void
}>()

const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartValue = ref(0)
const isEditing = ref(false)
const editValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const displayValue = computed(() => {
  if (props.value === null || props.value === undefined) return ''
  const precision = props.precision ?? 3
  return props.value.toFixed(precision)
})

const handleMouseDown = (event: MouseEvent) => {
  if (props.disabled || isEditing.value) return
  
  event.preventDefault()
  isDragging.value = true
  dragStartX.value = event.clientX
  dragStartValue.value = props.value ?? 0
  
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  
  // 防止选中文本
  document.body.style.userSelect = 'none'
  document.body.style.cursor = 'ew-resize'
}

const handleMouseMove = (event: MouseEvent) => {
  if (!isDragging.value) return
  
  const deltaX = event.clientX - dragStartX.value
  const step = props.step ?? 0.1
  
  // Shift 键：精细调整（1/10 步幅）
  // Ctrl 键：粗调（10倍步幅）
  let adjustedStep = step
  if (event.shiftKey) {
    adjustedStep = step / 10
  } else if (event.ctrlKey || event.metaKey) {
    adjustedStep = step * 10
  }
  
  const delta = deltaX * adjustedStep * 0.01
  let newValue = dragStartValue.value + delta
  
  // 限制范围
  if (props.min !== undefined) {
    newValue = Math.max(newValue, props.min)
  }
  if (props.max !== undefined) {
    newValue = Math.min(newValue, props.max)
  }
  
  // 应用精度
  const precision = props.precision ?? 3
  newValue = Math.round(newValue / adjustedStep) * adjustedStep
  newValue = Number(newValue.toFixed(precision))
  
  emit('update:value', newValue)
}

const handleMouseUp = () => {
  isDragging.value = false
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  
  document.body.style.userSelect = ''
  document.body.style.cursor = ''
}

const handleDoubleClick = () => {
  if (props.disabled) return
  isEditing.value = true
  editValue.value = props.value?.toString() ?? ''
  
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

const handleInputBlur = () => {
  isEditing.value = false
  const numValue = parseFloat(editValue.value)
  
  if (!isNaN(numValue)) {
    let finalValue = numValue
    
    // 限制范围
    if (props.min !== undefined) {
      finalValue = Math.max(finalValue, props.min)
    }
    if (props.max !== undefined) {
      finalValue = Math.min(finalValue, props.max)
    }
    
    emit('update:value', finalValue)
  } else {
    // 无效输入，恢复原值
    editValue.value = props.value?.toString() ?? ''
  }
}

const handleInputKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Enter') {
    handleInputBlur()
  } else if (event.key === 'Escape') {
    isEditing.value = false
    editValue.value = props.value?.toString() ?? ''
  }
}

const handleWheel = (event: WheelEvent) => {
  if (props.disabled || isEditing.value) return
  
  event.preventDefault()
  const step = props.step ?? 0.1
  const delta = event.deltaY > 0 ? -step : step
  
  // Shift 键：精细调整
  const adjustedStep = event.shiftKey ? delta / 10 : delta
  let newValue = (props.value ?? 0) + adjustedStep
  
  // 限制范围
  if (props.min !== undefined) {
    newValue = Math.max(newValue, props.min)
  }
  if (props.max !== undefined) {
    newValue = Math.min(newValue, props.max)
  }
  
  emit('update:value', newValue)
}

// 监听外部值变化，更新编辑值
watch(() => props.value, (newVal) => {
  if (!isEditing.value) {
    editValue.value = newVal?.toString() ?? ''
  }
})
</script>

<template>
  <div 
    class="number-input" 
    :class="{ 
      dragging: isDragging, 
      editing: isEditing,
      disabled: disabled
    }"
    @wheel="handleWheel"
  >
    <div class="number-input-label" v-if="label">{{ label }}</div>
    <div 
      class="number-input-content"
      @mousedown="handleMouseDown"
      @dblclick="handleDoubleClick"
    >
      <input
        v-if="isEditing"
        ref="inputRef"
        v-model="editValue"
        type="text"
        class="number-input-edit"
        @blur="handleInputBlur"
        @keydown="handleInputKeydown"
      />
      <span v-else class="number-input-display">
        {{ displayValue || placeholder || '0.000' }}
      </span>
      <div class="number-input-indicator" v-if="isDragging">
        <div class="number-input-indicator-line"></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.number-input {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 80px;
}

.number-input.disabled {
  opacity: 0.5;
  pointer-events: none;
}

.number-input-label {
  font-size: 11px;
  color: #999;
  margin-right: 6px;
  white-space: nowrap;
}

.number-input-content {
  position: relative;
  flex: 1;
  height: 24px;
  padding: 2px 8px;
  background: #f5f5f5;
  border: 1px solid #ddd;
  border-radius: 3px;
  cursor: ew-resize;
  display: flex;
  align-items: center;
  transition: all 0.15s;
  user-select: none;
}

.number-input-content:hover {
  background: #fafafa;
  border-color: #bbb;
}

.number-input-content.dragging {
  background: #e3f2fd;
  border-color: #2196f3;
  box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
}

.number-input-content.editing {
  background: #fff;
  border-color: #2196f3;
  cursor: text;
}

.number-input-display {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #333;
  width: 100%;
  text-align: left;
}

.number-input-edit {
  width: 100%;
  border: none;
  outline: none;
  background: transparent;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #333;
  padding: 0;
}

.number-input-indicator {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  pointer-events: none;
  z-index: 10;
}

.number-input-indicator-line {
  height: 1px;
  background: #2196f3;
  position: relative;
  animation: pulse 1s ease-in-out infinite;
}

.number-input-indicator-line::before,
.number-input-indicator-line::after {
  content: '';
  position: absolute;
  top: -3px;
  width: 7px;
  height: 7px;
  background: #2196f3;
  border-radius: 50%;
}

.number-input-indicator-line::before {
  left: -3px;
}

.number-input-indicator-line::after {
  right: -3px;
}

@keyframes pulse {
  0%, 100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

/* 工具提示 */
.number-input-content::after {
  content: attr(data-tooltip);
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-size: 11px;
  white-space: nowrap;
  border-radius: 3px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  margin-bottom: 5px;
}

.number-input-content:hover::after {
  opacity: 1;
}

.number-input-content[data-tooltip]::after {
  content: attr(data-tooltip);
}
</style>
