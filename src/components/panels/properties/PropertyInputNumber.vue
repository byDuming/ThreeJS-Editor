<script setup lang="ts">
import { usePropertyBinding } from '@/composables/usePropertyBinding'

const props = withDefaults(defineProps<{
  /** 属性路径 */
  path: string
  /** 默认值 */
  defaultValue?: number
  /** 步进值 */
  step?: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 占位符 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 小数精度 */
  precision?: number
}>(), {
  defaultValue: 0,
  step: 1,
  disabled: false
})

const { bind } = usePropertyBinding()
const value = bind(props.path, props.defaultValue)
</script>

<template>
  <n-input-number
    v-model:value="value"
    :step="step"
    :min="min"
    :max="max"
    :placeholder="placeholder"
    :disabled="disabled"
    :precision="precision"
  />
</template>
