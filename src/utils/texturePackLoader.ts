/**
 * 贴图压缩包加载器
 * 支持从 ZIP 压缩包中解析 PBR 材质贴图，并根据文件名自动匹配贴图类型
 */

import JSZip from 'jszip'

/**
 * 贴图槽位类型（对应材质的各种贴图属性）
 */
export type TextureSlot =
  | 'map'           // 漫反射/基础颜色贴图
  | 'normalMap'     // 法线贴图
  | 'roughnessMap'  // 粗糙度贴图
  | 'metalnessMap'  // 金属度贴图
  | 'aoMap'         // 环境光遮蔽贴图
  | 'armMap'        // ARM打包贴图（AO/Roughness/Metalness）
  | 'emissiveMap'   // 自发光贴图
  | 'displacementMap' // 位移贴图
  | 'alphaMap'      // 透明度贴图
  | 'bumpMap'       // 凹凸贴图
  | 'lightMap'      // 光照贴图
  | 'envMap'        // 环境贴图
  | 'specularMap'   // 高光贴图（Phong材质）

/**
 * 贴图匹配规则配置
 * 使用后缀匹配模式：如 brick_diffuse.png, brick_normal.png
 */
const TEXTURE_PATTERNS: Record<TextureSlot, RegExp[]> = {
  map: [
    /_diffuse\./i,
    /_diff\./i,
    /_color\./i,
    /_albedo\./i,
    /_basecolor\./i,
    /_base_color\./i,
    /_col\./i,
  ],
  normalMap: [
    /_normal\./i,
    /_nor\./i,
    /_nrm\./i,
    /_norm\./i,
    /_normalgl\./i,
    /_normaldx\./i,
  ],
  roughnessMap: [
    /_roughness\./i,
    /_rough\./i,
    /_rgh\./i,
  ],
  metalnessMap: [
    /_metalness\./i,
    /_metal\./i,
    /_metallic\./i,
    /_mtl\./i,
  ],
  aoMap: [
    /_ao\./i,
    /_ambient\./i,
    /_ambientocclusion\./i,
    /_occlusion\./i,
    /_occ\./i,
  ],
  armMap: [
    /_arm\./i,
    /_orm\./i,
    /_aorm\./i,
    /_rma\./i,
    /_mra\./i,
    /_packed\./i,
  ],
  emissiveMap: [
    /_emissive\./i,
    /_emission\./i,
    /_emit\./i,
    /_glow\./i,
  ],
  displacementMap: [
    /_displacement\./i,
    /_disp\./i,
    /_height\./i,
    /_bump\./i, // bump 有时也用于位移
  ],
  alphaMap: [
    /_alpha\./i,
    /_opacity\./i,
    /_transparent\./i,
    /_transparency\./i,
  ],
  bumpMap: [
    /_bump\./i,
    /_bmp\./i,
  ],
  lightMap: [
    /_lightmap\./i,
    /_light\./i,
  ],
  envMap: [
    /_env\./i,
    /_environment\./i,
    /_reflection\./i,
    /_hdri\./i,
    /_hdr\./i,
  ],
  specularMap: [
    /_specular\./i,
    /_spec\./i,
    /_glossiness\./i,
    /_gloss\./i,
  ],
}

/**
 * 支持的图片格式
 */
const SUPPORTED_IMAGE_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.bmp',
  '.tga',
  '.exr',
  '.hdr',
]

/**
 * 解析后的贴图信息
 */
export interface ParsedTexture {
  /** 贴图槽位 */
  slot: TextureSlot
  /** 原始文件名 */
  fileName: string
  /** 文件对象 */
  file: File
}

/**
 * 压缩包解析结果
 */
export interface TexturePackResult {
  /** 成功匹配的贴图列表 */
  textures: ParsedTexture[]
  /** 未匹配的文件列表（可能是其他资源或不符合命名规范的贴图） */
  unmatched: string[]
  /** 压缩包名称（不含扩展名，可用作材质名） */
  packName: string
}

/**
 * 判断文件是否为支持的图片格式
 */
function isSupportedImage(fileName: string): boolean {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  return SUPPORTED_IMAGE_EXTENSIONS.includes(ext)
}

/**
 * 根据文件名匹配贴图槽位
 */
function matchTextureSlot(fileName: string): TextureSlot | null {
  const lowerFileName = fileName.toLowerCase()
  
  for (const [slot, patterns] of Object.entries(TEXTURE_PATTERNS) as [TextureSlot, RegExp[]][]) {
    for (const pattern of patterns) {
      if (pattern.test(lowerFileName)) {
        return slot
      }
    }
  }
  
  return null
}

/**
 * 从 ZIP 文件中提取文件为 File 对象
 */
async function extractFileFromZip(
  zipFile: JSZip.JSZipObject,
  fileName: string
): Promise<File> {
  const blob = await zipFile.async('blob')
  // 获取 MIME 类型
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'))
  let mimeType = 'application/octet-stream'
  
  switch (ext) {
    case '.png':
      mimeType = 'image/png'
      break
    case '.jpg':
    case '.jpeg':
      mimeType = 'image/jpeg'
      break
    case '.webp':
      mimeType = 'image/webp'
      break
    case '.gif':
      mimeType = 'image/gif'
      break
    case '.bmp':
      mimeType = 'image/bmp'
      break
    case '.hdr':
      mimeType = 'image/vnd.radiance'
      break
    case '.exr':
      mimeType = 'image/x-exr'
      break
  }
  
  return new File([blob], fileName, { type: mimeType })
}

/**
 * 解析贴图压缩包
 * @param zipFile ZIP 文件
 * @returns 解析结果，包含匹配的贴图和未匹配的文件
 */
export async function parseTexturePack(zipFile: File): Promise<TexturePackResult> {
  const zip = await JSZip.loadAsync(zipFile)
  
  const textures: ParsedTexture[] = []
  const unmatched: string[] = []
  
  // 获取压缩包名称（去除扩展名）
  const packName = zipFile.name.replace(/\.(zip|rar|7z)$/i, '')
  
  // 遍历 ZIP 中的所有文件
  const filePromises: Promise<void>[] = []
  
  zip.forEach((relativePath, zipEntry) => {
    // 跳过目录和隐藏文件
    if (zipEntry.dir || relativePath.startsWith('__MACOSX') || relativePath.startsWith('.')) {
      return
    }
    
    // 获取文件名（不含路径）
    const fileName = relativePath.split('/').pop() || relativePath
    
    // 跳过隐藏文件
    if (fileName.startsWith('.')) {
      return
    }
    
    // 检查是否为支持的图片格式
    if (!isSupportedImage(fileName)) {
      unmatched.push(relativePath)
      return
    }
    
    // 匹配贴图槽位
    const slot = matchTextureSlot(fileName)
    
    if (slot) {
      // 提取文件
      const extractPromise = extractFileFromZip(zipEntry, fileName).then(file => {
        textures.push({
          slot,
          fileName,
          file,
        })
      })
      filePromises.push(extractPromise)
    } else {
      unmatched.push(relativePath)
    }
  })
  
  // 等待所有文件提取完成
  await Promise.all(filePromises)
  
  return {
    textures,
    unmatched,
    packName,
  }
}

/**
 * 获取贴图槽位的中文名称（用于 UI 显示）
 */
export function getTextureSlotLabel(slot: TextureSlot): string {
  const labels: Record<TextureSlot, string> = {
    map: '漫反射贴图',
    normalMap: '法线贴图',
    roughnessMap: '粗糙度贴图',
    metalnessMap: '金属度贴图',
    aoMap: 'AO贴图',
    armMap: 'ARM贴图',
    emissiveMap: '自发光贴图',
    displacementMap: '位移贴图',
    alphaMap: '透明度贴图',
    bumpMap: '凹凸贴图',
    lightMap: '光照贴图',
    envMap: '环境贴图',
    specularMap: '高光贴图',
  }
  return labels[slot] || slot
}

/**
 * 验证贴图文件
 * @param file 文件对象
 * @returns 是否为有效的贴图文件
 */
export function isValidTextureFile(file: File): boolean {
  return isSupportedImage(file.name)
}

/**
 * 批量解析多个贴图文件（非压缩包，直接上传的图片）
 * @param files 文件列表
 * @returns 解析结果
 */
export function parseTextureFiles(files: File[]): { matched: ParsedTexture[]; unmatched: File[] } {
  const matched: ParsedTexture[] = []
  const unmatched: File[] = []
  
  for (const file of files) {
    if (!isSupportedImage(file.name)) {
      unmatched.push(file)
      continue
    }
    
    const slot = matchTextureSlot(file.name)
    if (slot) {
      matched.push({
        slot,
        fileName: file.name,
        file,
      })
    } else {
      unmatched.push(file)
    }
  }
  
  return { matched, unmatched }
}
