import type { WebGPURenderer } from 'three/webgpu'
import type { WebGLRenderer } from 'three'
import type { PerspectiveCamera } from 'three'
import type { Scene } from 'three'

/**
 * 从渲染器截取场景截图
 * 直接使用渲染器的 canvas，不改变尺寸，确保颜色和清晰度正确
 * @param renderer 渲染器（WebGPU 或 WebGL）
 * @param scene 场景对象
 * @param camera 摄像机
 * @param width 截图宽度（可选，用于缩放，默认使用渲染器宽度）
 * @param height 截图高度（可选，用于缩放，默认使用渲染器高度）
 * @returns Promise<Blob> 图片 Blob 对象
 */
export async function captureSceneScreenshot(
  renderer: WebGPURenderer | WebGLRenderer,
  scene: Scene,
  camera: PerspectiveCamera,
  width?: number,
  height?: number
): Promise<Blob> {
  const canvas = renderer.domElement as HTMLCanvasElement
  if (!canvas) {
    throw new Error('渲染器不支持截图功能')
  }

  // WebGPU 渲染器使用 renderAsync 等待 GPU 完成渲染
  // WebGL 渲染器使用同步 render
  if ((renderer as any).renderAsync) {
    // WebGPU: 使用 renderAsync 确保渲染完成后立即截图
    await (renderer as any).renderAsync(scene, camera)
  } else {
    // WebGL: 同步渲染
    renderer.render(scene, camera)
  }

  // 立即同步获取 canvas 数据（使用 toDataURL 是同步的，避免 canvas 被清空）
  const dataUrl = canvas.toDataURL('image/png')
  
  // 将 dataURL 转换为 Blob
  const response = await fetch(dataUrl)
  const originalBlob = await response.blob()

  // 如果需要缩放，创建一个临时 canvas 进行缩放
  if (width && height && (width !== canvas.width || height !== canvas.height)) {
    // 创建临时 canvas 用于缩放
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = width
    tempCanvas.height = height
    const ctx = tempCanvas.getContext('2d')
    if (!ctx) {
      throw new Error('无法创建 2D 上下文')
    }

    // 将原图绘制到临时 canvas（使用 cover 模式保持宽高比）
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = reject
      img.src = dataUrl
    })
    
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    
    // 使用 cover 模式：保持宽高比，裁剪多余部分填满目标区域
    const srcAspect = img.width / img.height
    const dstAspect = width / height
    let sx = 0, sy = 0, sw = img.width, sh = img.height
    
    if (srcAspect > dstAspect) {
      // 原图更宽，裁剪左右两侧
      sw = img.height * dstAspect
      sx = (img.width - sw) / 2
    } else if (srcAspect < dstAspect) {
      // 原图更高，裁剪上下两侧
      sh = img.width / dstAspect
      sy = (img.height - sh) / 2
    }
    
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height)

    // 转换为 Blob
    return new Promise((resolve, reject) => {
      tempCanvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob)
          } else {
            reject(new Error('截图失败：无法生成 Blob'))
          }
        },
        'image/png',
        1.0
      )
    })
  }

  // 不需要缩放，返回原 Blob
  return originalBlob
}

/**
 * 将 Blob 转换为 File 对象
 * @param blob Blob 对象
 * @param filename 文件名
 * @returns File 对象
 */
export function blobToFile(blob: Blob, filename: string): File {
  return new File([blob], filename, { type: blob.type })
}
