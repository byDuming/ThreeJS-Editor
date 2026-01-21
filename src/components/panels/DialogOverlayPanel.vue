<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { pluginManager } from '@/core'
import NumberInput from '@/components/panels/NumberInput.vue'
import { dialogStore } from '@/dialog/dialogStore'
import DialogTextContent from '@/dialog/DialogTextContent.vue'

const sceneStore = useSceneStore()

const selectedId = computed(() => sceneStore.selectedObjectId)
const dialogId = computed(() => (selectedId.value ? `dlg-${selectedId.value}` : null))

const title = ref('设备信息')
const anchor = ref<'top' | 'center' | 'bottom'>('top')
const follow = ref(true)
const pin = ref(false)
const offsetX = ref(0)
const offsetY = ref(-12)
const text = ref('这里是弹窗内容（可编辑）。')

const existing = computed(() => {
  const id = dialogId.value
  if (!id) return null
  return dialogStore.dialogs.find(d => d.id === id) ?? null
})

watch(existing, (d) => {
  if (!d) return
  title.value = d.title ?? title.value
  anchor.value = ((d.target as any).anchor ?? anchor.value) as any
  follow.value = d.follow
  pin.value = d.pin
  offsetX.value = d.offset.x
  offsetY.value = d.offset.y
  const props = d.content?.props as any
  if (props?.text != null) text.value = String(props.text)
}, { immediate: true })

function upsertForSelected() {
  const id = selectedId.value
  const ctx = pluginManager.getContext()
  if (!id || !ctx) return

  ctx.emit('dialog:open', {
    id: `dlg-${id}`,
    title: title.value,
    kind: 'card',
    target: { kind: 'object', objectId: id, anchor: anchor.value },
    follow: follow.value,
    pin: pin.value,
    visible: true,
    offset: { x: offsetX.value, y: offsetY.value },
    content: {
      component: DialogTextContent,
      props: { text: text.value }
    }
  })
}

function removeForSelected() {
  const id = dialogId.value
  const ctx = pluginManager.getContext()
  if (!id || !ctx) return
  ctx.emit('dialog:close', id)
}
</script>

<template>
  <n-scrollbar style="max-height: 100%;" content-style="padding: 8px;">
    <n-space vertical size="small">
      <n-text strong>弹窗（DOM Overlay）</n-text>

      <n-alert v-if="!selectedId" type="warning" :bordered="false">
        请选择一个对象后再添加弹窗。
      </n-alert>

      <n-card v-else size="small" :bordered="false">
        <n-space vertical size="small">
          <n-text depth="3">对象 ID：{{ selectedId }}</n-text>
          <n-text depth="3">弹窗 ID：{{ dialogId }}</n-text>

          <n-form label-placement="left" label-width="70">
            <n-form-item label="标题">
              <n-input v-model:value="title" placeholder="弹窗标题" />
            </n-form-item>

            <n-form-item label="锚点">
              <n-select
                v-model:value="anchor"
                :options="[
                  { label: '上方', value: 'top' },
                  { label: '居中', value: 'center' },
                  { label: '下方', value: 'bottom' }
                ]"
              />
            </n-form-item>

            <n-form-item label="跟随">
              <n-switch v-model:value="follow" />
            </n-form-item>

            <n-form-item label="固定">
              <n-switch v-model:value="pin" />
            </n-form-item>

            <n-form-item label="偏移X">
              <NumberInput :value="offsetX" :step="1" :precision="0" @update:value="(v) => (offsetX = v ?? 0)" />
            </n-form-item>

            <n-form-item label="偏移Y">
              <NumberInput :value="offsetY" :step="1" :precision="0" @update:value="(v) => (offsetY = v ?? 0)" />
            </n-form-item>

            <n-form-item label="内容">
              <n-input v-model:value="text" type="textarea" :autosize="{ minRows: 3, maxRows: 8 }" />
            </n-form-item>
          </n-form>

          <n-space justify="end">
            <n-button tertiary @click="removeForSelected" :disabled="!existing">删除弹窗</n-button>
            <n-button type="primary" @click="upsertForSelected">创建 / 更新</n-button>
          </n-space>
        </n-space>
      </n-card>
    </n-space>
  </n-scrollbar>
</template>

