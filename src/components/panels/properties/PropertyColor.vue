<script setup lang="ts">
import { usePropertyBinding } from '@/composables/usePropertyBinding'

const props = withDefaults(defineProps<{
  /** 属性路径，如 "mesh.material.color" */
  path: string
  /** 默认值 */
  defaultValue?: string
  /** 是否显示 alpha 通道 */
  showAlpha?: boolean
  /** 是否禁用 */
  disabled?: boolean
}>(), {
  defaultValue: '#ffffff',
  showAlpha: false,
  disabled: false
})

const { bind } = usePropertyBinding()
const value = bind(props.path, props.defaultValue)
</script>

<template>
  <n-color-picker
    v-model:value="value"
    :show-alpha="showAlpha"
    :disabled="disabled"
  />
</template>
