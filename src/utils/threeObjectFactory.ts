import type { SceneObjectData } from '@/interfaces/sceneInterface.ts'
import type { GeometryData } from '@/types/geometry'
import type { HelperData } from '@/types/helper'
import type { MaterialData } from '@/types/material'
import {
  BoxGeometry,
  CapsuleGeometry,
  CircleGeometry,
  ConeGeometry,
  CylinderGeometry,
  DodecahedronGeometry,
  PerspectiveCamera,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineDashedMaterial,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  MeshMatcapMaterial,
  MeshPhongMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  Object3D,
  OctahedronGeometry,
  PlaneGeometry,
  PointsMaterial,
  RingGeometry,
  ShadowMaterial,
  SpriteMaterial,
  SphereGeometry,
  TetrahedronGeometry,
  TorusGeometry,
  TorusKnotGeometry,
  Color,
  TextureLoader,
  Scene,
  Fog,
  FogExp2,
  AmbientLight,
  DirectionalLight,
  HemisphereLight,
  PointLight,
  SpotLight,
  RectAreaLight,
  FrontSide,
  BackSide,
  DoubleSide,
  NormalBlending,
  AdditiveBlending,
  SubtractiveBlending,
  MultiplyBlending,
  CustomBlending,
  RepeatWrapping,
  ClampToEdgeWrapping,
  MirroredRepeatWrapping,
  NeverDepth,
  AlwaysDepth,
  LessDepth,
  LessEqualDepth,
  EqualDepth,
  GreaterDepth,
  GreaterEqualDepth,
  NotEqualDepth,
  NearestFilter,
  LinearFilter,
  NearestMipmapNearestFilter,
  LinearMipmapNearestFilter,
  NearestMipmapLinearFilter,
  LinearMipmapLinearFilter,
  EquirectangularReflectionMapping,
  SRGBColorSpace,
  NoColorSpace,
  type Texture,
  type Wrapping,
  type MagnificationTextureFilter,
  type MinificationTextureFilter,
  type BufferGeometry,

  ArrowHelper,
  AxesHelper,
  Box3,
  Box3Helper,
  BoxHelper,
  CameraHelper,
  DirectionalLightHelper,
  GridHelper,
  HemisphereLightHelper,
  Plane,
  PlaneHelper,
  PointLightHelper,
  PolarGridHelper,
  SkeletonHelper,
  SpotLightHelper,
  Vector3
} from 'three'

import { CubeTextureLoader } from 'three'
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js'
import { RectAreaLightHelper } from 'three/addons/helpers/RectAreaLightHelper.js'
import { LightProbeHelper } from 'three/addons/helpers/LightProbeHelper.js'
import { VertexNormalsHelper } from 'three/addons/helpers/VertexNormalsHelper.js'

const textureLoader = new TextureLoader()
const cubeTextureLoader = new CubeTextureLoader()
const rgbeLoader = new RGBELoader()
const textureCache = new Map<string, Texture>()

/**
 * 判断贴图源是否有效
 * 支持格式：
 * - HTTP/HTTPS URLs（云存储）
 * - data: URLs（Base64，向后兼容）
 * - blob: URLs（临时本地文件）
 */
function isValidTextureSource(source?: string): boolean {
  if (!source || typeof source !== 'string') return false
  const trimmed = source.trim()
  if (!trimmed) return false
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  )
}
const wrapMap: Record<string, Wrapping> = {
  repeat: RepeatWrapping,
  clampToEdge: ClampToEdgeWrapping,
  mirroredRepeat: MirroredRepeatWrapping
}
const magFilterMap: Record<string, MagnificationTextureFilter> = {
  nearest: NearestFilter,
  linear: LinearFilter
}
const minFilterMap: Record<string, MinificationTextureFilter> = {
  nearest: NearestFilter,
  linear: LinearFilter,
  nearestMipmapNearest: NearestMipmapNearestFilter,
  linearMipmapNearest: LinearMipmapNearestFilter,
  nearestMipmapLinear: NearestMipmapLinearFilter,
  linearMipmapLinear: LinearMipmapLinearFilter
}
const sideMap: Record<string, number> = {
  front: FrontSide,
  back: BackSide,
  double: DoubleSide
}
const blendingMap: Record<string, number> = {
  normal: NormalBlending,
  additive: AdditiveBlending,
  subtractive: SubtractiveBlending,
  multiply: MultiplyBlending,
  custom: CustomBlending
}
const depthFuncMap: Record<string, number> = {
  never: NeverDepth,
  always: AlwaysDepth,
  less: LessDepth,
  lequal: LessEqualDepth,
  equal: EqualDepth,
  gequal: GreaterEqualDepth,
  greater: GreaterDepth,
  notequal: NotEqualDepth
}

/**
 * 获取贴图对象
 * 支持加载：
 * - HTTP/HTTPS URLs（云存储，如 Supabase Storage）
 * - data: URLs（Base64 编码，向后兼容旧数据）
 * - blob: URLs（临时本地文件）
 * 
 * 会自动缓存已加载的贴图以避免重复加载
 */
function getTexture(source?: string) {
  if (!isValidTextureSource(source)) return null
  
  const cached = textureCache.get(source!)
  if (cached) return cached
  
  try {
    const texture = textureLoader.load(source!)
    textureCache.set(source!, texture)
    return texture
  } catch (error) {
    console.warn(`[getTexture] 加载贴图失败: ${source}`, error)
    return null
  }
}

/**
 * 获取环境贴图
 * 支持类型：
 * - cube: 立方体贴图（6张图片）
 * - hdr: HDR 环境贴图
 * - equirect: 等距圆柱投影贴图
 */
function getEnvMapTexture(source?: string | string[], envMapType?: string) {
  if (!source) return null
  const resolvedType = envMapType ?? (Array.isArray(source) ? 'cube' : 'equirect')

  if (resolvedType === 'cube' && Array.isArray(source)) {
    // 验证所有 URL 都有效
    const validSources = source.filter(isValidTextureSource)
    if (validSources.length !== source.length) {
      console.warn('[getEnvMapTexture] 部分立方体贴图 URL 无效')
      return null
    }
    
    const key = `cube:${source.join('|')}`
    const cached = textureCache.get(key)
    if (cached) return cached
    
    try {
      const texture = cubeTextureLoader.load(source)
      textureCache.set(key, texture)
      return texture
    } catch (error) {
      console.warn('[getEnvMapTexture] 加载立方体贴图失败', error)
      return null
    }
  }

  if (resolvedType === 'hdr' && typeof source === 'string') {
    if (!isValidTextureSource(source)) return null
    
    const key = `hdr:${source}`
    const cached = textureCache.get(key)
    if (cached) return cached
    
    try {
      const texture = rgbeLoader.load(source, (loaded) => {
        loaded.mapping = EquirectangularReflectionMapping
        loaded.needsUpdate = true
      })
      texture.mapping = EquirectangularReflectionMapping
      textureCache.set(key, texture)
      return texture
    } catch (error) {
      console.warn('[getEnvMapTexture] 加载 HDR 贴图失败', error)
      return null
    }
  }

  if (typeof source === 'string') {
    const texture = getTexture(source)
    if (texture) texture.mapping = EquirectangularReflectionMapping
    return texture
  }

  return null
}

function getBackgroundTexture(settings?: SceneObjectData['scene']) {
  if (!settings) return null
  if (settings.backgroundType === 'texture') {
    return getTexture(settings.backgroundTexture)
  }
  if (settings.backgroundType === 'cube') {
    return getEnvMapTexture(settings.backgroundCube, 'cube')
  }
  return null
}

function applyTextureSettings(texture: Texture | null, mat: MaterialData) {
  if (!texture) return
  if (mat.wrapS) {
    const wrap = wrapMap[mat.wrapS]
    if (wrap !== undefined) texture.wrapS = wrap
  }
  if (mat.wrapT) {
    const wrap = wrapMap[mat.wrapT]
    if (wrap !== undefined) texture.wrapT = wrap
  }
  if (mat.magFilter) {
    const magFilter = magFilterMap[mat.magFilter]
    if (magFilter !== undefined) texture.magFilter = magFilter
  }
  if (mat.minFilter) {
    const minFilter = minFilterMap[mat.minFilter]
    if (minFilter !== undefined) texture.minFilter = minFilter
  }
  // 设置贴图重复次数
  const repeatX = mat.repeatX ?? 1
  const repeatY = mat.repeatY ?? 1
  if (repeatX !== 1 || repeatY !== 1) {
    texture.repeat.set(repeatX, repeatY)
  }
  // 设置贴图偏移
  const offsetX = mat.offsetX ?? 0
  const offsetY = mat.offsetY ?? 0
  if (offsetX !== 0 || offsetY !== 0) {
    texture.offset.set(offsetX, offsetY)
  }
  if ((texture as any).image !== null) {
    texture.needsUpdate = true
  }
}

function applyCommonMaterialProps(material: any, mat: MaterialData) {
  if (mat.color && material.color) material.color.set(mat.color)
  if (mat.opacity !== undefined) material.opacity = mat.opacity
  if (mat.transparent !== undefined) material.transparent = mat.transparent
  if (mat.depthTest !== undefined) material.depthTest = mat.depthTest
  if (mat.depthWrite !== undefined) material.depthWrite = mat.depthWrite
  if (mat.side && sideMap[mat.side]) material.side = sideMap[mat.side]
  if ((mat as any).blending && blendingMap[(mat as any).blending]) material.blending = blendingMap[(mat as any).blending]
  if ((mat as any).depthFunc && depthFuncMap[(mat as any).depthFunc]) material.depthFunc = depthFuncMap[(mat as any).depthFunc]
  if ((mat as any).premultipliedAlpha !== undefined) material.premultipliedAlpha = (mat as any).premultipliedAlpha
  if ((mat as any).dithering !== undefined) material.dithering = (mat as any).dithering
  if ((mat as any).polygonOffset !== undefined) material.polygonOffset = (mat as any).polygonOffset
  if ((mat as any).polygonOffsetFactor !== undefined) material.polygonOffsetFactor = (mat as any).polygonOffsetFactor
  if ((mat as any).polygonOffsetUnits !== undefined) material.polygonOffsetUnits = (mat as any).polygonOffsetUnits
  if (mat.wireframe !== undefined) material.wireframe = mat.wireframe
  if (mat.wireframeLinewidth !== undefined && 'wireframeLinewidth' in material) {
    material.wireframeLinewidth = mat.wireframeLinewidth
  }
  if (mat.alphaTest !== undefined) material.alphaTest = mat.alphaTest
}

function applyMaterialSpecificProps(material: any, mat: MaterialData) {
  const anyMat = mat as any
  if (anyMat.emissive && material.emissive) material.emissive.set(anyMat.emissive)
  if (anyMat.emissiveIntensity !== undefined && 'emissiveIntensity' in material) material.emissiveIntensity = anyMat.emissiveIntensity
  if (anyMat.envMapIntensity !== undefined && 'envMapIntensity' in material) material.envMapIntensity = anyMat.envMapIntensity
  if (anyMat.lightMapIntensity !== undefined && 'lightMapIntensity' in material) material.lightMapIntensity = anyMat.lightMapIntensity
  if (anyMat.bumpScale !== undefined && 'bumpScale' in material) material.bumpScale = anyMat.bumpScale
  if (anyMat.normalScale !== undefined && material.normalScale) material.normalScale.set(anyMat.normalScale, anyMat.normalScale)
  if (anyMat.displacementScale !== undefined && 'displacementScale' in material) material.displacementScale = anyMat.displacementScale
  if (anyMat.displacementBias !== undefined && 'displacementBias' in material) material.displacementBias = anyMat.displacementBias
  if (anyMat.aoMapIntensity !== undefined && 'aoMapIntensity' in material) material.aoMapIntensity = anyMat.aoMapIntensity
  if (anyMat.roughness !== undefined && 'roughness' in material) material.roughness = anyMat.roughness
  if (anyMat.metalness !== undefined && 'metalness' in material) material.metalness = anyMat.metalness
  if (anyMat.specular && material.specular) material.specular.set(anyMat.specular)
  if (anyMat.shininess !== undefined && 'shininess' in material) material.shininess = anyMat.shininess
  if (anyMat.clearcoat !== undefined && 'clearcoat' in material) material.clearcoat = anyMat.clearcoat
  if (anyMat.clearcoatRoughness !== undefined && 'clearcoatRoughness' in material) material.clearcoatRoughness = anyMat.clearcoatRoughness
  if (anyMat.clearcoatNormalScale !== undefined && material.clearcoatNormalScale) {
    material.clearcoatNormalScale.set(anyMat.clearcoatNormalScale, anyMat.clearcoatNormalScale)
  }
  if (anyMat.sheen !== undefined && 'sheen' in material) material.sheen = anyMat.sheen
  if (anyMat.sheenColor && material.sheenColor) material.sheenColor.set(anyMat.sheenColor)
  if (anyMat.sheenRoughness !== undefined && 'sheenRoughness' in material) material.sheenRoughness = anyMat.sheenRoughness
  if (anyMat.iridescence !== undefined && 'iridescence' in material) material.iridescence = anyMat.iridescence
  if (anyMat.iridescenceIOR !== undefined && 'iridescenceIOR' in material) material.iridescenceIOR = anyMat.iridescenceIOR
  if (anyMat.iridescenceThicknessRange && material.iridescenceThicknessRange) {
    const range = anyMat.iridescenceThicknessRange as [number, number]
    if (typeof material.iridescenceThicknessRange.set === 'function') {
      material.iridescenceThicknessRange.set(range[0], range[1])
    }
  }
  if (anyMat.specularIntensity !== undefined && 'specularIntensity' in material) material.specularIntensity = anyMat.specularIntensity
  if (anyMat.specularColor && material.specularColor) material.specularColor.set(anyMat.specularColor)
  if (anyMat.attenuationColor && material.attenuationColor) material.attenuationColor.set(anyMat.attenuationColor)
  if (anyMat.attenuationDistance !== undefined && 'attenuationDistance' in material) material.attenuationDistance = anyMat.attenuationDistance
  if (anyMat.ior !== undefined && 'ior' in material) material.ior = anyMat.ior
  if (anyMat.transmission !== undefined && 'transmission' in material) material.transmission = anyMat.transmission
  if (anyMat.thickness !== undefined && 'thickness' in material) material.thickness = anyMat.thickness
  if (anyMat.anisotropy !== undefined && 'anisotropy' in material) material.anisotropy = anyMat.anisotropy
  if (anyMat.anisotropyRotation !== undefined && 'anisotropyRotation' in material) material.anisotropyRotation = anyMat.anisotropyRotation
  if (anyMat.linewidth !== undefined && 'linewidth' in material) material.linewidth = anyMat.linewidth
  if (anyMat.dashSize !== undefined && 'dashSize' in material) material.dashSize = anyMat.dashSize
  if (anyMat.gapSize !== undefined && 'gapSize' in material) material.gapSize = anyMat.gapSize
  if (anyMat.scale !== undefined && 'scale' in material) material.scale = anyMat.scale
  if (anyMat.size !== undefined && 'size' in material) material.size = anyMat.size
  if (anyMat.sizeAttenuation !== undefined && 'sizeAttenuation' in material) material.sizeAttenuation = anyMat.sizeAttenuation
}

/**
 * 设置贴图的颜色空间
 * - 颜色贴图（map, emissiveMap, sheenColorMap, specularColorMap）使用 sRGB
 * - 数据贴图（normal, roughness, metalness, ao, displacement 等）使用 NoColorSpace
 */
function setTextureColorSpace(texture: Texture | null, isColorMap: boolean) {
  if (!texture) return
  texture.colorSpace = isColorMap ? SRGBColorSpace : NoColorSpace
}

function applyMaps(material: any, mat: MaterialData) {
  const map = getTexture((mat as any).map)
  const alphaMap = getTexture((mat as any).alphaMap)
  const envMap = getEnvMapTexture((mat as any).envMap, (mat as any).envMapType)
  const normalMap = getTexture((mat as any).normalMap)
  const displacementMap = getTexture((mat as any).displacementMap)
  // ARM 打包贴图：如果设置了 armMap，则作为 aoMap/roughnessMap/metalnessMap 的回退
  const armMap = getTexture((mat as any).armMap)
  const roughnessMap = getTexture((mat as any).roughnessMap) ?? armMap
  const metalnessMap = getTexture((mat as any).metalnessMap) ?? armMap
  const aoMap = getTexture((mat as any).aoMap) ?? armMap
  const lightMap = getTexture((mat as any).lightMap)
  const bumpMap = getTexture((mat as any).bumpMap)
  const emissiveMap = getTexture((mat as any).emissiveMap)
  const specularMap = getTexture((mat as any).specularMap)
  const gradientMap = getTexture((mat as any).gradientMap)
  const matcap = getTexture((mat as any).matcap)
  const transmissionMap = getTexture((mat as any).transmissionMap)
  const thicknessMap = getTexture((mat as any).thicknessMap)
  const anisotropyMap = getTexture((mat as any).anisotropyMap)
  const clearcoatNormalMap = getTexture((mat as any).clearcoatNormalMap)
  const clearcoatMap = getTexture((mat as any).clearcoatMap)
  const clearcoatRoughnessMap = getTexture((mat as any).clearcoatRoughnessMap)
  const sheenColorMap = getTexture((mat as any).sheenColorMap)
  const sheenRoughnessMap = getTexture((mat as any).sheenRoughnessMap)
  const iridescenceMap = getTexture((mat as any).iridescenceMap)
  const iridescenceThicknessMap = getTexture((mat as any).iridescenceThicknessMap)
  const specularIntensityMap = getTexture((mat as any).specularIntensityMap)
  const specularColorMap = getTexture((mat as any).specularColorMap)

  // 设置贴图颜色空间
  // 颜色贴图：sRGB
  setTextureColorSpace(map, true)
  setTextureColorSpace(emissiveMap, true)
  setTextureColorSpace(sheenColorMap, true)
  setTextureColorSpace(specularColorMap, true)
  setTextureColorSpace(matcap, true) // matcap 包含颜色信息

  // 数据贴图：NoColorSpace (线性)
  setTextureColorSpace(alphaMap, false)
  setTextureColorSpace(normalMap, false)
  setTextureColorSpace(displacementMap, false)
  setTextureColorSpace(roughnessMap, false)
  setTextureColorSpace(metalnessMap, false)
  setTextureColorSpace(aoMap, false)
  setTextureColorSpace(lightMap, false)
  setTextureColorSpace(bumpMap, false)
  setTextureColorSpace(specularMap, false)
  setTextureColorSpace(gradientMap, false)
  setTextureColorSpace(transmissionMap, false)
  setTextureColorSpace(thicknessMap, false)
  setTextureColorSpace(anisotropyMap, false)
  setTextureColorSpace(clearcoatNormalMap, false)
  setTextureColorSpace(clearcoatMap, false)
  setTextureColorSpace(clearcoatRoughnessMap, false)
  setTextureColorSpace(sheenRoughnessMap, false)
  setTextureColorSpace(iridescenceMap, false)
  setTextureColorSpace(iridescenceThicknessMap, false)
  setTextureColorSpace(specularIntensityMap, false)

  const setMap = (key: string, texture: Texture | null) => {
    if (texture) applyTextureSettings(texture, mat)
    material[key] = texture ?? null
  }

  setMap('map', map)
  setMap('alphaMap', alphaMap)
  setMap('envMap', envMap)
  setMap('normalMap', normalMap)
  setMap('displacementMap', displacementMap)
  setMap('roughnessMap', roughnessMap)
  setMap('metalnessMap', metalnessMap)
  setMap('aoMap', aoMap)
  setMap('lightMap', lightMap)
  setMap('bumpMap', bumpMap)
  setMap('emissiveMap', emissiveMap)
  setMap('specularMap', specularMap)
  setMap('gradientMap', gradientMap)
  setMap('matcap', matcap)
  setMap('transmissionMap', transmissionMap)
  setMap('thicknessMap', thicknessMap)
  setMap('anisotropyMap', anisotropyMap)
  setMap('clearcoatNormalMap', clearcoatNormalMap)
  setMap('clearcoatMap', clearcoatMap)
  setMap('clearcoatRoughnessMap', clearcoatRoughnessMap)
  setMap('sheenColorMap', sheenColorMap)
  setMap('sheenRoughnessMap', sheenRoughnessMap)
  setMap('iridescenceMap', iridescenceMap)
  setMap('iridescenceThicknessMap', iridescenceThicknessMap)
  setMap('specularIntensityMap', specularIntensityMap)
  setMap('specularColorMap', specularColorMap)
}

/**
 * 确保几何体有 uv2 属性（用于 aoMap 和 lightMap）
 * Three.js 的 aoMap 和 lightMap 默认使用第二套 UV 坐标
 * 对于大多数情况，可以直接复制 uv 到 uv2
 */
export function ensureUV2(geometry: BufferGeometry) {
  if (geometry.attributes.uv && !geometry.attributes.uv2) {
    geometry.setAttribute('uv2', geometry.attributes.uv)
  }
}

/**
 * 遍历 Object3D 并为所有 Mesh 的几何体添加 uv2 属性
 * 用于导入的 GLTF/GLB 模型，确保 aoMap 和 lightMap 正常工作
 */
export function ensureUV2ForModel(object: Object3D) {
  object.traverse((child) => {
    if ((child as Mesh).isMesh) {
      const mesh = child as Mesh
      const geometry = mesh.geometry as BufferGeometry
      ensureUV2(geometry)
    }
  })
}

/** 递归设置对象及其所有子对象的阴影属性 */
export function applyShadowRecursively(
  obj: Object3D,
  castShadow?: boolean,
  receiveShadow?: boolean
) {
  obj.traverse((child) => {
    if ((child as Mesh).isMesh) {
      if (castShadow !== undefined) (child as Mesh).castShadow = castShadow
      if (receiveShadow !== undefined) (child as Mesh).receiveShadow = receiveShadow
    }
  })
}

/** Sync Three transform from SceneObjectData */
export function applyTransform(obj: Object3D, data: SceneObjectData) {
  const { position, rotation, scale } = data.transform
  if(position){
    obj.position.set(position[0], position[1], position[2])
  }
  if(rotation){
    obj.rotation.set(rotation[0], rotation[1], rotation[2])
  }
  if(scale){
    obj.scale.set(scale[0], scale[1], scale[2])
  }
}

/** Sync common render-state attributes from SceneObjectData to a Three Object3D */
export function syncThreeObjectState(obj: Object3D, data: SceneObjectData) {
  applyTransform(obj, data)
  obj.visible = data.visible ?? obj.visible

  // 对于 model 类型，递归设置所有子 mesh 的阴影
  if (data.type === 'model') {
    if (data.castShadow !== undefined || data.receiveShadow !== undefined) {
      applyShadowRecursively(obj, data.castShadow, data.receiveShadow)
    }
  } else {
    ;(obj as any).castShadow = data.castShadow ?? (obj as any).castShadow
    ;(obj as any).receiveShadow = data.receiveShadow ?? (obj as any).receiveShadow
  }

  obj.frustumCulled = data.frustumCulled ?? obj.frustumCulled
  obj.renderOrder = data.renderOrder ?? obj.renderOrder
  obj.name = data.name ?? obj.name
  obj.userData = { ...obj.userData, ...data.userData, sceneObjectId: data.id, sceneObjectType: data.type }
}

export function applyLightSettings(light: any, data: SceneObjectData) {
  const payload = (data.userData ?? {}) as any
  if (!light || !payload) return
  if (payload.color && light.color) light.color.set(payload.color)
  if (payload.intensity !== undefined && 'intensity' in light) light.intensity = payload.intensity

  if (light.isPointLight || light.isSpotLight) {
    if (payload.distance !== undefined) light.distance = payload.distance
    if (payload.decay !== undefined) light.decay = payload.decay
  }
  if (light.isSpotLight) {
    if (payload.angle !== undefined) light.angle = payload.angle
    if (payload.penumbra !== undefined) light.penumbra = payload.penumbra
  }
  if (light.isRectAreaLight) {
    if (payload.width !== undefined) light.width = payload.width
    if (payload.height !== undefined) light.height = payload.height
  }
  if (light.isHemisphereLight) {
    if (payload.skyColor && light.color) light.color.set(payload.skyColor)
    if (payload.groundColor && light.groundColor) light.groundColor.set(payload.groundColor)
  }
  // 通用阴影配置（适用于 DirectionalLight、SpotLight、PointLight）
  const canCastShadow = light.isDirectionalLight || light.isSpotLight || light.isPointLight
  if (canCastShadow) {
    const shadow = payload.shadow ?? {}
    // 阴影贴图尺寸
    if (shadow.mapSize) {
      const size = shadow.mapSize as [number, number]
      light.shadow.mapSize.set(size[0], size[1])
      if (light.shadow.map) {
        light.shadow.map.needsUpdate = true
      }
    }
    // VSM 阴影需要 radius 和 blurSamples，必须设置默认值
    light.shadow.radius = shadow.radius ?? 4
    light.shadow.blurSamples = shadow.blurSamples ?? 8
    // shadow.bias 用于防止阴影痤疮（条纹），shadow.normalBias 提供更好的效果
    light.shadow.bias = shadow.bias ?? -0.0001
    light.shadow.normalBias = shadow.normalBias ?? 0.02
    // 阴影相机配置
    const camera = shadow.camera ?? {}
    // DirectionalLight 使用正交相机
    if (light.isDirectionalLight) {
      if (camera.left !== undefined) light.shadow.camera.left = camera.left
      if (camera.right !== undefined) light.shadow.camera.right = camera.right
      if (camera.top !== undefined) light.shadow.camera.top = camera.top
      if (camera.bottom !== undefined) light.shadow.camera.bottom = camera.bottom
    }
    // SpotLight 使用透视相机，fov 自动从 light.angle 计算
    if (light.isSpotLight && camera.fov !== undefined) {
      light.shadow.camera.fov = camera.fov
    }
    // 所有类型都有 near 和 far
    if (camera.near !== undefined) light.shadow.camera.near = camera.near
    if (camera.far !== undefined) light.shadow.camera.far = camera.far
    light.shadow.camera.updateProjectionMatrix()
  }
}

/** Sync camera settings for PerspectiveCamera. */
export function applyCameraSettings(camera: PerspectiveCamera, data?: SceneObjectData) {
  if (!data?.camera) return
  const { fov, near, far } = data.camera
  if (fov !== undefined) camera.fov = fov
  if (near !== undefined) camera.near = near
  if (far !== undefined) camera.far = far
  camera.updateProjectionMatrix()
}

/** Sync Scene-level settings (background/environment/fog) from SceneObjectData. */
export function applySceneSettings(scene: Scene, data?: SceneObjectData) {
  if (!data?.scene) return
  const settings = data.scene

  switch (settings.backgroundType) {
    case 'none':
      scene.background = null
      break
    case 'texture':
    case 'cube':
      scene.background = getBackgroundTexture(settings)
      break
    case 'color':
    default:
      scene.background = new Color(settings.backgroundColor ?? '#CFD8DC')
      break
  }

  if (!settings.environmentType || settings.environmentType === 'none') {
    scene.environment = null
  } else {
    scene.environment = getEnvMapTexture(settings.environmentMap, settings.environmentType)
  }

  const fog = settings.fog
  if (!fog || fog.type === 'none') {
    scene.fog = null
  } else if (fog.type === 'linear') {
    scene.fog = new Fog(fog.color ?? '#ffffff', fog.near ?? 1, fog.far ?? 1000)
  } else if (fog.type === 'exp2') {
    scene.fog = new FogExp2(fog.color ?? '#ffffff', fog.density ?? 0.00025)
  }
}

/** Create geometry from GeometryData (fallback: BoxGeometry) */
function createGeometryFromData(geo?: GeometryData) {
  if (!geo) return new BoxGeometry(1, 1, 1)

  switch (geo.type) {
    case 'box':
      return new BoxGeometry(
        geo.width ?? 1,
        geo.height ?? 1,
        geo.depth ?? 1,
        geo.widthSegments ?? 1,
        geo.heightSegments ?? 1,
        geo.depthSegments ?? 1
      )
    case 'sphere':
      return new SphereGeometry(
        geo.radius ?? 1,
        geo.widthSegments ?? 32,
        geo.heightSegments ?? 16,
        geo.phiStart ?? 0,
        geo.phiLength ?? Math.PI * 2,
        geo.thetaStart ?? 0,
        geo.thetaLength ?? Math.PI
      )
    case 'cylinder':
      return new CylinderGeometry(
        geo.radiusTop ?? 1,
        geo.radiusBottom ?? 1,
        geo.height ?? 2,
        geo.radialSegments ?? 32,
        geo.heightSegments ?? 1,
        geo.openEnded ?? false,
        geo.thetaStart ?? 0,
        geo.thetaLength ?? Math.PI * 2
      )
    case 'cone':
      return new ConeGeometry(
        geo.radius ?? 1,
        geo.height ?? 2,
        geo.radialSegments ?? 32,
        geo.heightSegments ?? 1,
        geo.openEnded ?? false,
        geo.thetaStart ?? 0,
        geo.thetaLength ?? Math.PI * 2
      )
    case 'plane':
      return new PlaneGeometry(geo.width ?? 1, geo.height ?? 1, geo.widthSegments ?? 1, geo.heightSegments ?? 1)
    case 'torus':
      return new TorusGeometry(
        geo.radius ?? 1,
        geo.tube ?? 0.4,
        geo.radialSegments ?? 8,
        geo.tubularSegments ?? 6,
        geo.arc ?? Math.PI * 2
      )
    case 'torusKnot':
      return new TorusKnotGeometry(
        geo.radius ?? 1,
        geo.tube ?? 0.4,
        geo.tubularSegments ?? 64,
        geo.radialSegments ?? 8,
        geo.p ?? 2,
        geo.q ?? 3
      )
    case 'tetrahedron':
      return new TetrahedronGeometry(geo.radius ?? 1, geo.detail ?? 0)
    case 'octahedron':
      return new OctahedronGeometry(geo.radius ?? 1, geo.detail ?? 0)
    case 'dodecahedron':
      return new DodecahedronGeometry(geo.radius ?? 1, geo.detail ?? 0)
    case 'icosahedron':
      return new IcosahedronGeometry(geo.radius ?? 1, geo.detail ?? 0)
    case 'circle':
      return new CircleGeometry(
        geo.radius ?? 1,
        geo.segments ?? 8,
        geo.thetaStart ?? 0,
        geo.thetaLength ?? Math.PI * 2
      )
    case 'ring':
      return new RingGeometry(
        geo.innerRadius ?? 0.5,
        geo.outerRadius ?? 1,
        geo.thetaSegments ?? 8,
        geo.phiSegments ?? 1,
        geo.thetaStart ?? 0,
        geo.thetaLength ?? Math.PI * 2
      )
    case 'capsule':
      return new CapsuleGeometry(
        geo.radius ?? 1,
        geo.length ?? 1,
        geo.capSegments ?? 4,
        geo.radialSegments ?? 8
      )
    default:
      return new BoxGeometry(1, 1, 1)
  }
}

/** Create material from MaterialData (fallback: MeshStandardMaterial) */
function createMaterialFromData(mat?: MaterialData) {
  if (!mat) return new MeshStandardMaterial({ color: 0xffffff })

  const baseColor = mat?.color ? new Color(mat.color) : new Color('#ffffff')

  switch (mat.type) {
    case 'basic': {
      const material = new MeshBasicMaterial({ color: baseColor })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'lambert': {
      const material = new MeshLambertMaterial({ color: baseColor })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'phong': {
      const material = new MeshPhongMaterial({
        color: baseColor,
        specular: new Color(mat.specular ?? '#111111'),
        shininess: mat.shininess ?? 30
      })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'standard': {
      const material = new MeshStandardMaterial({
        color: baseColor,
        roughness: mat.roughness ?? 1,
        metalness: mat.metalness ?? 0
      })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'physical': {
      const material = new MeshPhysicalMaterial({
        color: baseColor,
        roughness: mat.roughness ?? 1,
        metalness: mat.metalness ?? 0,
        clearcoat: mat.clearcoat ?? 0,
        clearcoatRoughness: mat.clearcoatRoughness ?? 0,
        ior: mat.ior ?? 1.5,
        transmission: mat.transmission ?? 0,
        thickness: mat.thickness ?? 0.01
      })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'toon': {
      const material = new MeshToonMaterial({ color: baseColor })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'matcap': {
      const material = new MeshMatcapMaterial({ color: baseColor })
      applyCommonMaterialProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'lineBasic': {
      const material = new LineBasicMaterial({ color: baseColor, linewidth: mat.linewidth ?? 1 })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      return material
    }
    case 'lineDashed': {
      const material = new LineDashedMaterial({
        color: baseColor,
        linewidth: mat.linewidth ?? 1,
        dashSize: mat.dashSize ?? 3,
        gapSize: mat.gapSize ?? 1,
        scale: mat.scale ?? 1
      })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      return material
    }
    case 'points': {
      const material = new PointsMaterial({ color: baseColor, size: mat.size ?? 1, sizeAttenuation: mat.sizeAttenuation ?? true })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'sprite': {
      const material = new SpriteMaterial({ color: baseColor })
      applyCommonMaterialProps(material, mat)
      applyMaps(material, mat)
      return material
    }
    case 'shadow': {
      const material = new ShadowMaterial({ opacity: mat.opacity ?? 1 })
      applyCommonMaterialProps(material, mat)
      return material
    }
    default: {
      const material = new MeshStandardMaterial({ color: baseColor })
      applyCommonMaterialProps(material, mat)
      applyMaterialSpecificProps(material, mat)
      applyMaps(material, mat)
      return material
    }
  }
}

export function updateMeshGeometry(mesh: Mesh, geometry?: GeometryData) {
  if (!geometry) return
  const nextGeometry = createGeometryFromData(geometry)
  ensureUV2(nextGeometry) // 确保有 uv2 属性，让 aoMap 和 lightMap 正常工作
  const prevGeometry = mesh.geometry
  mesh.geometry = nextGeometry
  if (prevGeometry && typeof (prevGeometry as any).dispose === 'function') {
    ;(prevGeometry as any).dispose()
  }
}

function materialMatchesType(material: any, type: MaterialData['type']) {
  switch (type) {
    case 'basic':
      return material instanceof MeshBasicMaterial
    case 'lambert':
      return material instanceof MeshLambertMaterial
    case 'phong':
      return material instanceof MeshPhongMaterial
    case 'standard':
      return material instanceof MeshStandardMaterial
    case 'physical':
      return material instanceof MeshPhysicalMaterial
    case 'toon':
      return material instanceof MeshToonMaterial
    case 'matcap':
      return material instanceof MeshMatcapMaterial
    case 'lineBasic':
      return material instanceof LineBasicMaterial
    case 'lineDashed':
      return material instanceof LineDashedMaterial
    case 'points':
      return material instanceof PointsMaterial
    case 'sprite':
      return material instanceof SpriteMaterial
    case 'shadow':
      return material instanceof ShadowMaterial
    default:
      return false
  }
}

export function updateMeshMaterial(mesh: Mesh, material?: MaterialData) {
  if (!material) return
  const prevMaterial = mesh.material
  if (!Array.isArray(prevMaterial) && materialMatchesType(prevMaterial, material.type)) {
    applyCommonMaterialProps(prevMaterial, material)
    applyMaterialSpecificProps(prevMaterial, material)
    applyMaps(prevMaterial, material)
    prevMaterial.needsUpdate = true
    return
  }

  const nextMaterial = createMaterialFromData(material)
  mesh.material = nextMaterial
  if (Array.isArray(prevMaterial)) {
    prevMaterial.forEach((mat) => {
      if (mat && typeof (mat as any).dispose === 'function') (mat as any).dispose()
    })
  } else if (prevMaterial && typeof (prevMaterial as any).dispose === 'function') {
    ;(prevMaterial as any).dispose()
  }
}

/** Create helper-style Object3D instances from HelperData */
function createHelperFromData(helper?: HelperData, objectsMap?: Map<string, Object3D>) {
  if (!helper) return new AxesHelper(1)

  const target = helper && 'targetId' in helper && helper.targetId ? objectsMap?.get(helper.targetId) : undefined

  switch (helper.type) {
    case 'axes':
      return new AxesHelper(helper.size ?? 1)
    case 'grid':
      return new GridHelper(
        helper.size ?? 10,
        helper.divisions ?? 10,
        helper.colorCenterLine ?? '#444444',
        helper.colorGrid ?? '#888888'
      )
    case 'polarGrid':
      return new PolarGridHelper(
        helper.radius ?? 5,
        helper.radials ?? 16,
        helper.circles ?? 8,
        helper.divisions ?? 64,
        helper.color1 ?? '#444444',
        helper.color2 ?? '#888888'
      )
    case 'arrow': {
      const dir = helper.dir ?? [0, 1, 0]
      const origin = helper.origin ?? [0, 0, 0]
      const dirVec = new Vector3(dir[0], dir[1], dir[2]).normalize()
      const originVec = new Vector3(origin[0], origin[1], origin[2])
      return new ArrowHelper(
        dirVec,
        originVec,
        helper.length ?? 1,
        helper.color ?? '#ffffff',
        helper.headLength,
        helper.headWidth
      )
    }
    case 'box':
      return target ? new BoxHelper(target, helper.color) : new AxesHelper(1)
    case 'box3': {
      const min = helper.min ?? [0, 0, 0]
      const max = helper.max ?? [1, 1, 1]
      return new Box3Helper(new Box3(new Vector3(min[0], min[1], min[2]), new Vector3(max[0], max[1], max[2])), helper.color)
    }
    case 'camera':
      return target ? new CameraHelper(target as any) : new AxesHelper(1)
    case 'directionalLight':
      return target ? new DirectionalLightHelper(target as any, helper.size, helper.color) : new AxesHelper(1)
    case 'hemisphereLight':
      return target ? new HemisphereLightHelper(target as any, helper.size ?? 1, helper.color) : new AxesHelper(1)
    case 'pointLight':
      return target ? new PointLightHelper(target as any, helper.sphereSize, helper.color) : new AxesHelper(1)
    case 'spotLight':
      return target ? new SpotLightHelper(target as any, helper.color) : new AxesHelper(1)
    case 'rectAreaLight':
      return target ? new RectAreaLightHelper(target as any, helper.color) : new AxesHelper(1)
    case 'plane': {
      const normal = helper.normal ?? [0, 1, 0]
      const plane = new Plane(new Vector3(normal[0], normal[1], normal[2]).normalize(), helper.constant ?? 0)
      return new PlaneHelper(plane, helper.size ?? 1, new Color(helper.color ?? '#444444').getHex())
    }
    case 'skeleton':
      return target ? new SkeletonHelper(target as any) : new AxesHelper(1)
    case 'lightProbe':
      return target ? new LightProbeHelper(target as any, helper.size ?? 1) : new AxesHelper(1)
    case 'vertexNormals':
      return target ? new VertexNormalsHelper(target as any, helper.size ?? 1, new Color(helper.color ?? '#444444').getHex()) : new AxesHelper(1)
    default:
      return new AxesHelper(1)
  }
}

function createLightFromData(data: SceneObjectData) {
  const lightType = (data.userData as any)?.lightType as string | undefined
  const color = (data.userData as any)?.color ?? '#ffffff'
  const intensity = (data.userData as any)?.intensity ?? 1

  switch (lightType) {
    case 'directionalLight':
      return new DirectionalLight(color, intensity)
    case 'pointLight':
      return new PointLight(color, intensity, (data.userData as any)?.distance ?? 0, (data.userData as any)?.decay ?? 2)
    case 'spotLight':
      return new SpotLight(
        color,
        intensity,
        (data.userData as any)?.distance ?? 0,
        (data.userData as any)?.angle ?? Math.PI / 3,
        (data.userData as any)?.penumbra ?? 0,
        (data.userData as any)?.decay ?? 2
      )
    case 'hemisphereLight':
      return new HemisphereLight(
        (data.userData as any)?.skyColor ?? '#ffffff',
        (data.userData as any)?.groundColor ?? '#444444',
        intensity
      )
    case 'rectAreaLight':
      return new RectAreaLight(
        color,
        intensity,
        (data.userData as any)?.width ?? 10,
        (data.userData as any)?.height ?? 10
      )
    case 'ambientLight':
      return new AmbientLight(color, intensity)
    default:
      return new DirectionalLight(color, intensity)
  }
}

/** Create Three Object3D from SceneObjectData (geometry, material, helper, name) */
export function createThreeObject(data: SceneObjectData, opts?: { objectsMap?: Map<string, Object3D> }): Object3D {
  let obj: Object3D
  switch (data.type) {
    case 'group':
    case 'model':
    case 'pointCloud':
      obj = new Group()
      break
    case 'mesh': {
      const geometry = createGeometryFromData(data.mesh?.geometry)
      ensureUV2(geometry) // 确保有 uv2 属性，让 aoMap 和 lightMap 正常工作
      obj = new Mesh(geometry, createMaterialFromData(data.mesh?.material))
      break
    }
    case 'camera': {
      const cameraOpts = data.camera as {
        fov?: number
        near?: number
        far?: number
      } | undefined
      obj = new PerspectiveCamera(
        cameraOpts?.fov ?? 50,
        1,
        cameraOpts?.near ?? 0.01,
        cameraOpts?.far ?? 2000
      )
      break
    }
    case 'helper':
      obj = createHelperFromData(data.helper, opts?.objectsMap)
      break
    case 'light':
      obj = createLightFromData(data)
      // 立即应用灯光设置（包括阴影配置）
      applyLightSettings(obj, data)
      break
    default:
      obj = new Object3D()
  }
  obj.name = data.name ?? data.id
  obj.userData.sceneObjectId = data.id
  obj.userData.sceneObjectType = data.type
  applyTransform(obj, data)
  return obj
}

// 导出验证函数供其他模块使用
export { isValidTextureSource }
