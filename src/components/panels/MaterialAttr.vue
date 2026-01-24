<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useMessage } from 'naive-ui'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { usePropertyBinding } from '@/composables/usePropertyBinding'
import { createDefaultMaterialData } from '@/utils/sceneFactory.ts'
import { PropertyNumber, PropertySwitch, PropertyColor, PropertySelect, PropertyInputNumber } from './properties'
import TextureManager from './TextureManager.vue'
import type {
  MaterialData,
  MeshPhongMaterialData,
  MeshStandardMaterialData,
  MeshPhysicalMaterialData,
  MeshToonMaterialData,
  MeshMatcapMaterialData,
  LineBasicMaterialData,
  LineDashedMaterialData,
  PointsMaterialData
} from '@/types/material'
import type { AssetRef } from '@/types/asset'
import {
  getTextureSlotLabel,
  type TextureSlot
} from '@/utils/texturePackLoader'

const sceneStore = useSceneStore()
const message = useMessage()
const { getSelectedId, getSelectedData } = usePropertyBinding()

// 贴图资产选择器状态
const showTexturePicker = ref(false)
const texturePickerSlot = ref<TextureSlot | undefined>(undefined)

// 当前选中对象的材质数据
const material = computed(() => sceneStore.selectedObjectData?.mesh?.material as MaterialData | undefined)
const materialType = computed(() => material.value?.type)

const showMapFields = computed(() => ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon', 'sprite', 'points'].includes(materialType.value ?? ''))
const showEnvMap = computed(() => ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
const showLightMap = computed(() => ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
const showBumpMap = computed(() => ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
const showNormalDisplacement = computed(() => ['lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
const showEmissive = computed(() => ['lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
const showAo = computed(() => ['standard', 'physical'].includes(materialType.value ?? ''))
const showStandard = computed(() => ['standard', 'physical'].includes(materialType.value ?? ''))
const showPhysical = computed(() => materialType.value === 'physical')
const showPhong = computed(() => materialType.value === 'phong')
const showToon = computed(() => materialType.value === 'toon')
const showMatcap = computed(() => materialType.value === 'matcap')
const showLineBasic = computed(() => materialType.value === 'lineBasic')
const showLineDashed = computed(() => materialType.value === 'lineDashed')
const showPoints = computed(() => materialType.value === 'points')
const showSprite = computed(() => materialType.value === 'sprite')

type MapLikeMaterial = MaterialData & {
  map?: string
  alphaMap?: string
  envMap?: string | string[]
  envMapIntensity?: number
  envMapType?: 'equirect' | 'hdr' | 'cube'
  lightMap?: string
  lightMapIntensity?: number
  bumpMap?: string
  bumpScale?: number
  clearcoatMap?: string
  clearcoatRoughnessMap?: string
  sheenColorMap?: string
  sheenRoughnessMap?: string
  iridescenceMap?: string
  iridescenceThicknessMap?: string
  specularIntensityMap?: string
  specularColorMap?: string
  textureNames?: Record<string, string>
}

type NormalDisplacementMaterial = MapLikeMaterial & {
  normalMap?: string
  normalScale?: number
  displacementMap?: string
  displacementScale?: number
  displacementBias?: number
}

type EmissiveMaterial = NormalDisplacementMaterial & {
  emissive?: string
  emissiveIntensity?: number
  emissiveMap?: string
}

type AOMaterial = EmissiveMaterial & {
  aoMap?: string
  aoMapIntensity?: number
  armMap?: string
  roughnessMap?: string
  metalnessMap?: string
}

const phongMaterial = computed(() => material.value?.type === 'phong' ? (material.value as MeshPhongMaterialData) : null)
const standardMaterial = computed(() => material.value?.type === 'standard' ? (material.value as MeshStandardMaterialData) : null)
const physicalMaterial = computed(() => material.value?.type === 'physical' ? (material.value as MeshPhysicalMaterialData) : null)
const toonMaterial = computed(() => material.value?.type === 'toon' ? (material.value as MeshToonMaterialData) : null)
const matcapMaterial = computed(() => material.value?.type === 'matcap' ? (material.value as MeshMatcapMaterialData) : null)
const lineBasicMaterial = computed(() => material.value?.type === 'lineBasic' ? (material.value as LineBasicMaterialData) : null)
const lineDashedMaterial = computed(() => material.value?.type === 'lineDashed' ? (material.value as LineDashedMaterialData) : null)
const pointsMaterial = computed(() => material.value?.type === 'points' ? (material.value as PointsMaterialData) : null)
const spriteMaterial = computed(() => material.value?.type === 'sprite' ? material.value : null)
const mapMaterial = computed(() => showMapFields.value ? (material.value as MapLikeMaterial) : null)
const normalDisplacementMaterial = computed(() => showNormalDisplacement.value ? (material.value as NormalDisplacementMaterial) : null)
const emissiveMaterial = computed(() => showEmissive.value ? (material.value as EmissiveMaterial) : null)
const aoMaterial = computed(() => showAo.value ? (material.value as AOMaterial) : null)

const textureFileNames = reactive<Record<string, string>>({})
const textureFileLists = reactive<Record<string, string[]>>({})

const sideOptions = [
  { label: '正面', value: 'front' },
  { label: '背面', value: 'back' },
  { label: '双面', value: 'double' }
]
const wrapOptions = [
  { label: '重复', value: 'repeat' },
  { label: '拉伸到边缘', value: 'clampToEdge' },
  { label: '镜像平铺', value: 'mirroredRepeat' }
]
const filterOptions = [
  { label: 'nearest', value: 'nearest' },
  { label: 'linear', value: 'linear' },
  { label: 'nearestMipmapNearest', value: 'nearestMipmapNearest' },
  { label: 'linearMipmapNearest', value: 'linearMipmapNearest' },
  { label: 'nearestMipmapLinear', value: 'nearestMipmapLinear' },
  { label: 'linearMipmapLinear', value: 'linearMipmapLinear' }
]
const linecapOptions = [
  { label: 'butt', value: 'butt' },
  { label: 'round', value: 'round' },
  { label: 'square', value: 'square' }
]
const linejoinOptions = [
  { label: 'round', value: 'round' },
  { label: 'bevel', value: 'bevel' },
  { label: 'miter', value: 'miter' }
]
const blendingOptions = [
  { label: 'normal', value: 'normal' },
  { label: 'additive', value: 'additive' },
  { label: 'subtractive', value: 'subtractive' },
  { label: 'multiply', value: 'multiply' },
  { label: 'custom', value: 'custom' }
]
const depthFuncOptions = [
  { label: 'never', value: 'never' },
  { label: 'always', value: 'always' },
  { label: 'less', value: 'less' },
  { label: 'lequal', value: 'lequal' },
  { label: 'equal', value: 'equal' },
  { label: 'gequal', value: 'gequal' },
  { label: 'greater', value: 'greater' },
  { label: 'notequal', value: 'notequal' }
]
const materialTypeOptions = [
  { label: '基础材质', value: 'basic' },
  { label: 'Lambert', value: 'lambert' },
  { label: 'Phong', value: 'phong' },
  { label: '标准PBR', value: 'standard' },
  { label: '物理PBR', value: 'physical' },
  { label: '卡通', value: 'toon' },
  { label: 'Matcap', value: 'matcap' },
  { label: '线条', value: 'lineBasic' },
  { label: '虚线', value: 'lineDashed' },
  { label: '点', value: 'points' },
  { label: '精灵', value: 'sprite' },
  { label: '阴影', value: 'shadow' }
]

// 材质属性更新函数（用于复杂更新场景，如贴图）
function updateMaterial(patch: Record<string, unknown>) {
  const id = getSelectedId()
  if (!id) return
  const currentMesh = getSelectedData()?.mesh
  if (!currentMesh?.material) return
  const nextMaterial = { ...currentMesh.material, ...patch }
  const nextMesh = { ...currentMesh, material: nextMaterial }
  sceneStore.updateSceneObjectData(id, { mesh: nextMesh } as any)
}

function resetTextureUiState() {
  Object.keys(textureFileNames).forEach((key) => delete textureFileNames[key])
  Object.keys(textureFileLists).forEach((key) => delete textureFileLists[key])
}

function updateMaterialType(value: string) {
  const nextType = value as MaterialData['type']
  if (nextType === materialType.value) return
  const id = getSelectedId()
  if (!id) return
  const currentMesh = getSelectedData()?.mesh
  if (!currentMesh) return
  const nextMaterial = createDefaultMaterialData(nextType)
  const nextMesh = { ...currentMesh, material: nextMaterial }
  sceneStore.updateSceneObjectData(id, { mesh: nextMesh } as any)
  resetTextureUiState()
}

function updateMaterialTextureName(key: string, name: string) {
  const currentNames = (material.value as any)?.textureNames ?? {}
  updateMaterial({
    textureNames: {
      ...currentNames,
      [key]: name
    }
  })
}

// 打开贴图选择器
function openTexturePicker(slot: TextureSlot) {
  texturePickerSlot.value = slot
  showTexturePicker.value = true
}

// 从资产库选择贴图后的处理
function handleTextureSelect(asset: AssetRef, slot?: TextureSlot) {
  if (!slot) return

  // ARM 贴图需要特殊处理，同时填充多个槽位
  if (slot === 'armMap') {
    applyArmMap(asset)
    return
  }

  sceneStore.registerRemoteAsset(asset)
  updateMaterialTextureName(slot, asset.name)

  if (slot === 'envMap') {
    const isHdr = asset.name.toLowerCase().endsWith('.hdr')
    updateMaterial({
      envMap: asset.uri,
      envMapType: isHdr ? 'hdr' : 'equirect'
    })
  } else {
    updateMaterial({ [slot]: asset.uri })
  }

  showTexturePicker.value = false
  texturePickerSlot.value = undefined
  message.success(`已应用贴图 "${asset.name}"`)
}

// 清除贴图
function clearTexture(key: string) {
  updateMaterialTextureName(key, '')
  if (key === 'envMap') {
    updateMaterial({
      envMap: undefined,
      envMapType: undefined
    })
  } else {
    updateMaterial({ [key]: undefined })
  }
  delete textureFileNames[key]
  delete textureFileLists[key]
}

// 应用 ARM 贴图（同时填充 aoMap、roughnessMap、metalnessMap）
function applyArmMap(asset: AssetRef) {
  sceneStore.registerRemoteAsset(asset)
  const currentNames = (material.value as any)?.textureNames ?? {}
  updateMaterial({
    armMap: asset.uri,
    aoMap: asset.uri,
    roughnessMap: asset.uri,
    metalnessMap: asset.uri,
    textureNames: {
      ...currentNames,
      armMap: asset.name,
      aoMap: asset.name,
      roughnessMap: asset.name,
      metalnessMap: asset.name
    }
  })
  showTexturePicker.value = false
  texturePickerSlot.value = undefined
  message.success(`已应用 ARM 贴图 "${asset.name}"`)
}

// 清除 ARM 贴图（同时清除 aoMap、roughnessMap、metalnessMap）
function clearArmMap() {
  const currentNames = (material.value as any)?.textureNames ?? {}
  updateMaterial({
    armMap: undefined,
    aoMap: undefined,
    roughnessMap: undefined,
    metalnessMap: undefined,
    textureNames: {
      ...currentNames,
      armMap: '',
      aoMap: '',
      roughnessMap: '',
      metalnessMap: ''
    }
  })
  delete textureFileNames['armMap']
  delete textureFileNames['aoMap']
  delete textureFileNames['roughnessMap']
  delete textureFileNames['metalnessMap']
}

function getTextureLabel(key: string) {
  const persisted = (material.value as any)?.textureNames?.[key]
  if (persisted) return persisted
  const list = textureFileLists[key]
  if (list && list.length) return list.join(', ')
  return textureFileNames[key] ?? ''
}

const envMapArray = computed(() => {
  const envMap = mapMaterial.value?.envMap
  return Array.isArray(envMap) ? envMap : []
})
const envMapPreviewList = computed(() => envMapArray.value.filter(isPreviewableTexture))

function isPreviewableTexture(value?: string) {
  if (!value) return false
  return value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')
}

// Vec2 更新辅助
function updateMaterialVec2(key: string, axis: 0 | 1, value: number | null, fallback: [number, number]) {
  const current = (material.value as any)?.[key] ?? fallback
  const next: [number, number] = [Number(current[0] ?? fallback[0]), Number(current[1] ?? fallback[1])]
  next[axis] = Number(value ?? 0)
  updateMaterial({ [key]: next })
}
</script>

<template>
  <span>材质属性</span>
  <br/>
  <br/>
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
  <n-flex class="n-flex" vertical>
    <!-- 类型 -->
    <n-grid x-gap="12" :cols="8">
      <n-gi class="gid-item" :span="2">类型</n-gi>
      <n-gi class="gid-item" :span="6">
        <n-select
          :options="materialTypeOptions"
          :value="materialType"
          placeholder="选择材质类型"
          @update:value="(v: string) => updateMaterialType(v)"
        />
      </n-gi>
    </n-grid>

    <!-- 颜色 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyColor path="mesh.material.color" default-value="#ffffff" />
      </n-gi>
    </n-grid>

    <!-- 透明度 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">透明度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.opacity" :default-value="1" :step="0.01" :min="0" :max="1" />
      </n-gi>
    </n-grid>

    <!-- 透明 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">透明</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.transparent" :default-value="false" />
      </n-gi>
    </n-grid>

    <!-- 深度测试 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">深度测试</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.depthTest" :default-value="true" />
      </n-gi>
    </n-grid>

    <!-- 深度缓冲 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">深度缓冲</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.depthWrite" :default-value="true" />
      </n-gi>
    </n-grid>

    <!-- 渲染顺序 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">渲染顺序</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyInputNumber path="mesh.material.renderOrder" :default-value="0" placeholder="渲染顺序" />
      </n-gi>
    </n-grid>

    <!-- 渲染面 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">渲染面</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.side" :options="sideOptions" default-value="front" placeholder="渲染面" />
      </n-gi>
    </n-grid>

    <!-- 混合模式 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">混合模式</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.blending" :options="blendingOptions" default-value="normal" placeholder="混合模式" />
      </n-gi>
    </n-grid>

    <!-- 深度函数 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">深度函数</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.depthFunc" :options="depthFuncOptions" default-value="lequal" placeholder="深度函数" />
      </n-gi>
    </n-grid>

    <!-- 预乘透明 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">预乘透明</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.premultipliedAlpha" :default-value="false" />
      </n-gi>
    </n-grid>

    <!-- 抖动 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">抖动</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.dithering" :default-value="false" />
      </n-gi>
    </n-grid>

    <!-- 多边形偏移 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">多边形偏移</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.polygonOffset" :default-value="false" />
      </n-gi>
    </n-grid>
    <n-grid v-if="(material as any)?.polygonOffset" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">偏移因子</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.polygonOffsetFactor" :default-value="0" :step="0.1" :min="-10" :max="10" :precision="2" />
      </n-gi>
    </n-grid>
    <n-grid v-if="(material as any)?.polygonOffset" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">偏移单位</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.polygonOffsetUnits" :default-value="0" :step="0.1" :min="-10" :max="10" :precision="2" />
      </n-gi>
    </n-grid>

    <!-- 线框 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">线框</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.wireframe" :default-value="false" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">线框宽度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyInputNumber path="mesh.material.wireframeLinewidth" :default-value="1" placeholder="线框宽度" />
      </n-gi>
    </n-grid>

    <!-- 贴图平铺 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">贴图平铺U</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.wrapS" :options="wrapOptions" default-value="repeat" placeholder="贴图平铺U" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">贴图平铺V</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.wrapT" :options="wrapOptions" default-value="repeat" placeholder="贴图平铺V" />
      </n-gi>
    </n-grid>

    <!-- 重复次数 -->
    <n-grid x-gap="6" :cols="11">
      <n-gi class="gid-item" :span="2">重复次数</n-gi>
      <n-gi class="gid-item" :span="3">
        <PropertyNumber path="mesh.material.repeatX" :default-value="1" :step="0.1" :min="0.01" :max="100" :precision="2" placeholder="U" />
      </n-gi>
      <n-gi class="gid-item" :span="3">
        <PropertyNumber path="mesh.material.repeatY" :default-value="1" :step="0.1" :min="0.01" :max="100" :precision="2" placeholder="V" />
      </n-gi>
      <n-gi class="gid-item" :span="3">
        <n-button size="small" quaternary @click="updateMaterial({ repeatX: 1, repeatY: 1 })">重置</n-button>
      </n-gi>
    </n-grid>

    <!-- 贴图偏移 -->
    <n-grid x-gap="6" :cols="11">
      <n-gi class="gid-item" :span="2">贴图偏移</n-gi>
      <n-gi class="gid-item" :span="3">
        <PropertyNumber path="mesh.material.offsetX" :default-value="0" :step="0.05" :min="-10" :max="10" :precision="2" placeholder="U" />
      </n-gi>
      <n-gi class="gid-item" :span="3">
        <PropertyNumber path="mesh.material.offsetY" :default-value="0" :step="0.05" :min="-10" :max="10" :precision="2" placeholder="V" />
      </n-gi>
      <n-gi class="gid-item" :span="3">
        <n-button size="small" quaternary @click="updateMaterial({ offsetX: 0, offsetY: 0 })">重置</n-button>
      </n-gi>
    </n-grid>

    <!-- 过滤 -->
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">放大过滤</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.magFilter" :options="filterOptions" default-value="linear" placeholder="放大过滤" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">缩小过滤</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySelect path="mesh.material.minFilter" :options="filterOptions" default-value="linearMipmapLinear" placeholder="缩小过滤" />
      </n-gi>
    </n-grid>

    <!-- 漫反射贴图 -->
    <n-grid v-if="showMapFields" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">漫反射贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('map')">
            {{ getTextureLabel('map') || '从资产库选择' }}
          </n-button>
          <n-button v-if="mapMaterial?.map" size="small" quaternary class="texture-action-btn" @click="clearTexture('map')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(mapMaterial?.map)"
            :src="mapMaterial?.map"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="漫反射贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- 光照贴图 -->
    <n-grid v-if="showLightMap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">光照贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('lightMap')">
            {{ getTextureLabel('lightMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="mapMaterial?.lightMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('lightMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(mapMaterial?.lightMap)"
            :src="mapMaterial?.lightMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="光照贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showLightMap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">光照强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.lightMapIntensity" :default-value="1" :step="0.01" :min="0" :max="10" />
      </n-gi>
    </n-grid>

    <!-- Alpha贴图 -->
    <n-grid v-if="showMapFields" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">Alpha贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('alphaMap')">
            {{ getTextureLabel('alphaMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="mapMaterial?.alphaMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('alphaMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(mapMaterial?.alphaMap)"
            :src="mapMaterial?.alphaMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="Alpha贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- 凹凸贴图 -->
    <n-grid v-if="showBumpMap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">凹凸贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('bumpMap')">
            {{ getTextureLabel('bumpMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="mapMaterial?.bumpMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('bumpMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(mapMaterial?.bumpMap)"
            :src="mapMaterial?.bumpMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="凹凸贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showBumpMap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">凹凸强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.bumpScale" :default-value="1" :step="0.01" :min="0" :max="10" />
      </n-gi>
    </n-grid>

    <!-- 环境贴图 -->
    <n-grid v-if="showEnvMap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">环境贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('envMap')">
            {{ getTextureLabel('envMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="mapMaterial?.envMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('envMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image-group v-if="envMapPreviewList.length">
            <div class="texture-preview-row">
              <n-image
                v-for="(url, index) in envMapPreviewList"
                :key="index"
                :src="url"
                class="texture-preview-container"
                :img-props="{ class: 'texture-preview-thumb' }"
                alt="环境贴图预览"
              />
            </div>
          </n-image-group>
          <n-image
            v-else-if="isPreviewableTexture(mapMaterial?.envMap as string)"
            :src="mapMaterial?.envMap as string"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="环境贴图预览"
          />
        </div>
        <div v-if="mapMaterial?.envMapType === 'hdr'" class="texture-meta">HDR环境贴图（无预览）</div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showEnvMap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">环境强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.envMapIntensity" :default-value="1" :step="0.01" :min="0" :max="10" />
      </n-gi>
    </n-grid>

    <!-- 法线贴图 -->
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">法线贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('normalMap')">
            {{ getTextureLabel('normalMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="normalDisplacementMaterial?.normalMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('normalMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(normalDisplacementMaterial?.normalMap)"
            :src="normalDisplacementMaterial?.normalMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="法线贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">法线强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.normalScale" :default-value="1" :step="0.01" :min="0" :max="10" />
      </n-gi>
    </n-grid>

    <!-- 位移贴图 -->
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">位移贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('displacementMap')">
            {{ getTextureLabel('displacementMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="normalDisplacementMaterial?.displacementMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('displacementMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(normalDisplacementMaterial?.displacementMap)"
            :src="normalDisplacementMaterial?.displacementMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="位移贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">位移强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.displacementScale" :default-value="0" :step="0.01" :min="0" :max="100" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">位移偏移</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.displacementBias" :default-value="0" :step="0.01" :min="-10" :max="10" />
      </n-gi>
    </n-grid>

    <!-- 自发光 -->
    <n-grid v-if="showEmissive" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">自发光颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyColor path="mesh.material.emissive" default-value="#000000" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showEmissive" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">自发光强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.emissiveIntensity" :default-value="1" :step="0.01" :min="0" :max="10" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showEmissive" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">自发光贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('emissiveMap')">
            {{ getTextureLabel('emissiveMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="emissiveMaterial?.emissiveMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('emissiveMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(emissiveMaterial?.emissiveMap)"
            :src="emissiveMaterial?.emissiveMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="自发光贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- ARM 打包贴图 -->
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">
        <n-tooltip trigger="hover">
          <template #trigger>
            <span style="cursor: help; border-bottom: 1px dashed var(--n-text-color);">ARM贴图</span>
          </template>
          打包贴图：R=AO, G=Roughness, B=Metalness<br/>
          选择后会自动填充 AO/粗糙/金属 三个贴图槽位
        </n-tooltip>
      </n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('armMap')">
            {{ getTextureLabel('armMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="aoMaterial?.armMap" size="small" quaternary class="texture-action-btn" @click="clearArmMap()" title="清除 ARM 贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(aoMaterial?.armMap)"
            :src="aoMaterial?.armMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="ARM贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- AO贴图 -->
    <n-grid v-if="showAo" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">AO贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('aoMap')">
            {{ getTextureLabel('aoMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="aoMaterial?.aoMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('aoMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(aoMaterial?.aoMap)"
            :src="aoMaterial?.aoMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="AO贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showAo" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">AO强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.aoMapIntensity" :default-value="1" :step="0.01" :min="0" :max="10" />
      </n-gi>
    </n-grid>

    <!-- Phong 高光 -->
    <n-grid v-if="showPhong" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高光颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyColor path="mesh.material.specular" default-value="#111111" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhong" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高光强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.shininess" :default-value="30" :step="1" :min="0" :max="1000" :precision="0" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhong" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高光贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('specularMap')">
            {{ getTextureLabel('specularMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="phongMaterial?.specularMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('specularMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(phongMaterial?.specularMap)"
            :src="phongMaterial?.specularMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="高光贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- Standard PBR 属性 -->
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">粗糙度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.roughness" :default-value="1" :step="0.01" :min="0" :max="1" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">金属度</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertyNumber path="mesh.material.metalness" :default-value="0" :step="0.01" :min="0" :max="1" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">alpha测试</n-gi>
      <n-gi class="gid-item" :span="7">
        <PropertySwitch path="mesh.material.alphaTest" :default-value="false" />
      </n-gi>
    </n-grid>

    <!-- 粗糙/金属贴图 -->
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">粗糙贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('roughnessMap')">
            {{ getTextureLabel('roughnessMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="standardMaterial?.roughnessMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('roughnessMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(standardMaterial?.roughnessMap)"
            :src="standardMaterial?.roughnessMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="粗糙贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">金属贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('metalnessMap')">
            {{ getTextureLabel('metalnessMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="standardMaterial?.metalnessMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('metalnessMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(standardMaterial?.metalnessMap)"
            :src="standardMaterial?.metalnessMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="金属贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- Physical 材质高级属性 -->
    <template v-if="showPhysical">
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">清漆强度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.clearcoat" :default-value="0" :step="0.01" :min="0" :max="1" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">清漆粗糙</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.clearcoatRoughness" :default-value="0" :step="0.01" :min="0" :max="1" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">折射率</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.ior" :default-value="1.5" :step="0.01" :min="1" :max="5" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">透射强度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.transmission" :default-value="0" :step="0.01" :min="0" :max="1" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">厚度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.thickness" :default-value="0" :step="0.1" :min="0" :max="10" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">绒毛强度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.sheen" :default-value="0" :step="0.01" :min="0" :max="1" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">绒毛颜色</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyColor path="mesh.material.sheenColor" default-value="#ffffff" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">绒毛粗糙</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.sheenRoughness" :default-value="1" :step="0.01" :min="0" :max="1" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">彩虹强度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.iridescence" :default-value="0" :step="0.01" :min="0" :max="1" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">彩虹折射率</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.iridescenceIOR" :default-value="1.3" :step="0.01" :min="1" :max="5" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">高光强度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.specularIntensity" :default-value="1" :step="0.01" :min="0" :max="2" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">高光颜色</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyColor path="mesh.material.specularColor" default-value="#ffffff" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">衰减颜色</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyColor path="mesh.material.attenuationColor" default-value="#ffffff" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">衰减距离</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.attenuationDistance" :default-value="0" :step="0.1" :min="0" :max="100000" :precision="2" />
        </n-gi>
      </n-grid>
    </template>

    <!-- Toon 渐变贴图 -->
    <n-grid v-if="showToon" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">渐变贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('gradientMap' as any)">
            {{ getTextureLabel('gradientMap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="toonMaterial?.gradientMap" size="small" quaternary class="texture-action-btn" @click="clearTexture('gradientMap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(toonMaterial?.gradientMap)"
            :src="toonMaterial?.gradientMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="渐变贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- Matcap 贴图 -->
    <n-grid v-if="showMatcap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">MatCap贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-button size="small" class="texture-button" @click="openTexturePicker('matcap' as any)">
            {{ getTextureLabel('matcap') || '从资产库选择' }}
          </n-button>
          <n-button v-if="matcapMaterial?.matcap" size="small" quaternary class="texture-action-btn" @click="clearTexture('matcap')" title="清除贴图">
            <template #icon><n-icon size="14">✕</n-icon></template>
          </n-button>
          <n-image
            v-if="isPreviewableTexture(matcapMaterial?.matcap)"
            :src="matcapMaterial?.matcap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="MatCap贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>

    <!-- Line Basic 属性 -->
    <template v-if="showLineBasic">
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">线条宽度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyInputNumber path="mesh.material.linewidth" :default-value="1" placeholder="线条宽度" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">线端</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertySelect path="mesh.material.linecap" :options="linecapOptions" default-value="round" placeholder="线端" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">拐角</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertySelect path="mesh.material.linejoin" :options="linejoinOptions" default-value="round" placeholder="拐角" />
        </n-gi>
      </n-grid>
    </template>

    <!-- Line Dashed 属性 -->
    <template v-if="showLineDashed">
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">虚线长度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.dashSize" :default-value="1" :step="0.1" :min="0" :max="1000" :precision="2" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">间隔长度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.gapSize" :default-value="1" :step="0.1" :min="0" :max="1000" :precision="2" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">比例</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.scale" :default-value="1" :step="0.1" :min="0" :max="100" :precision="2" />
        </n-gi>
      </n-grid>
    </template>

    <!-- Points 属性 -->
    <template v-if="showPoints">
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">点大小</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber path="mesh.material.size" :default-value="1" :step="0.1" :min="0" :max="1000" :precision="2" />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">距离衰减</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertySwitch path="mesh.material.sizeAttenuation" :default-value="true" />
        </n-gi>
      </n-grid>
    </template>

    <!-- Sprite 属性 -->
    <template v-if="showSprite">
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">大小衰减</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertySwitch path="mesh.material.sizeAttenuation" :default-value="true" />
        </n-gi>
      </n-grid>
    </template>
  </n-flex>
  </n-scrollbar>

  <!-- 贴图资产选择器弹窗 -->
  <n-modal
    v-model:show="showTexturePicker"
    preset="card"
    :title="texturePickerSlot ? `选择${getTextureSlotLabel(texturePickerSlot)}` : '选择贴图'"
    :style="{ width: '600px', height: '500px' }"
  >
    <TextureManager
      :select-mode="true"
      :target-slot="texturePickerSlot"
      @select="handleTextureSelect"
      @close="showTexturePicker = false"
    />
  </n-modal>
</template>

<style scoped>
.n-flex {
  padding-bottom: 5vw;
}
.gid-item {
  margin-block: auto;
  font-weight: bold;
  margin-right: 0.3vw;
  margin-bottom: 0.5vw;
}
.texture-row {
  display: flex;
  align-items: center;
  gap: 4px;
  justify-content: flex-start;
}
:deep(.texture-button) {
  max-width: 140px;
}
:deep(.texture-button .n-button__content) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.texture-preview-row {
  display: flex;
  align-items: center;
  gap: 4px;
}
:deep(.texture-preview-container) {
  width: 36px;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f7f7f7;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
}
:deep(.texture-preview-thumb) {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.texture-action-btn {
  padding: 0 4px;
  min-width: 24px;
}
.texture-meta {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}
</style>
