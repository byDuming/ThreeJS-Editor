import { definePlugin } from '@/core'
import { Vector3 } from 'three'
import { worldToScreen } from '@/dialog/worldToScreen'
import { closeDialog, listDialogs, openDialog, updateDialog } from '@/dialog/dialogStore'
import type { DialogOpenOptions, DialogTarget } from '@/dialog/types'
import DialogOverlayPanel from '@/components/panels/DialogOverlayPanel.vue'
import { ChatboxEllipsesOutline } from '@vicons/ionicons5'

/**
 * DOM 弹窗 Overlay 插件（方式1：通过事件系统暴露 API）
 *
 * 事件：
 * - dialog:open (options, reply?) -> reply(id)
 * - dialog:close (id)
 * - dialog:update (id, patch)
 * - dialog:list (reply?) -> reply(dialogs)
 */
export const dialogOverlayPlugin = definePlugin({
  id: 'dialog-overlay',
  name: '弹窗 Overlay（DOM）',
  version: '0.1.0',
  description: '为 3D 场景提供常驻/跟随的 DOM 弹窗',
  panels: [
    {
      id: 'dialog-overlay-panel',
      name: '弹窗',
      icon: ChatboxEllipsesOutline,
      position: 'left',
      component: DialogOverlayPanel,
      order: 50
    }
  ],

  install(context) {
    // open
    context.on('dialog:open', (options: DialogOpenOptions, reply?: (id: string) => void) => {
      const id = openDialog(options)
      reply?.(id)
    })
    // close
    context.on('dialog:close', (id: string) => closeDialog(id))
    // update
    context.on('dialog:update', (id: string, patch: any) => updateDialog(id, patch))
    // list
    context.on('dialog:list', (reply?: (dialogs: any) => void) => reply?.(listDialogs()))
  },

  hooks: {
    onAfterRender(delta, context) {
      void delta
      const camera = context.three.camera
      const renderer = context.three.renderer as any
      if (!camera || !renderer?.domElement) return

      const rect = renderer.domElement.getBoundingClientRect()
      const tmp = new Vector3()

      for (const d of listDialogs()) {
        if (!d.visible) continue
        if (d.pin) continue
        if (!d.follow) continue

        const target = d.target as DialogTarget
        let world: Vector3 | null = null

        if (target.kind === 'screen') {
          d.screen.x = target.x
          d.screen.y = target.y
          d.screen.z = 0
          d.screen.inFrustum = true
          continue
        }

        if (target.kind === 'world') {
          const [x, y, z] = target.position
          world = tmp.set(x, y, z)
        }

        if (target.kind === 'object') {
          const obj = context.stores.scene.objectsMap.get(target.objectId)
          if (!obj) {
            d.screen.inFrustum = false
            continue
          }
          obj.getWorldPosition(tmp)
          world = tmp
        }

        if (!world) continue
        const res = worldToScreen(world, camera, rect)
        d.screen.x = res.x
        d.screen.y = res.y
        d.screen.z = res.z
        d.screen.inFrustum = res.inFrustum
      }
    }
  }
})

