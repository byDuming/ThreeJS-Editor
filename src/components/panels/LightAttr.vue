<script setup lang="ts">
  import { computed } from 'vue'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import NumberInput from './NumberInput.vue'

  const sceneStore = useSceneStore()
  
  // 常量
  const PI_HALF = Math.PI / 2

  const lightData = computed(() => sceneStore.currentObjectData?.userData ?? {})
  const lightType = computed(() => (lightData.value as any)?.lightType ?? '')

  const lightTypeOptions = [
    { label: '方向光', value: 'directionalLight' },
    { label: '点光', value: 'pointLight' },
    { label: '聚光', value: 'spotLight' },
    { label: '半球光', value: 'hemisphereLight' },
    { label: '区域光', value: 'rectAreaLight' },
    { label: '环境光', value: 'ambientLight' }
  ]

  function updateLight(patch: Record<string, unknown>) {
    const id = sceneStore.selectedObjectId
    if (!id) return
    const current = sceneStore.currentObjectData?.userData ?? {}
    sceneStore.updateSceneObjectData(id, { userData: { ...current, ...patch } } as any)
  }

  function updateLightType(value: string) {
    const defaults: Record<string, Record<string, unknown>> = {
      directionalLight: {
        color: '#ffffff',
        intensity: 1,
        shadow: {
          mapSize: [2048, 2048],
          camera: { left: -50, right: 50, top: 50, bottom: -50, near: 0.5, far: 200 }
        }
      },
      pointLight: { color: '#ffffff', intensity: 1, distance: 0, decay: 2 },
      spotLight: { color: '#ffffff', intensity: 1, distance: 0, decay: 2, angle: Math.PI / 3, penumbra: 0 },
      hemisphereLight: { skyColor: '#ffffff', groundColor: '#444444', intensity: 1 },
      rectAreaLight: { color: '#ffffff', intensity: 1, width: 10, height: 10 },
      ambientLight: { color: '#ffffff', intensity: 1 }
    }
    updateLight({
      lightType: value,
      ...(defaults[value] ?? {})
    })
  }

  function updateLightShadowCamera(key: string, value: number | null) {
    const shadow = (lightData.value as any)?.shadow ?? {}
    const camera = shadow.camera ?? {}
    updateLight({
      shadow: {
        ...shadow,
        camera: {
          ...camera,
          [key]: Number(value ?? 0)
        }
      }
    })
  }

  function updateLightShadowSize(axis: 'width' | 'height', value: number | null) {
    const size = Math.max(1, Number(value ?? 0))
    const half = size / 2
    const shadow = (lightData.value as any)?.shadow ?? {}
    const camera = shadow.camera ?? {}
    const nextCamera =
      axis === 'width'
        ? { ...camera, left: -half, right: half }
        : { ...camera, top: half, bottom: -half }
    updateLight({
      shadow: {
        ...shadow,
        camera: nextCamera
      }
    })
  }

  function getShadowSize(axis: 'width' | 'height') {
    const camera = (lightData.value as any)?.shadow?.camera
    if (!camera) return axis === 'width' ? 100 : 100
    if (axis === 'width' && camera.left !== undefined && camera.right !== undefined) {
      return Math.abs(Number(camera.right) - Number(camera.left))
    }
    if (axis === 'height' && camera.top !== undefined && camera.bottom !== undefined) {
      return Math.abs(Number(camera.top) - Number(camera.bottom))
    }
    return axis === 'width' ? 100 : 100
  }

  function updateLightShadowMapSize(axis: 0 | 1, value: number | null) {
    const shadow = (lightData.value as any)?.shadow ?? {}
    const mapSize = shadow.mapSize ?? [2048, 2048]
    const next: [number, number] = [Number(mapSize[0] ?? 2048), Number(mapSize[1] ?? 2048)]
    next[axis] = Math.max(1, Math.floor(Number(value ?? next[axis])))
    updateLight({
      shadow: {
        ...shadow,
        mapSize: next
      }
    })
  }
</script>

<template>
  <span>光源属性</span>
  <br />
  <br />
  <n-flex class="n-flex" vertical>
    <n-grid x-gap="12" :cols="8">
      <n-gi class="gid-item" :span="2">类型</n-gi>
      <n-gi class="gid-item" :span="6">
        <n-select
          :options="lightTypeOptions"
          :value="lightType"
          placeholder="选择光源类型"
          @update:value="(v: string) => updateLightType(v)"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="lightType !== 'hemisphereLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">颜色</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-color-picker
          :value="lightData?.color ?? '#ffffff'"
          :show-alpha="false"
          @update:value="(v: string) => updateLight({ color: v })"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="lightType === 'hemisphereLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">天空色</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-color-picker
          :value="lightData?.skyColor ?? '#ffffff'"
          :show-alpha="false"
          @update:value="(v: string) => updateLight({ skyColor: v })"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="lightType === 'hemisphereLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">地面色</n-gi>
      <n-gi class="gid-item" :span="7">
        <n-color-picker
          :value="lightData?.groundColor ?? '#444444'"
          :show-alpha="false"
          @update:value="(v: string) => updateLight({ groundColor: v })"
        />
      </n-gi>
    </n-grid>

    <n-grid x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">强度</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.intensity ?? 1"
          @update:value="(v:number | null) => updateLight({ intensity: v ?? 1 })"
          :step="0.01"
          :min="0"
          :max="10"
          :precision="3"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="lightType === 'pointLight' || lightType === 'spotLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">距离</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.distance ?? 0"
          @update:value="(v:number | null) => updateLight({ distance: v ?? 0 })"
          :step="0.1"
          :min="0"
          :max="10000"
          :precision="2"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="lightType === 'pointLight' || lightType === 'spotLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">衰减</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.decay ?? 2"
          @update:value="(v:number | null) => updateLight({ decay: v ?? 2 })"
          :step="0.01"
          :min="0"
          :max="10"
          :precision="3"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="lightType === 'spotLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">角度</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.angle ?? 1"
          @update:value="(v:number | null) => updateLight({ angle: v ?? 1 })"
          :step="0.01"
          :min="0"
          :max="PI_HALF"
          :precision="3"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="lightType === 'spotLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">半影</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.penumbra ?? 0"
          @update:value="(v:number | null) => updateLight({ penumbra: v ?? 0 })"
          :step="0.01"
          :min="0"
          :max="1"
          :precision="3"
        />
      </n-gi>
    </n-grid>

    <n-grid v-if="lightType === 'rectAreaLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">宽度</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.width ?? 10"
          @update:value="(v:number | null) => updateLight({ width: v ?? 10 })"
          :step="0.1"
          :min="0.1"
          :max="1000"
          :precision="3"
        />
      </n-gi>
    </n-grid>
    <n-grid v-if="lightType === 'rectAreaLight'" x-gap="6" :cols="10">
      <n-gi class="gid-item" :span="3">高度</n-gi>
      <n-gi class="gid-item" :span="7">
        <NumberInput
          :value="lightData?.height ?? 10"
          @update:value="(v:number | null) => updateLight({ height: v ?? 10 })"
          :step="0.1"
          :min="0.1"
          :max="1000"
          :precision="3"
        />
      </n-gi>
    </n-grid>

    <template v-if="lightType === 'directionalLight'">
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">阴影宽度</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="getShadowSize('width')"
            @update:value="(v:number | null) => updateLightShadowSize('width', v)"
            :step="0.1"
            :min="0.1"
            :max="10000"
            :precision="2"
          />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">阴影高度</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="getShadowSize('height')"
            @update:value="(v:number | null) => updateLightShadowSize('height', v)"
            :step="0.1"
            :min="0.1"
            :max="10000"
            :precision="2"
          />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">阴影近裁剪</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="lightData?.shadow?.camera?.near ?? 0.5"
            @update:value="(v:number | null) => updateLightShadowCamera('near', v)"
            :step="0.01"
            :min="0.01"
            :max="100"
            :precision="3"
          />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">阴影远裁剪</n-gi>
        <n-gi class="gid-item" :span="7">
          <NumberInput
            :value="lightData?.shadow?.camera?.far ?? 200"
            @update:value="(v:number | null) => updateLightShadowCamera('far', v)"
            :step="1"
            :min="1"
            :max="100000"
            :precision="0"
          />
        </n-gi>
      </n-grid>
      <n-grid x-gap="6" :cols="14">
        <n-gi class="gid-item" :span="4">贴图尺寸</n-gi>
        <n-gi class="gid-item" :span="5">
          <n-input-number
            placeholder="宽"
            :value="lightData?.shadow?.mapSize?.[0] ?? 2048"
            @update:value="(v:number) => updateLightShadowMapSize(0, v)"
          />
        </n-gi>
        <n-gi class="gid-item" :span="5">
          <n-input-number
            placeholder="高"
            :value="lightData?.shadow?.mapSize?.[1] ?? 2048"
            @update:value="(v:number) => updateLightShadowMapSize(1, v)"
          />
        </n-gi>
      </n-grid>
    </template>
  </n-flex>
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
</style>
