<script setup lang="ts">
defineProps<{
  text?: string
}>()
</script>

<template>
  <div class="text-content">{{ text }}</div>
</template>

<style scoped>
.text-content {
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

