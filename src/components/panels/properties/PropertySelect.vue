<script setup lang="ts">
import { usePropertyBinding } from '@/composables/usePropertyBinding'

export interface SelectOption {
  label: string
  value: string | number
}

const props = withDefaults(defineProps<{
  /** 属性路径，如 "mesh.material.side" */
  path: string
  /** 选项列表 */
  options: SelectOption[]
  /** 默认值 */
  defaultValue?: string | number
  /** 占位符 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否可清除 */
  clearable?: boolean
}>(), {
  defaultValue: '',
  placeholder: '请选择',
  disabled: false,
  clearable: false
})

const { bind } = usePropertyBinding()
const value = bind(props.path, props.defaultValue)
</script>

<template>
  <n-select
    v-model:value="value"
    :options="options"
    :placeholder="placeholder"
    :disabled="disabled"
    :clearable="clearable"
  />
</template>
