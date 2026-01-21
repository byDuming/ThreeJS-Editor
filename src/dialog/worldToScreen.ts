import { Vector3 } from 'three'
import type { Camera } from 'three'

export interface ScreenResult {
  x: number
  y: number
  z: number
  inFrustum: boolean
}

/**
 * 将世界坐标投影到屏幕像素坐标（基于 renderer.domElement 的 rect）
 */
export function worldToScreen(
  world: Vector3,
  camera: Camera,
  domRect: DOMRect
): ScreenResult {
  const ndc = world.clone().project(camera) // [-1,1]
  const inFrustum =
    ndc.z >= -1 && ndc.z <= 1 && ndc.x >= -1 && ndc.x <= 1 && ndc.y >= -1 && ndc.y <= 1

  const x = (ndc.x * 0.5 + 0.5) * domRect.width + domRect.left
  const y = (-ndc.y * 0.5 + 0.5) * domRect.height + domRect.top

  return { x, y, z: ndc.z, inFrustum }
}

