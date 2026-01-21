import { reactive } from 'vue'
import type { DialogInstance, DialogOpenOptions } from './types'

function generateId(prefix = 'dlg') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export const dialogStore = reactive({
  dialogs: [] as DialogInstance[]
})

export function openDialog(options: DialogOpenOptions): string {
  const id = options.id ?? generateId()
  const inst: DialogInstance = {
    id,
    kind: options.kind ?? 'card',
    title: options.title,
    target: options.target,
    follow: options.follow ?? true,
    pin: options.pin ?? false,
    visible: options.visible ?? true,
    offset: { x: options.offset?.x ?? 0, y: options.offset?.y ?? 0 },
    screen: { x: 0, y: 0, z: 0, inFrustum: true },
    content: options.content
  }
  // replace same id
  const idx = dialogStore.dialogs.findIndex(d => d.id === id)
  if (idx >= 0) dialogStore.dialogs.splice(idx, 1, inst)
  else dialogStore.dialogs.push(inst)
  return id
}

export function closeDialog(id: string) {
  const idx = dialogStore.dialogs.findIndex(d => d.id === id)
  if (idx >= 0) dialogStore.dialogs.splice(idx, 1)
}

export function updateDialog(id: string, patch: Partial<Omit<DialogInstance, 'id'>>) {
  const inst = dialogStore.dialogs.find(d => d.id === id)
  if (!inst) return
  Object.assign(inst, patch)
}

export function listDialogs() {
  return dialogStore.dialogs
}

