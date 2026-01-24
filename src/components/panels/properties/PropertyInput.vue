<script setup lang="ts">
import { usePropertyBinding } from '@/composables/usePropertyBinding'

const props = withDefaults(defineProps<{
  /** 属性路径 */
  path: string
  /** 输入类型 */
  type?: 'text' | 'password' | 'textarea'
  /** 默认值 */
  defaultValue?: string
  /** 占位符 */
  placeholder?: string
  /** 是否禁用 */
  disabled?: boolean
  /** 是否只读 */
  readonly?: boolean
  /** 最大长度 */
  maxlength?: number
}>(), {
  type: 'text',
  defaultValue: '',
  placeholder: '',
  disabled: false,
  readonly: false
})

const { bind } = usePropertyBinding()
const value = bind(props.path, props.defaultValue)
</script>

<template>
  <n-input
    v-model:value="value"
    :type="type"
    :placeholder="placeholder"
    :disabled="disabled"
    :readonly="readonly"
    :maxlength="maxlength"
  />
</template>
