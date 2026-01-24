<script setup lang="ts">
import { computed } from 'vue'
import { usePropertyBinding } from '@/composables/usePropertyBinding'
import NumberInput from '../NumberInput.vue'

const props = withDefaults(defineProps<{
  /** 属性路径，如 "transform.position" */
  path: string
  /** 步进值 */
  step?: number
  /** 最小值 */
  min?: number
  /** 最大值 */
  max?: number
  /** 小数精度 */
  precision?: number
  /** 是否禁用 */
  disabled?: boolean
  /** 默认值 */
  defaultValue?: [number, number, number]
  /** 各轴的标签 */
  labels?: [string, string, string]
}>(), {
  step: 0.1,
  min: -Infinity,
  max: Infinity,
  precision: 3,
  disabled: false,
  defaultValue: () => [0, 0, 0],
  labels: () => ['X', 'Y', 'Z']
})

const { bind } = usePropertyBinding()

// 分别为三个轴创建绑定
const valueX = bind(`${props.path}[0]`, props.defaultValue[0])
const valueY = bind(`${props.path}[1]`, props.defaultValue[1])
const valueZ = bind(`${props.path}[2]`, props.defaultValue[2])
</script>

<template>
  <n-grid x-gap="6" :cols="9">
    <n-gi :span="3">
      <NumberInput
        v-model:value="valueX"
        :label="labels[0]"
        :step="step"
        :min="min"
        :max="max"
        :precision="precision"
        :disabled="disabled"
      />
    </n-gi>
    <n-gi :span="3">
      <NumberInput
        v-model:value="valueY"
        :label="labels[1]"
        :step="step"
        :min="min"
        :max="max"
        :precision="precision"
        :disabled="disabled"
      />
    </n-gi>
    <n-gi :span="3">
      <NumberInput
        v-model:value="valueZ"
        :label="labels[2]"
        :step="step"
        :min="min"
        :max="max"
        :precision="precision"
        :disabled="disabled"
      />
    </n-gi>
  </n-grid>
</template>
