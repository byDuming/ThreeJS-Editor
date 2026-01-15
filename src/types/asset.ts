export type AssetType = 'model' | 'texture' | 'image'
export type AssetSource = 'local' | 'remote'

export type AssetRef = {
  id: string
  type: AssetType
  uri: string
  name: string
  source: AssetSource
  thumbnail?: string // 预览图 URL
  meta?: {
    ext?: string
    size?: number
    mime?: string
  }
  createdAt?: number
}
