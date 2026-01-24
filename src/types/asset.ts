export type AssetType = 'model' | 'texture' | 'image' | 'material' | 'hdri' | 'audio' | 'video' | 'other' | 'pointCloud'
export type AssetSource = 'cloud'

export type AssetRef = {
  id: string
  type: AssetType
  uri: string
  name: string
  source: AssetSource
  thumbnail?: string // 预览图 URL
  size?: number // 文件大小
  mimeType?: string // MIME 类型
  cloudId?: string // 云端资产ID
  meta?: {
    ext?: string
    size?: number
    mime?: string
  }
  createdAt?: number
}
