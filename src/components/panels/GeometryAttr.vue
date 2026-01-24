<script setup lang="ts">
import { computed } from 'vue'
import { useSceneStore } from '@/stores/modules/useScene.store'
import { PropertyNumber, PropertySwitch, PropertyInputNumber } from './properties'
import type {
  GeometryData,
  BoxGeometryData,
  SphereGeometryData,
  CylinderGeometryData,
  ConeGeometryData,
  PlaneGeometryData,
  TorusGeometryData,
  TorusKnotGeometryData,
  PolyhedronGeometryData,
  CircleGeometryData,
  RingGeometryData,
  CapsuleGeometryData
} from '@/types/geometry'

const sceneStore = useSceneStore()

// 常量
const PI_2 = Math.PI * 2

// 当前选中对象的几何体数据
const geometry = computed(() => sceneStore.selectedObjectData?.mesh?.geometry as GeometryData | undefined)
const geometryType = computed(() => geometry.value?.type)

// 按类型拆分几何体数据
const boxGeometry = computed(() => geometry.value?.type === 'box' ? (geometry.value as BoxGeometryData) : null)
const sphereGeometry = computed(() => geometry.value?.type === 'sphere' ? (geometry.value as SphereGeometryData) : null)
const cylinderGeometry = computed(() => geometry.value?.type === 'cylinder' ? (geometry.value as CylinderGeometryData) : null)
const coneGeometry = computed(() => geometry.value?.type === 'cone' ? (geometry.value as ConeGeometryData) : null)
const planeGeometry = computed(() => geometry.value?.type === 'plane' ? (geometry.value as PlaneGeometryData) : null)
const torusGeometry = computed(() => geometry.value?.type === 'torus' ? (geometry.value as TorusGeometryData) : null)
const torusKnotGeometry = computed(() => geometry.value?.type === 'torusKnot' ? (geometry.value as TorusKnotGeometryData) : null)
const polyhedronGeometry = computed(() =>
  ['tetrahedron', 'octahedron', 'dodecahedron', 'icosahedron'].includes(geometry.value?.type ?? '')
    ? (geometry.value as PolyhedronGeometryData)
    : null
)
const circleGeometry = computed(() => geometry.value?.type === 'circle' ? (geometry.value as CircleGeometryData) : null)
const ringGeometry = computed(() => geometry.value?.type === 'ring' ? (geometry.value as RingGeometryData) : null)
const capsuleGeometry = computed(() => geometry.value?.type === 'capsule' ? (geometry.value as CapsuleGeometryData) : null)
</script>

<template>
  <span>几何体属性</span>
  <br/>
  <br/>

  <n-scrollbar style="max-height: 100%;" content-style="overflow: hidden;">
    <n-flex class="n-flex" vertical>
      <!-- 类型 -->
      <n-grid x-gap="12" :cols="8">
        <n-gi class="gid-item" :span="2">类型</n-gi>
        <n-gi class="gid-item" :span="6">
          <n-input :value="geometryType" type="text" disabled />
        </n-gi>
      </n-grid>

      <!-- Box 几何体 -->
      <template v-if="boxGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">宽度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.width" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.height" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">深度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.depth" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">宽度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.widthSegments" :default-value="1" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.heightSegments" :default-value="1" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">深度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.depthSegments" :default-value="1" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Sphere 几何体 -->
      <template v-if="sphereGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">经向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.widthSegments" :default-value="32" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">纬向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.heightSegments" :default-value="16" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">水平起始角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.phiStart" :default-value="0" :step="0.1" :min="-PI_2" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">水平扫描角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.phiLength" :default-value="PI_2" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">垂直起始角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaStart" :default-value="0" :step="0.1" :min="-PI_2" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">垂直扫描角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaLength" :default-value="Math.PI" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Cylinder 几何体 -->
      <template v-if="cylinderGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">顶部半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radiusTop" :default-value="1" :step="0.1" :min="0" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">底部半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radiusBottom" :default-value="1" :step="0.1" :min="0" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.height" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">径向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.radialSegments" :default-value="32" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.heightSegments" :default-value="1" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">打开两端</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertySwitch path="mesh.geometry.openEnded" :default-value="false" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">起始角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaStart" :default-value="0" :step="0.1" :min="-PI_2" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">扫描角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaLength" :default-value="PI_2" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Cone 几何体 -->
      <template v-if="coneGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">底面半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.height" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">径向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.radialSegments" :default-value="32" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.heightSegments" :default-value="1" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">打开两端</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertySwitch path="mesh.geometry.openEnded" :default-value="false" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">起始角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaStart" :default-value="0" :step="0.1" :min="-PI_2" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">扫描角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaLength" :default-value="PI_2" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Plane 几何体 -->
      <template v-if="planeGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">宽度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.width" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.height" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">宽度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.widthSegments" :default-value="1" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">高度分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.heightSegments" :default-value="1" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Torus 几何体 -->
      <template v-if="torusGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">主半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">管道半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.tube" :default-value="0.4" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">径向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.radialSegments" :default-value="16" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">圆环分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.tubularSegments" :default-value="100" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">圆弧角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.arc" :default-value="PI_2" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
      </template>

      <!-- TorusKnot 几何体 -->
      <template v-if="torusKnotGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">主半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">管道半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.tube" :default-value="0.4" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">管道分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.tubularSegments" :default-value="64" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">径向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.radialSegments" :default-value="8" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">p</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.p" :default-value="2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">q</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.q" :default-value="3" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Polyhedron 几何体 -->
      <template v-if="polyhedronGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">细分等级</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.detail" :default-value="0" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Circle 几何体 -->
      <template v-if="circleGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.segments" :default-value="32" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">起始角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaStart" :default-value="0" :step="0.1" :min="-PI_2" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">扫描角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaLength" :default-value="PI_2" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Ring 几何体 -->
      <template v-if="ringGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">内半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.innerRadius" :default-value="0.5" :step="0.1" :min="0" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">外半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.outerRadius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">圆周分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.thetaSegments" :default-value="32" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">径向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.phiSegments" :default-value="1" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">起始角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaStart" :default-value="0" :step="0.1" :min="-PI_2" :max="PI_2" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">扫描角</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.thetaLength" :default-value="PI_2" :step="0.1" :min="0" :max="PI_2" />
          </n-gi>
        </n-grid>
      </template>

      <!-- Capsule 几何体 -->
      <template v-if="capsuleGeometry">
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">半径</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.radius" :default-value="1" :step="0.1" :min="0.1" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">中段长度</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyNumber path="mesh.geometry.length" :default-value="1" :step="0.1" :min="0" :max="1000" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">端帽分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.capSegments" :default-value="4" />
          </n-gi>
        </n-grid>
        <n-grid x-gap="6" :cols="10">
          <n-gi class="gid-item" :span="3">径向分段</n-gi>
          <n-gi class="gid-item" :span="7">
            <PropertyInputNumber path="mesh.geometry.radialSegments" :default-value="8" />
          </n-gi>
        </n-grid>
      </template>
    </n-flex>
  </n-scrollbar>
</template>

<style scoped>
.gid-item {
  margin-block: auto;
  font-weight: bold;
  margin-right: 0.3vw;
  margin-bottom: 0.5vw;
}
</style>
