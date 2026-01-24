<script setup lang="ts">
import { usePropertyBinding } from '@/composables/usePropertyBinding'
import NumberInput from '../NumberInput.vue'

const props = withDefaults(defineProps<{
  /** 属性路径，如 "transform.position[0]" */
  path: string
  /** 标签 */
  label?: string
  /** 步进值 */
  step?: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 小数精度 */
  precision?: number
  /** 占位符 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 默认值 */
  defaultValue?: number
}>(), {
  step: 0.1,
  min: -Infinity,
  max: Infinity,
  precision: 3,
  disabled: false,
  defaultValue: 0
})

const { bind } = usePropertyBinding()
const value = bind(props.path, props.defaultValue)
</script>

<template>
  <NumberInput
    v-model:value="value"
    :label="label"
    :step="step"
    :min="min"
    :max="max"
    :precision="precision"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>
