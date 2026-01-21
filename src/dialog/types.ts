import type { Component } from 'vue'

export type DialogTarget =
  | { kind: 'object'; objectId: string; anchor?: 'center' | 'top' | 'bottom' }
  | { kind: 'world'; position: [number, number, number]; anchor?: 'center' | 'top' | 'bottom' }
  | { kind: 'screen'; x: number; y: number; anchor?: 'center' | 'top' | 'bottom' }

export type DialogKind = 'tooltip' | 'card' | 'panel' | 'custom'

export interface DialogContent {
  component: Component
  props?: Record<string, any>
}

export interface DialogInstance {
  id: string
  kind: DialogKind
  title?: string

  target: DialogTarget
  follow: boolean
  pin: boolean
  visible: boolean

  offset: { x: number; y: number }

  // computed each update
  screen: {
    x: number
    y: number
    z: number
    inFrustum: boolean
  }

  content: DialogContent
}

export type DialogOpenOptions = Omit<
  Partial<DialogInstance>,
  'id' | 'screen' | 'content' | 'target'
> & {
  id?: string
  kind?: DialogKind
  title?: string
  target: DialogTarget
  content: DialogContent
  offset?: { x?: number; y?: number }
  follow?: boolean
  pin?: boolean
  visible?: boolean
}

