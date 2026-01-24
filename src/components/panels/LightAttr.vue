<script setup lang="ts">
import { computed } from 'vue'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { usePropertyBinding } from '@/composables/usePropertyBinding'
import { PropertyNumber } from './properties'

const sceneStore = useSceneStore()
const { getSelectedId, getSelectedData } = usePropertyBinding()

// 常量
const PI_HALF = Math.PI / 2

const lightData = computed(() => sceneStore.selectedObjectData?.userData ?? {})
const lightType = computed(() => (lightData.value as any)?.lightType ?? '')

const lightTypeOptions = [
  { label: '方向光', value: 'directionalLight' },
  { label: '点光', value: 'pointLight' },
  { label: '聚光', value: 'spotLight' },
  { label: '半球光', value: 'hemisphereLight' },
  { label: '区域光', value: 'rectAreaLight' },
  { label: '环境光', value: 'ambientLight' }
]

/**
 * 更新光源属性
 */
function updateLight(patch: Record<string, unknown>) {
  const id = getSelectedId()
  if (!id) return
  const current = getSelectedData()?.userData ?? {}
  sceneStore.updateSceneObjectData(id, { userData: { ...current, ...patch } } as any)
}

/**
 * 更新光源类型，并设置默认值
 */
function updateLightType(value: string) {
  const defaults: Record<string, Record<string, unknown>> = {
    directionalLight: {
      color: '#ffffff',
      intensity: 1,
      shadow: {
        mapSize: [2048, 2048],
        camera: { left: -50, right: 50, top: 50, bottom: -50, near: 0.5, far: 200 },
        radius: 4,
        blurSamples: 8,
        bias: -0.0001,
        normalBias: 0.02
      }
    },
    pointLight: {
      color: '#ffffff',
      intensity: 1,
      distance: 0,
      decay: 2,
      shadow: {
        mapSize: [1024, 1024],
        camera: { near: 0.5, far: 500 },
        radius: 4,
        blurSamples: 8,
        bias: -0.0001,
        normalBias: 0.02
      }
    },
    spotLight: {
      color: '#ffffff',
      intensity: 1,
      distance: 0,
      decay: 2,
      angle: Math.PI / 3,
      penumbra: 0,
      shadow: {
        mapSize: [1024, 1024],
        camera: { near: 0.5, far: 500 },
        radius: 4,
        blurSamples: 8,
        bias: -0.0001,
        normalBias: 0.02
      }
    },
    hemisphereLight: { skyColor: '#ffffff', groundColor: '#444444', intensity: 1 },
    rectAreaLight: { color: '#ffffff', intensity: 1, width: 10, height: 10 },
    ambientLight: { color: '#ffffff', intensity: 1 }
  }
  updateLight({
    lightType: value,
    ...(defaults[value] ?? {})
  })
}

/**
 * 更新阴影相机属性
 */
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

/**
 * 更新阴影尺寸（方向光专用）
 */
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

/**
 * 获取阴影尺寸
 */
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

/**
 * 更新阴影贴图尺寸
 */
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

/**
 * 更新阴影属性
 */
function updateShadowProperty(key: 'radius' | 'blurSamples' | 'bias' | 'normalBias', value: number | null) {
  const shadow = (lightData.value as any)?.shadow ?? {}
  updateLight({
    shadow: {
      ...shadow,
      [key]: Number(value ?? 0)
    }
  })
}
</script>

<template>
  <span>光源属性</span>
  <br />
  <br />
  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
    <n-flex class="n-flex" vertical>
      <!-- 类型 -->
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

      <!-- 颜色（非半球光） -->
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

      <!-- 半球光颜色 -->
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

      <!-- 强度 -->
      <n-grid x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">强度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber
            path="userData.intensity"
            :default-value="1"
            :step="0.01"
            :min="0"
            :max="10"
          />
        </n-gi>
      </n-grid>

      <!-- 点光/聚光：距离、衰减 -->
      <n-grid v-if="lightType === 'pointLight' || lightType === 'spotLight'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">距离</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber
            path="userData.distance"
            :default-value="0"
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
          <PropertyNumber
            path="userData.decay"
            :default-value="2"
            :step="0.01"
            :min="0"
            :max="10"
          />
        </n-gi>
      </n-grid>

      <!-- 聚光：角度、半影 -->
      <n-grid v-if="lightType === 'spotLight'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">角度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber
            path="userData.angle"
            :default-value="1"
            :step="0.01"
            :min="0"
            :max="PI_HALF"
          />
        </n-gi>
      </n-grid>
      <n-grid v-if="lightType === 'spotLight'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">半影</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber
            path="userData.penumbra"
            :default-value="0"
            :step="0.01"
            :min="0"
            :max="1"
          />
        </n-gi>
      </n-grid>

      <!-- 区域光：宽度、高度 -->
      <n-grid v-if="lightType === 'rectAreaLight'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">宽度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber
            path="userData.width"
            :default-value="10"
            :step="0.1"
            :min="0.1"
            :max="1000"
          />
        </n-gi>
      </n-grid>
      <n-grid v-if="lightType === 'rectAreaLight'" x-gap="6" :cols="10">
        <n-gi class="gid-item" :span="3">高度</n-gi>
        <n-gi class="gid-item" :span="7">
          <PropertyNumber
            path="userData.height"
            :default-value="10"
            :step="0.1"
            :min="0.1"
            :max="1000"
          />
        </n-gi>
      </n-grid>

      <!-- 阴影配置：适用于 DirectionalLight、SpotLight、PointLight -->
      <template v-if="lightType === 'directionalLight' || lightType === 'spotLight' || lightType === 'pointLight'">
        <n-divider style="margin: 8px 0">阴影设置</n-divider>

        <!-- DirectionalLight 专用：正交相机范围 -->
        <template v-if="lightType === 'directionalLight'">
          <n-grid x-gap="6" :cols="10">
            <n-gi class="gid-item" :span="3">阴影宽度</n-gi>
            <n-gi class="gid-item" :span="7">
              <n-input-number
                :value="getShadowSize('width')"
                @update:value="(v: number) => updateLightShadowSize('width', v)"
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
              <n-input-number
                :value="getShadowSize('height')"
                @update:value="(v: number) => updateLightShadowSize('height', v)"
                :step="0.1"
                :min="0.1"
                :max="10000"
                :precision="2"
              />
            </n-gi>
          </n-grid>
        </template>

        <!-- 所有支持阴影的光源：近裁剪、远裁剪 -->
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">阴影近裁剪</n-gi>
          <n-gi class="gid-item" :span="7">
            <n-input-number
              :value="lightData?.shadow?.camera?.near ?? 0.5"
              @update:value="(v: number) => updateLightShadowCamera('near', v)"
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
            <n-input-number
              :value="lightData?.shadow?.camera?.far ?? (lightType === 'directionalLight' ? 200 : 500)"
              @update:value="(v: number) => updateLightShadowCamera('far', v)"
              :step="1"
              :min="1"
              :max="100000"
              :precision="0"
            />
          </n-gi>
        </n-grid>

        <!-- 贴图尺寸 -->
        <n-grid x-gap="6" :cols="14">
          <n-gi class="gid-item" :span="4">贴图尺寸</n-gi>
          <n-gi class="gid-item" :span="5">
            <n-input-number
              placeholder="宽"
              :value="lightData?.shadow?.mapSize?.[0] ?? 2048"
              @update:value="(v: number) => updateLightShadowMapSize(0, v)"
            />
          </n-gi>
          <n-gi class="gid-item" :span="5">
            <n-input-number
              placeholder="高"
              :value="lightData?.shadow?.mapSize?.[1] ?? 2048"
              @update:value="(v: number) => updateLightShadowMapSize(1, v)"
            />
          </n-gi>
        </n-grid>

        <!-- 阴影半径 -->
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">阴影半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <n-input-number
              :value="lightData?.shadow?.radius ?? 4"
              @update:value="(v: number) => updateShadowProperty('radius', v)"
              :step="0.5"
              :min="0"
              :max="25"
              :precision="1"
            />
          </n-gi>
        </n-grid>

        <!-- 模糊采样 -->
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">模糊采样</n-gi>
          <n-gi class="gid-item" :span="7">
            <n-input-number
              :value="lightData?.shadow?.blurSamples ?? 8"
              @update:value="(v: number) => updateShadowProperty('blurSamples', v)"
              :step="1"
              :min="1"
              :max="25"
            />
          </n-gi>
        </n-grid>

        <!-- 阴影偏移 -->
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">阴影偏移</n-gi>
          <n-gi class="gid-item" :span="7">
            <n-input-number
              :value="lightData?.shadow?.bias ?? -0.0001"
              @update:value="(v: number) => updateShadowProperty('bias', v)"
              :step="0.0001"
              :min="-0.01"
              :max="0.01"
              :precision="5"
            />
          </n-gi>
        </n-grid>

        <!-- 法线偏移 -->
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">法线偏移</n-gi>
          <n-gi class="gid-item" :span="7">
            <n-input-number
              :value="lightData?.shadow?.normalBias ?? 0.02"
              @update:value="(v: number) => updateShadowProperty('normalBias', v)"
              :step="0.01"
              :min="0"
              :max="1"
              :precision="3"
            />
          </n-gi>
        </n-grid>
      </template>
    </n-flex>
  </n-scrollbar>
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
