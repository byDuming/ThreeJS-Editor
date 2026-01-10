<script setup lang="ts">
  import { computed, reactive } from 'vue'
  import type { UploadFileInfo } from 'naive-ui'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { createDefaultMaterialData } from '@/utils/sceneFactory.ts'
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

  const sceneStore = useSceneStore()

  // 当前选中对象的材质数据
  const material = computed(() => sceneStore.cureentObjectData?.mesh?.material as MaterialData | undefined)
  const materialType = computed(() => material.value?.type)

  const showMapFields = computed(() => ['basic', 'lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
  const showNormalDisplacement = computed(() => ['lambert', 'phong', 'standard', 'physical', 'toon'].includes(materialType.value ?? ''))
  const showEmissive = computed(() => ['lambert', 'phong', 'standard', 'physical'].includes(materialType.value ?? ''))
  const showAo = computed(() => ['standard', 'physical'].includes(materialType.value ?? ''))
  const showStandard = computed(() => ['standard', 'physical'].includes(materialType.value ?? ''))
  const showPhysical = computed(() => materialType.value === 'physical')
  const showPhong = computed(() => materialType.value === 'phong')
  const showToon = computed(() => materialType.value === 'toon')
  const showMatcap = computed(() => materialType.value === 'matcap')
  const showLineBasic = computed(() => materialType.value === 'lineBasic')
  const showLineDashed = computed(() => materialType.value === 'lineDashed')
  const showPoints = computed(() => materialType.value === 'points')

  type MapLikeMaterial = MaterialData & {
    map?: string
    alphaMap?: string
    envMap?: string | string[]
    envMapIntensity?: number
    envMapType?: 'equirect' | 'hdr' | 'cube'
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
  }

  const phongMaterial = computed(() => material.value?.type === 'phong' ? (material.value as MeshPhongMaterialData) : null)
  const standardMaterial = computed(() => material.value?.type === 'standard' ? (material.value as MeshStandardMaterialData) : null)
  const physicalMaterial = computed(() => material.value?.type === 'physical' ? (material.value as MeshPhysicalMaterialData) : null)
  const toonMaterial = computed(() => material.value?.type === 'toon' ? (material.value as MeshToonMaterialData) : null)
  const matcapMaterial = computed(() => material.value?.type === 'matcap' ? (material.value as MeshMatcapMaterialData) : null)
  const lineBasicMaterial = computed(() => material.value?.type === 'lineBasic' ? (material.value as LineBasicMaterialData) : null)
  const lineDashedMaterial = computed(() => material.value?.type === 'lineDashed' ? (material.value as LineDashedMaterialData) : null)
  const pointsMaterial = computed(() => material.value?.type === 'points' ? (material.value as PointsMaterialData) : null)
  const mapMaterial = computed(() => showMapFields.value ? (material.value as MapLikeMaterial) : null)
  const normalDisplacementMaterial = computed(() => showNormalDisplacement.value ? (material.value as NormalDisplacementMaterial) : null)
  const emissiveMaterial = computed(() => showEmissive.value ? (material.value as EmissiveMaterial) : null)
  const aoMaterial = computed(() => showAo.value ? (material.value as AOMaterial) : null)

  const textureFileNames = reactive<Record<string, string>>({})
  const textureFileLists = reactive<Record<string, string[]>>({})
  const uploadFileLists = reactive<Record<string, UploadFileInfo[]>>({})

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

  // 合并更新材质配置
  function updateMaterial(patch: Record<string, unknown>) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    const currentMesh = sceneStore.cureentObjectData?.mesh
    if (!currentMesh?.material) return
    const nextMaterial = { ...currentMesh.material, ...patch }
    const nextMesh = { ...currentMesh, material: nextMaterial }
    sceneStore.updateSceneObjectData(id, { mesh: nextMesh } as any)
  }

  function updateMaterialNumber(key: string, value: number | null) {
    updateMaterial({ [key]: Number(value ?? 0) })
  }

  function updateMaterialBoolean(key: string, value: boolean) {
    updateMaterial({ [key]: value })
  }

  function updateMaterialText(key: string, value: string | string[]) {
    updateMaterial({ [key]: value })
  }

  function resetTextureUiState() {
    Object.keys(textureFileNames).forEach((key) => delete textureFileNames[key])
    Object.keys(textureFileLists).forEach((key) => delete textureFileLists[key])
    Object.keys(uploadFileLists).forEach((key) => delete uploadFileLists[key])
  }

  function updateMaterialType(value: string) {
    const nextType = value as MaterialData['type']
    if (nextType === materialType.value) return
    const id = sceneStore.selectedObjectId
    if (!id) return
    const currentMesh = sceneStore.cureentObjectData?.mesh
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

  function handleTextureFileListChange(key: string, fileList: UploadFileInfo[]) {
    uploadFileLists[key] = fileList
    const files = fileList.map(file => file.file).filter(Boolean) as File[]
    if (!files.length) return

    const isEnvMap = key === 'envMap'
    if (isEnvMap && files.length > 1) {
      const urls = files.map(file => URL.createObjectURL(file))
      textureFileLists[key] = files.map(file => file.name)
      updateMaterialTextureName(key, files.map(file => file.name).join(', '))
      updateMaterial({
        envMap: urls,
        envMapType: 'cube'
      })
      uploadFileLists[key] = []
      return
    }

    const file = files[0]
    textureFileNames[key] = file.name
    textureFileLists[key] = []
    updateMaterialTextureName(key, file.name)

    const isHdr = isEnvMap && file.name.toLowerCase().endsWith('.hdr')
    if (isHdr) {
      const url = URL.createObjectURL(file)
      updateMaterial({
        envMap: url,
        envMapType: 'hdr'
      })
      uploadFileLists[key] = []
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (isEnvMap) {
        updateMaterial({
          envMap: result,
          envMapType: 'equirect'
        })
      } else {
        updateMaterialText(key, result)
      }
      uploadFileLists[key] = []
    }
    reader.readAsDataURL(file)
  }

  function getTextureLabel(key: string) {
    const persisted = (material.value as any)?.textureNames?.[key]
    if (persisted) return persisted
    const list = textureFileLists[key]
    if (list && list.length) return list.join(', ')
    return textureFileNames[key] ?? ''
  }

  function isPreviewableTexture(value?: string) {
    if (!value) return false
    return value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')
  }
</script>

<template>
  <span>材质属性</span>
  <br/>
  <br/>
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
  <n-flex class="n-flex" vertical>
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

    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-color-picker
          :value="material?.color ?? '#ffffff'"
          :show-alpha="false"
          @update:value="(v: string) => updateMaterialText('color', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">透明度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="material?.opacity" placeholder="透明度" @update:value="(v:number) => updateMaterialNumber('opacity', v)" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">透明</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-switch :value="material?.transparent" @update:value="(v:boolean) => updateMaterialBoolean('transparent', v)" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">深度测试</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-switch :value="material?.depthTest" @update:value="(v:boolean) => updateMaterialBoolean('depthTest', v)" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">深度缓冲</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-switch :value="material?.depthWrite" @update:value="(v:boolean) => updateMaterialBoolean('depthWrite', v)" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">渲染顺序</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="material?.renderOrder" placeholder="渲染顺序" @update:value="(v:number) => updateMaterialNumber('renderOrder', v)" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">渲染面</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="sideOptions"
          :value="material?.side"
          placeholder="渲染面"
          @update:value="(v: string) => updateMaterialText('side', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">线框</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-switch :value="material?.wireframe" @update:value="(v:boolean) => updateMaterialBoolean('wireframe', v)" />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">线框宽度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="material?.wireframeLinewidth" placeholder="线框宽度" @update:value="(v:number) => updateMaterialNumber('wireframeLinewidth', v)" />
      </n-gi>
    </n-grid>

    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">贴图平铺U</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="wrapOptions"
          :value="material?.wrapS"
          placeholder="贴图平铺U"
          @update:value="(v: string) => updateMaterialText('wrapS', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">贴图平铺V</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="wrapOptions"
          :value="material?.wrapT"
          placeholder="贴图平铺V"
          @update:value="(v: string) => updateMaterialText('wrapT', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">放大过滤</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="filterOptions"
          :value="material?.magFilter"
          placeholder="放大过滤"
          @update:value="(v: string) => updateMaterialText('magFilter', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">缩小过滤</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="filterOptions"
          :value="material?.minFilter"
          placeholder="缩小过滤"
          @update:value="(v: string) => updateMaterialText('minFilter', v)"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="showMapFields" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">漫反射贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.map"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('map', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('map') || '选择贴图' }}</n-button>
          </n-upload>
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
    <n-grid v-if="showMapFields" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">Alpha贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.alphaMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('alphaMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('alphaMap') || '选择贴图' }}</n-button>
          </n-upload>
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
    <n-grid v-if="showMapFields" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">环境贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*,.hdr"
            multiple
            :file-list="uploadFileLists.envMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('envMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('envMap') || '选择贴图' }}</n-button>
          </n-upload>
          <n-image-group v-if="Array.isArray(mapMaterial?.envMap)">
            <div class="texture-preview-row">
              <n-image
                v-for="(url, index) in mapMaterial?.envMap"
                :key="index"
                v-if="isPreviewableTexture(url)"
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
    <n-grid v-if="showMapFields" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">环境强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="mapMaterial?.envMapIntensity" placeholder="环境强度" @update:value="(v:number) => updateMaterialNumber('envMapIntensity', v)" />
      </n-gi>
    </n-grid>

    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">法线贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.normalMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('normalMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('normalMap') || '选择贴图' }}</n-button>
          </n-upload>
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
        <n-input-number :value="normalDisplacementMaterial?.normalScale" placeholder="法线强度" @update:value="(v:number) => updateMaterialNumber('normalScale', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">位移贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.displacementMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('displacementMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('displacementMap') || '选择贴图' }}</n-button>
          </n-upload>
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
        <n-input-number :value="normalDisplacementMaterial?.displacementScale" placeholder="位移强度" @update:value="(v:number) => updateMaterialNumber('displacementScale', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showNormalDisplacement" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">位移偏移</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="normalDisplacementMaterial?.displacementBias" placeholder="位移偏移" @update:value="(v:number) => updateMaterialNumber('displacementBias', v)" />
      </n-gi>
    </n-grid>

    <n-grid v-if="showEmissive" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">自发光颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-color-picker
          :value="emissiveMaterial?.emissive ?? '#000000'"
          :show-alpha="false"
          @update:value="(v: string) => updateMaterialText('emissive', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="showEmissive" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">自发光强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="emissiveMaterial?.emissiveIntensity" placeholder="自发光强度" @update:value="(v:number) => updateMaterialNumber('emissiveIntensity', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showEmissive" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">自发光贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.emissiveMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('emissiveMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('emissiveMap') || '选择贴图' }}</n-button>
          </n-upload>
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

    <n-grid v-if="showAo" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">AO贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.aoMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('aoMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('aoMap') || '选择贴图' }}</n-button>
          </n-upload>
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
        <n-input-number :value="aoMaterial?.aoMapIntensity" placeholder="AO强度" @update:value="(v:number) => updateMaterialNumber('aoMapIntensity', v)" />
      </n-gi>
    </n-grid>

    <n-grid v-if="showPhong" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高光颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-color-picker
          :value="phongMaterial?.specular ?? '#111111'"
          :show-alpha="false"
          @update:value="(v: string) => updateMaterialText('specular', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhong" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高光强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="phongMaterial?.shininess" placeholder="高光强度" @update:value="(v:number) => updateMaterialNumber('shininess', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhong" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高光贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.specularMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('specularMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('specularMap') || '选择贴图' }}</n-button>
          </n-upload>
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

    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">粗糙度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="standardMaterial?.roughness" placeholder="粗糙度" @update:value="(v:number) => updateMaterialNumber('roughness', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">金属度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="standardMaterial?.metalness" placeholder="金属度" @update:value="(v:number) => updateMaterialNumber('metalness', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">alpha测试</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-switch :value="standardMaterial?.alphaTest" @update:value="(v:boolean) => updateMaterialBoolean('alphaTest', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showStandard" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">粗糙贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.roughnessMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('roughnessMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('roughnessMap') || '选择贴图' }}</n-button>
          </n-upload>
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
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.metalnessMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('metalnessMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('metalnessMap') || '选择贴图' }}</n-button>
          </n-upload>
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

    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">清漆强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.clearcoat" placeholder="清漆强度" @update:value="(v:number) => updateMaterialNumber('clearcoat', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">清漆粗糙</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.clearcoatRoughness" placeholder="清漆粗糙" @update:value="(v:number) => updateMaterialNumber('clearcoatRoughness', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">折射率</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.ior" placeholder="折射率" @update:value="(v:number) => updateMaterialNumber('ior', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">透射强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.transmission" placeholder="透射强度" @update:value="(v:number) => updateMaterialNumber('transmission', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">透射贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.transmissionMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('transmissionMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('transmissionMap') || '选择贴图' }}</n-button>
          </n-upload>
          <n-image
            v-if="isPreviewableTexture(physicalMaterial?.transmissionMap)"
            :src="physicalMaterial?.transmissionMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="透射贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">厚度贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.thicknessMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('thicknessMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('thicknessMap') || '选择贴图' }}</n-button>
          </n-upload>
          <n-image
            v-if="isPreviewableTexture(physicalMaterial?.thicknessMap)"
            :src="physicalMaterial?.thicknessMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="厚度贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">厚度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.thickness" placeholder="厚度" @update:value="(v:number) => updateMaterialNumber('thickness', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">各向异性</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.anisotropy" placeholder="各向异性" @update:value="(v:number) => updateMaterialNumber('anisotropy', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">异性旋转</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.anisotropyRotation" placeholder="异性旋转" @update:value="(v:number) => updateMaterialNumber('anisotropyRotation', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">异性贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.anisotropyMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('anisotropyMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('anisotropyMap') || '选择贴图' }}</n-button>
          </n-upload>
          <n-image
            v-if="isPreviewableTexture(physicalMaterial?.anisotropyMap)"
            :src="physicalMaterial?.anisotropyMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="异性贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">清漆法线贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.clearcoatNormalMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('clearcoatNormalMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('clearcoatNormalMap') || '选择贴图' }}</n-button>
          </n-upload>
          <n-image
            v-if="isPreviewableTexture(physicalMaterial?.clearcoatNormalMap)"
            :src="physicalMaterial?.clearcoatNormalMap"
            :preview-disabled="true"
            class="texture-preview-container"
            :img-props="{ class: 'texture-preview-thumb' }"
            alt="清漆法线贴图预览"
          />
        </div>
      </n-gi>
    </n-grid>
    <n-grid v-if="showPhysical" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">清漆法线强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="physicalMaterial?.clearcoatNormalScale" placeholder="清漆法线强度" @update:value="(v:number) => updateMaterialNumber('clearcoatNormalScale', v)" />
      </n-gi>
    </n-grid>

    <n-grid v-if="showToon" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">渐变贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.gradientMap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('gradientMap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('gradientMap') || '选择贴图' }}</n-button>
          </n-upload>
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

    <n-grid v-if="showMatcap" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">MatCap贴图</n-gi>
      <n-gi class="gid-item" :span="7">
        <div class="texture-row">
          <n-upload
            :default-upload="false"
            :show-file-list="false"
            accept="image/*"
            :file-list="uploadFileLists.matcap"
            @update:file-list="(files: UploadFileInfo[]) => handleTextureFileListChange('matcap', files)"
          >
            <n-button size="small" class="texture-button">{{ getTextureLabel('matcap') || '选择贴图' }}</n-button>
          </n-upload>
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

    <n-grid v-if="showLineBasic" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">线条宽度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="lineBasicMaterial?.linewidth" placeholder="线条宽度" @update:value="(v:number) => updateMaterialNumber('linewidth', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showLineBasic" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">线端</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="linecapOptions"
          :value="lineBasicMaterial?.linecap"
          placeholder="线端"
          @update:value="(v: string) => updateMaterialText('linecap', v)"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="showLineBasic" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">拐角</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-select
          :options="linejoinOptions"
          :value="lineBasicMaterial?.linejoin"
          placeholder="拐角"
          @update:value="(v: string) => updateMaterialText('linejoin', v)"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="showLineDashed" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">虚线长度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="lineDashedMaterial?.dashSize" placeholder="虚线长度" @update:value="(v:number) => updateMaterialNumber('dashSize', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showLineDashed" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">间隔长度</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="lineDashedMaterial?.gapSize" placeholder="间隔长度" @update:value="(v:number) => updateMaterialNumber('gapSize', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showLineDashed" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">比例</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="lineDashedMaterial?.scale" placeholder="比例" @update:value="(v:number) => updateMaterialNumber('scale', v)" />
      </n-gi>
    </n-grid>

    <n-grid v-if="showPoints" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">点大小</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-input-number :value="pointsMaterial?.size" placeholder="点大小" @update:value="(v:number) => updateMaterialNumber('size', v)" />
      </n-gi>
    </n-grid>
    <n-grid v-if="showPoints" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">距离衰减</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-switch :value="pointsMaterial?.sizeAttenuation" @update:value="(v:boolean) => updateMaterialBoolean('sizeAttenuation', v)" />
      </n-gi>
    </n-grid>
  </n-flex>
  </n-scrollbar>
</template>

<style scoped>
  .n-flex{
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
  :deep(.n-upload) {
    width: auto;
  }
</style>
