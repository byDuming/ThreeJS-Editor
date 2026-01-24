<script setup lang="ts">
import { usePropertyBinding } from '@/composables/usePropertyBinding'

const props = withDefaults(defineProps<{
  /** 属性路径，如 "visible" */
  path: string
  /** 默认值 */
  defaultValue?: boolean
  /** 是否禁用 */
  disabled?: boolean
}>(), {
  defaultValue: false,
  disabled: false
})

const { bind } = usePropertyBinding()
const value = bind(props.path, props.defaultValue)
</script>

<template>
  <n-switch
    v-model:value="value"
    :disabled="disabled"
  />
</template>
