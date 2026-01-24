<script setup lang="ts">
  import { computed, reactive } from 'vue'
  import type { UploadFileInfo } from 'naive-ui'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import type { SceneSettings } from '@/interfaces/sceneInterface'

  const sceneStore = useSceneStore()
  const sceneSettings = computed(() => sceneStore.selectedObjectData?.scene as SceneSettings | undefined)

  const uploadFileLists = reactive<Record<string, UploadFileInfo[]>>({})
  const fileNames = reactive<Record<string, string>>({})

  const backgroundTypeOptions = [
    { label: '无', value: 'none' },
    { label: '纯色', value: 'color' },
    { label: '贴图', value: 'texture' },
    { label: '天空盒', value: 'cube' }
  ]
  const environmentTypeOptions = [
    { label: '无', value: 'none' },
    { label: '全景贴图', value: 'equirect' },
    { label: 'HDR', value: 'hdr' },
    { label: '天空盒', value: 'cube' }
  ]
  const fogTypeOptions = [
    { label: '无', value: 'none' },
    { label: '线性雾', value: 'linear' },
    { label: '指数雾', value: 'exp2' }
  ]

  function updateSceneSettings(patch: Partial<SceneSettings>) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    const current = sceneStore.selectedObjectData?.scene ?? {}
    sceneStore.updateSceneObjectData(id, { scene: { ...current, ...patch } } as any)
  }

  function updateFog(patch: Record<string, unknown>) {
    const current = sceneStore.selectedObjectData?.scene ?? {}
    const nextFog = { ...(current.fog ?? {}), ...patch }
    updateSceneSettings({ fog: nextFog })
  }

  function setBackgroundType(value: string) {
    updateSceneSettings({
      backgroundType: value as SceneSettings['backgroundType'],
      backgroundTexture: value === 'texture' ? sceneSettings.value?.backgroundTexture : undefined,
      backgroundCube: value === 'cube' ? sceneSettings.value?.backgroundCube : undefined
    })
  }

  function setEnvironmentType(value: string) {
    updateSceneSettings({
      environmentType: value as SceneSettings['environmentType'],
      environmentMap: value === 'none' ? undefined : sceneSettings.value?.environmentMap
    })
  }

  function handleBackgroundFiles(fileList: UploadFileInfo[]) {
    uploadFileLists.background = fileList
    const files = fileList
      .map(item => item.file)
      .filter((file): file is File => Boolean(file))
    if (!files.length) return

    if (sceneSettings.value?.backgroundType === 'cube' && files.length > 1) {
      const urls = files.map(file => URL.createObjectURL(file))
      fileNames.background = files.map(file => file.name).join(', ')
      updateSceneSettings({ backgroundCube: urls })
      uploadFileLists.background = []
      return
    }

    const file = files[0]!
    fileNames.background = file.name
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      updateSceneSettings({ backgroundTexture: result })
      uploadFileLists.background = []
    }
    reader.readAsDataURL(file)
  }

  function handleEnvironmentFiles(fileList: UploadFileInfo[]) {
    uploadFileLists.environment = fileList
    const files = fileList
      .map(item => item.file)
      .filter((file): file is File => Boolean(file))
    if (!files.length) return

    if (sceneSettings.value?.environmentType === 'cube' && files.length > 1) {
      const urls = files.map(file => URL.createObjectURL(file))
      fileNames.environment = files.map(file => file.name).join(', ')
      updateSceneSettings({ environmentMap: urls })
      uploadFileLists.environment = []
      return
    }

    const file = files[0]!
    fileNames.environment = file.name
    if (sceneSettings.value?.environmentType === 'hdr') {
      updateSceneSettings({ environmentMap: URL.createObjectURL(file) })
      uploadFileLists.environment = []
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      updateSceneSettings({ environmentMap: result })
      uploadFileLists.environment = []
    }
    reader.readAsDataURL(file)
  }

  function getLabel(key: string, fallback: string) {
    return fileNames[key] || fallback
  }

  const backgroundCubeArray = computed(() => Array.isArray(sceneSettings.value?.backgroundCube) ? sceneSettings.value?.backgroundCube ?? [] : [])
  const backgroundCubePreviewList = computed(() => backgroundCubeArray.value.filter(isPreviewableTexture))
  const environmentMapArray = computed(() => Array.isArray(sceneSettings.value?.environmentMap) ? sceneSettings.value?.environmentMap ?? [] : [])
  const environmentPreviewList = computed(() => environmentMapArray.value.filter(isPreviewableTexture))

  function isPreviewableTexture(value?: string) {
    if (!value) return false
    return value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('http')
  }
</script>

<template>
  <span>场景属性</span>
  <br/>
  <br/>
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
    <n-flex class="n-flex" vertical>
      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">背景</n-gi>
        <n-gi class="gid-item" :span="6">
          <n-select
            :options="backgroundTypeOptions"
            :value="sceneSettings?.backgroundType ?? 'color'"
            placeholder="选择背景类型"
            @update:value="(v: string) => setBackgroundType(v)"
          />
        </n-gi>
      </n-grid>

      <n-grid v-if="!sceneSettings?.backgroundType || sceneSettings?.backgroundType === 'color'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">背景颜色</n-gi>
        <n-gi class="gid-item" :span="7">
          <n-color-picker
            :value="sceneSettings?.backgroundColor ?? '#CFD8DC'"
            :show-alpha="false"
            @update:value="(v: string) => updateSceneSettings({ backgroundColor: v })"
          />
        </n-gi>
      </n-grid>

      <n-grid v-if="sceneSettings?.backgroundType === 'texture'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">背景贴图</n-gi>
        <n-gi class="gid-item" :span="7">
          <div class="texture-row">
            <n-upload
              :default-upload="false"
              :show-file-list="false"
              accept="image/*"
              :file-list="uploadFileLists.background"
              @update:file-list="(files: UploadFileInfo[]) => handleBackgroundFiles(files)"
            >
              <n-button size="small" class="texture-button">{{ getLabel('background', '选择贴图') }}</n-button>
            </n-upload>
            <n-image
              v-if="isPreviewableTexture(sceneSettings?.backgroundTexture)"
              :src="sceneSettings?.backgroundTexture"
              :preview-disabled="true"
              class="texture-preview-container"
              :img-props="{ class: 'texture-preview-thumb' }"
              alt="背景贴图预览"
            />
          </div>
        </n-gi>
      </n-grid>

      <n-grid v-if="sceneSettings?.backgroundType === 'cube'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">天空盒</n-gi>
        <n-gi class="gid-item" :span="7">
          <div class="texture-row">
            <n-upload
              :default-upload="false"
              :show-file-list="false"
              accept="image/*"
              multiple
              :file-list="uploadFileLists.background"
              @update:file-list="(files: UploadFileInfo[]) => handleBackgroundFiles(files)"
            >
              <n-button size="small" class="texture-button">{{ getLabel('background', '选择贴图') }}</n-button>
            </n-upload>
            <n-image-group v-if="backgroundCubePreviewList.length">
              <div class="texture-preview-row">
                <n-image
                  v-for="(url, index) in backgroundCubePreviewList"
                  :key="index"
                  :src="url"
                  class="texture-preview-container"
                  :img-props="{ class: 'texture-preview-thumb' }"
                  alt="天空盒预览"
                />
              </div>
            </n-image-group>
          </div>
        </n-gi>
      </n-grid>

      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">环境</n-gi>
        <n-gi class="gid-item" :span="6">
          <n-select
            :options="environmentTypeOptions"
            :value="sceneSettings?.environmentType ?? 'none'"
            placeholder="选择环境类型"
            @update:value="(v: string) => setEnvironmentType(v)"
          />
        </n-gi>
      </n-grid>

      <n-grid v-if="sceneSettings?.environmentType && sceneSettings?.environmentType !== 'none'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">环境贴图</n-gi>
        <n-gi class="gid-item" :span="7">
          <div class="texture-row">
            <n-upload
              :default-upload="false"
              :show-file-list="false"
              :accept="sceneSettings?.environmentType === 'hdr' ? 'image/*,.hdr' : 'image/*'"
              :multiple="sceneSettings?.environmentType === 'cube'"
              :file-list="uploadFileLists.environment"
              @update:file-list="(files: UploadFileInfo[]) => handleEnvironmentFiles(files)"
            >
              <n-button size="small" class="texture-button">{{ getLabel('environment', '选择贴图') }}</n-button>
            </n-upload>
            <n-image-group v-if="environmentPreviewList.length">
              <div class="texture-preview-row">
                <n-image
                  v-for="(url, index) in environmentPreviewList"
                  :key="index"
                  :src="url"
                  class="texture-preview-container"
                  :img-props="{ class: 'texture-preview-thumb' }"
                  alt="环境贴图预览"
                />
              </div>
            </n-image-group>
            <n-image
              v-else-if="isPreviewableTexture(sceneSettings?.environmentMap as string)"
              :src="sceneSettings?.environmentMap as string"
              :preview-disabled="true"
              class="texture-preview-container"
              :img-props="{ class: 'texture-preview-thumb' }"
              alt="环境贴图预览"
            />
          </div>
          <div v-if="sceneSettings?.environmentType === 'hdr'" class="texture-meta">HDR环境贴图（无预览）</div>
        </n-gi>
      </n-grid>

      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">雾效</n-gi>
        <n-gi class="gid-item" :span="6">
          <n-select
            :options="fogTypeOptions"
            :value="sceneSettings?.fog?.type ?? 'none'"
            placeholder="选择雾类型"
            @update:value="(v: string) => updateFog({ type: v })"
          />
        </n-gi>
      </n-grid>

      <n-grid v-if="sceneSettings?.fog?.type && sceneSettings?.fog?.type !== 'none'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">雾颜色</n-gi>
        <n-gi class="gid-item" :span="7">
          <n-color-picker
            :value="sceneSettings?.fog?.color ?? '#ffffff'"
            :show-alpha="false"
            @update:value="(v: string) => updateFog({ color: v })"
          />
        </n-gi>
      </n-grid>
      <n-grid v-if="sceneSettings?.fog?.type === 'linear'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">近端</n-gi>
        <n-gi class="gid-item" :span="7">
          <n-input-number :value="sceneSettings?.fog?.near" placeholder="近端距离" @update:value="(v:number) => updateFog({ near: v })" />
        </n-gi>
      </n-grid>
      <n-grid v-if="sceneSettings?.fog?.type === 'linear'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">远端</n-gi>
        <n-gi class="gid-item" :span="7">
          <n-input-number :value="sceneSettings?.fog?.far" placeholder="远端距离" @update:value="(v:number) => updateFog({ far: v })" />
        </n-gi>
      </n-grid>
      <n-grid v-if="sceneSettings?.fog?.type === 'exp2'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">雾密度</n-gi>
        <n-gi class="gid-item" :span="7">
          <n-input-number :value="sceneSettings?.fog?.density" placeholder="雾密度" @update:value="(v:number) => updateFog({ density: v })" />
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
  .texture-meta {
    font-size: 12px;
    color: #888;
    margin-top: 4px;
  }
</style>
