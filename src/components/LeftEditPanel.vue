<script setup lang="ts">
  import { type TreeDropInfo, type TreeOption, NIcon, type DropdownOption, type UploadFileInfo } from 'naive-ui'
  import { ref, computed, watch, h, type Component } from 'vue'
  import { Cube, OptionsSharp, CubeOutline, ColorPalette, Camera, Move, Resize, Earth, ArrowUndo, ArrowRedo, SettingsOutline, FolderOutline } from '@vicons/ionicons5'
  import { TextureOutlined, DeleteFilled, DriveFileRenameOutlineRound, LightbulbOutlined, Md3DRotationFilled, PlaceFilled } from '@vicons/material'
  import { Cubes } from '@vicons/fa'

  import AttributesPanel from './panles/Attributes.vue'
  import GeometryAttrPanel from './panles/GeometryAttr.vue'
  import MaterialAttrPanel from './panles/MaterialAttr.vue'
  import HelperAttributesPanel from './panles/HelperAttr.vue'
  import SceneAttrPanel from './panles/SceneAttr.vue'
  import CameraAttrPanel from './panles/CameraAttr.vue'
  import LightAttrPanel from './panles/LightAttr.vue'
  import ProjectAttrPanel from './panles/ProjectAttr.vue'
  import AssetManagerPanel from './panles/AssetManager.vue'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { useUiEditorStore } from '@/stores/modules/uiEditor.store.ts'
  import { geometryTypeOptions } from '@/types/geometry'

  /**
   * 左侧编辑面板：
   * - 上半部分：层级树（n-tree）+ 拖拽排序 + 右键菜单（删除等）
   * - 左侧浮动按钮：变换模式切换（平移/旋转/缩放）、世界/本地、撤销/重做、快速创建对象、导入模型
   * - 下半部分：Tab 属性面板（根据当前选中对象类型动态筛选可见的 Tab）
   *
   * 数据来源：
   * - useSceneStore：场景对象树、当前选中对象、transform 模式等
   * - useUiEditorStore：当前激活的 Tab（属性/场景/相机/光源/工程等）
   *
   * 交互约定：
   * - 所有对场景结构的修改最终都回写到 useSceneStore（applyObjectTree / addSceneObjectData / removeSceneObjectData）
   * - 撤销/重做由 store 管理，这里只调用 undo / redo
   */
  const sceneStore = useSceneStore()
  const uiEditorStore = useUiEditorStore()

  const treeData = ref<TreeOption[]>([])
  // 彻底优化：使用防抖，避免频繁重建树结构导致卡顿
  // 只有在用户停止操作一段时间后才更新树结构
  let treeUpdateTimer: ReturnType<typeof setTimeout> | null = null
  watch(() => sceneStore.objectDataList, () => {
    // 清除之前的定时器
    if (treeUpdateTimer) {
      clearTimeout(treeUpdateTimer)
    }
    // 防抖：300ms 后才更新树结构
    treeUpdateTimer = setTimeout(() => {
      treeData.value = sceneStore.getObjectTree()
      treeUpdateTimer = null
    }, 300)
  }, { flush: 'post', deep: false })

  // 下面内容与原 LeftEditPanle.vue 一致，仅命名规范化

  function findSiblingsAndIndex(
    node: TreeOption,
    nodes?: TreeOption[]
  ): [TreeOption[], number] | [null, null] {
    if (!nodes)
      return [null, null]
    for (let i = 0; i < nodes.length; ++i) {
      const siblingNode = nodes[i]
      if (siblingNode?.key === node.key)
        return [nodes, i]
      const [siblings, index] = findSiblingsAndIndex(node, siblingNode?.children)
      if (siblings && index !== null)
        return [siblings, index]
    }
    return [null, null]
  }

  const expandedKeysRef = ref<string[]>(['Scene'])
  const checkedKeysRef = ref<string[]>([])
  const modelUploadList = ref<UploadFileInfo[]>([])
  function handleExpandedKeysChange(expandedKeys: string[]) {
    expandedKeysRef.value = expandedKeys
  }

  function handleCheckedKeysChange(checkedKeys: string[]) {
    checkedKeysRef.value = checkedKeys
  }

  function handleModelFiles(fileList: UploadFileInfo[]) {
    modelUploadList.value = fileList
    const file = fileList[0]?.file
    if (!file) return
    const parentId = sceneStore.selectedObjectId ?? 'Scene'
    sceneStore.importModelFile(file, parentId)
    modelUploadList.value = []
  }

  function handleDrop({ node, dragNode, dropPosition }: TreeDropInfo) {
    const [dragNodeSiblings, dragNodeIndex] = findSiblingsAndIndex(
      dragNode,
      treeData.value
    )
    if (dragNodeSiblings === null || dragNodeIndex === null)
      return
    dragNodeSiblings.splice(dragNodeIndex, 1)
    if (dropPosition === 'inside') {
      if (node.children) {
        node.children.unshift(dragNode)
      }
      else {
        node.children = [dragNode]
      }
    }
    else if (dropPosition === 'before') {
      const [nodeSiblings, nodeIndex] = findSiblingsAndIndex(node, treeData.value)
      if (nodeSiblings === null || nodeIndex === null)
        return
      nodeSiblings.splice(nodeIndex, 0, dragNode)
    }
    else if (dropPosition === 'after') {
      const [nodeSiblings, nodeIndex] = findSiblingsAndIndex(node, treeData.value)
      if (nodeSiblings === null || nodeIndex === null)
        return
      nodeSiblings.splice(nodeIndex + 1, 0, dragNode)
    }
    treeData.value = Array.from(treeData.value)
    sceneStore.applyObjectTree(treeData.value)
  }

  function renderIcon(icon: Component) {
    return () => {
      return h(NIcon, null, {
        default: () => h(icon)
      })
    }
  }

  const showDropdownRef = ref(false)
  const optionsRef = ref<DropdownOption[]>([
    {
      label: '重命名',
      key: 'rename-object',
      icon: renderIcon(DriveFileRenameOutlineRound)
    },
    {
      label: '删除对象',
      key: 'delete-object',
      icon: renderIcon(DeleteFilled)
    }
  ])
  const xRef = ref(0)
  const yRef = ref(0)

  function handleSelect(key: string | number) {
    switch (key) {
      case 'delete-object': {
        const name = sceneStore.currentObjectData?.name ?? ''
        const childCount = sceneStore.currentObjectData?.childrenIds?.length || 0
        sceneStore.dialogProvider?.warning({
          title: 'Warning',
          content: `Delete "${name}"? Its ${childCount} child object(s) will also be removed.`,
          positiveText: 'Delete',
          negativeText: 'Cancel',
          draggable: true,
          onPositiveClick: () => {
            if (sceneStore.selectedObjectId) {
              sceneStore.notification?.success({
                title: 'Deleted',
                content: `Object ID: ${sceneStore.selectedObjectId}\nChildren: ${childCount}`,
                duration: 2000
              })
              sceneStore.removeSceneObjectData(sceneStore.selectedObjectId)
            }
          },
          onNegativeClick: () => {
            sceneStore.notification?.error({
              title: 'Cancelled',
              content: 'Operation cancelled.',
              duration: 2000
            })
          }
        })
        break
      }
      default:
        break
    }

    showDropdownRef.value = false
  }

  function handleClickoutside() {
    showDropdownRef.value = false
  }

  function nodeProps({ option }: { option: TreeOption }) {
    return {
      onClick() {
        sceneStore.selectedObjectId = option.key as string
      },
      onContextmenu(e: MouseEvent): void {
        sceneStore.selectedObjectId = option.key as string
        showDropdownRef.value = true
        xRef.value = e.clientX
        yRef.value = e.clientY
        e.preventDefault()
      }
    }
  }

  watch(() => sceneStore.selectedObjectId, () => {
    uiEditorStore.resetTabForSelection()
  }, { immediate: true })

  const tabs = computed(() => {
    const currentType = sceneStore.currentObjectData?.type
    const isMesh = currentType === 'mesh'
    const isHelper = currentType === 'helper'
    const isScene = currentType === 'scene'
    const isCamera = currentType === 'camera'
    const isLight = currentType === 'light'
    const hasLinkedHelper = sceneStore.objectDataList.some(item =>
      item.type === 'helper' && (item.helper as any)?.targetId === sceneStore.selectedObjectId
    )
    return [
      { name: 'attributes-tab', icon: OptionsSharp, label: '属性', component: AttributesPanel, isShow: true },
      { name: 'assets-tab', icon: FolderOutline, label: '模型库', component: AssetManagerPanel, isShow: true },
      { name: 'scene-tab', icon: ColorPalette, label: '场景属性', component: SceneAttrPanel, isShow: isScene },
      { name: 'camera-tab', icon: Camera, label: '相机属性', component: CameraAttrPanel, isShow: isCamera },
      { name: 'light-tab', icon: LightbulbOutlined, label: '光源属性', component: LightAttrPanel, isShow: isLight },
      { name: 'helper-tab', icon: CubeOutline, label: '辅助对象', component: HelperAttributesPanel, isShow: isHelper || hasLinkedHelper },
      { name: 'geometry-tab', icon: Cube, label: '几何组件', component: GeometryAttrPanel, isShow: isMesh },
      { name: 'material-tab', icon: TextureOutlined, label: '材质组件', component: MaterialAttrPanel, isShow: isMesh },
      { name: 'project-tab', icon: SettingsOutline, label: '工程属性', component: ProjectAttrPanel, isShow: true },
    ].filter(tab => tab.isShow)
  })

  function handleChangeTransformMode(mode: 'translate' | 'rotate' | 'scale', event: Event) {
    event.stopPropagation()
    sceneStore.transformMode = mode
  }

  const lightOptions = [
    { label: '方向光', value: 'light:directionalLight' },
    { label: '点光', value: 'light:pointLight' },
    { label: '聚光', value: 'light:spotLight' },
    { label: '半球光', value: 'light:hemisphereLight' },
    { label: '区域光', value: 'light:rectAreaLight' },
    { label: '环境光', value: 'light:ambientLight' }
  ]

  const cameraOptions = [
    { label: '透视相机', value: 'perspective' }
  ]

  const helperOptions = [
    { label: '坐标轴', value: 'helper:axes' },
    { label: '网格', value: 'helper:grid' },
    { label: '极坐标网格', value: 'helper:polarGrid' },
    { label: '箭头', value: 'helper:arrow' },
    { label: '盒线', value: 'helper:box' },
    { label: '边界盒', value: 'helper:box3' },
    { label: '相机辅助', value: 'helper:camera' },
    { label: '平面辅助', value: 'helper:plane' },
    { label: '骨骼辅助', value: 'helper:skeleton' },
    { label: '光探针辅助', value: 'helper:lightProbe' },
    { label: '法线辅助', value: 'helper:vertexNormals' },
    { label: '方向光辅助', value: 'helper:directionalLight' },
    { label: '点光辅助', value: 'helper:pointLight' },
    { label: '聚光辅助', value: 'helper:spotLight' },
    { label: '半球光辅助', value: 'helper:hemisphereLight' },
    { label: '区域光辅助', value: 'helper:rectAreaLight' }
  ]

  const objectOptions = [
    {
      label: '组',
      key: 'group'
    },
    {
      label: '网格',
      key: 'mesh',
      children: geometryTypeOptions.map(option => ({
        label: option.label,
        key: option.value
      }))
    },
    {
      label: '光源',
      key: 'light',
      children: lightOptions.map(option => ({
        label: option.label,
        key: option.value
      }))
    },
    {
      label: '相机',
      key: 'camera',
      children: cameraOptions.map(option => ({
        label: option.label,
        key: option.value
      }))
    },
    {
      label: '辅助对象',
      key: 'helper',
      children: helperOptions.map(option => ({
        label: option.label,
        key: option.value
      }))
    }
  ]

  function handleAddObjectSelect(key: string | number) {
    const value = String(key)
    const geometryOption = geometryTypeOptions.find(option => option.value === value)
    const lightOption = lightOptions.find(option => option.value === value)
    const cameraOption = cameraOptions.find(option => option.value === value)
    const helperOption = helperOptions.find(option => option.value === value)
    const parentId = sceneStore.selectedObjectId ?? 'Scene'

    if (geometryOption) {
      const created = sceneStore.addSceneObjectData({
        type: 'mesh',
        name: geometryOption.label,
        parentId,
        mesh: {
          geometry: { type: geometryOption.value },
          material: { type: 'standard' }
        }
      })
      sceneStore.selectedObjectId = created.id
      return
    }

    if (lightOption) {
      const lightType = lightOption.value.replace('light:', '')
      const created = sceneStore.addSceneObjectData({
        type: 'light',
        name: lightOption.label,
        parentId,
        userData: { lightType }
      })
      sceneStore.selectedObjectId = created.id
      return
    }

    if (cameraOption) {
      const created = sceneStore.addSceneObjectData({
        type: 'camera',
        name: cameraOption.label,
        parentId
      })
      sceneStore.selectedObjectId = created.id
      return
    }

    if (helperOption) {
      const targetId = sceneStore.selectedObjectId ?? undefined
      const helperParentId = 'Scene'
      const helperType = helperOption.value.replace('helper:', '')
      const helperDefaults: Record<string, any> = {
        axes: { type: 'axes', size: 5 },
        grid: { type: 'grid', size: 40, divisions: 40, colorCenterLine: '#666666', colorGrid: '#444444' },
        polarGrid: { type: 'polarGrid', radius: 5, radials: 16, circles: 8, divisions: 64 },
        arrow: { type: 'arrow', dir: [0, 1, 0], origin: [0, 0, 0], length: 5, color: '#ffffff' },
        box: { type: 'box' },
        box3: { type: 'box3', min: [-1, -1, -1], max: [1, 1, 1] },
        camera: { type: 'camera' },
        plane: { type: 'plane', size: 5, normal: [0, 1, 0], constant: 0 },
        skeleton: { type: 'skeleton' },
        lightProbe: { type: 'lightProbe', size: 1 },
        vertexNormals: { type: 'vertexNormals', size: 1, color: '#444444' },
        directionalLight: { type: 'directionalLight' },
        pointLight: { type: 'pointLight', sphereSize: 0.5 },
        spotLight: { type: 'spotLight' },
        hemisphereLight: { type: 'hemisphereLight' },
        rectAreaLight: { type: 'rectAreaLight' }
      }
      const helper = helperDefaults[helperType] ?? { type: helperType }
      if (targetId && helper && typeof helper === 'object' && !helper.targetId) {
        helper.targetId = targetId
      }
      const created = sceneStore.addSceneObjectData({
        type: 'helper',
        name: helperOption.label,
        parentId: helperParentId,
        helper
      })
      sceneStore.selectedObjectId = created.id
      return
    }

    if (value === 'group') {
      const created = sceneStore.addSceneObjectData({ type: 'group', name: '组', parentId })
      sceneStore.selectedObjectId = created.id
    }
  }
</script>

<template>
  <n-flex vertical style="margin-top: 40px; position: fixed;">
    <!-- transform -->
    <n-float-button-group shape="square" style="z-index: 10; margin-left: -80px; position: relative;">
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button :class="sceneStore.transformMode === 'translate' ? 'n-float-button-active' : ''" @click.stop="handleChangeTransformMode('translate', $event)">
            <n-icon><Move /></n-icon>
          </n-float-button>
        </template>
        移动
      </n-tooltip>
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button :class="sceneStore.transformMode === 'rotate' ? 'n-float-button-active' : ''" @click.stop="handleChangeTransformMode('rotate', $event)">
            <n-icon><Md3DRotationFilled /></n-icon>
          </n-float-button>
        </template>
        旋转
      </n-tooltip>
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button :class="sceneStore.transformMode === 'scale' ? 'n-float-button-active' : ''" @click.stop="handleChangeTransformMode('scale', $event)">
            <n-icon><Resize /></n-icon>
          </n-float-button>
        </template>
        缩放
      </n-tooltip>
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button @click.stop="sceneStore.transformSpace = sceneStore.transformSpace === 'local' ? 'world' : 'local'">
            <n-icon>
              <PlaceFilled v-if="sceneStore.transformSpace === 'local'" />
              <Earth v-else-if="sceneStore.transformSpace === 'world'" />
            </n-icon>
          </n-float-button>
        </template>
        {{ sceneStore.transformSpace === 'local' ? '本地' : '世界' }}
      </n-tooltip>
    </n-float-button-group>
    <!-- undo/redo -->
    <n-float-button-group shape="square" style="z-index: 10; margin-left: -80px; position: relative;">
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button :class="sceneStore.undoStack.length === 0 ? 'n-float-button-disabled' : ''" @click="sceneStore.undo">
            <n-icon><ArrowUndo /></n-icon>
          </n-float-button>
        </template>
        撤回
      </n-tooltip>
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button :class="sceneStore.redoStack.length === 0 ? 'n-float-button-disabled' : ''" @click.stop="sceneStore.redo">
            <n-icon><ArrowRedo /></n-icon>
          </n-float-button>
        </template>
        回退
      </n-tooltip>
    </n-float-button-group>
    <!-- addObject -->
    <n-dropdown trigger="hover" :options="objectOptions" @select="handleAddObjectSelect" placement="left-start">
      <n-float-button shape="square" style="z-index: 10; margin-left: -80px; position: relative;">
        <n-icon>
          <Cube />
        </n-icon>
      </n-float-button>
    </n-dropdown>
    <!-- import model -->
    <n-upload
      :default-upload="false"
      :show-file-list="false"
      accept=".glb,.gltf"
      :file-list="modelUploadList"
      @update:file-list="(files: UploadFileInfo[]) => handleModelFiles(files)"
    >
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button shape="square" style="z-index: 10; margin-left: -80px; position: relative;">
            <n-icon>
              <Cubes />
            </n-icon>
          </n-float-button>
        </template>
        导入模型
      </n-tooltip>
    </n-upload>
    <!-- open model library -->
    <n-tooltip trigger="hover" placement="right">
      <template #trigger>
        <n-float-button shape="square" style="z-index: 10; margin-left: -80px; position: relative;" @click="uiEditorStore.setTabKey('assets-tab')">
          <n-icon>
            <FolderOutline />
          </n-icon>
        </n-float-button>
      </template>
      模型库
    </n-tooltip>
  </n-flex>

  <n-dropdown
    trigger="manual"
    placement="bottom-start"
    :show="showDropdownRef"
    :options="optionsRef"
    :x="xRef"
    :y="yRef"
    @select="handleSelect"
    @clickoutside="handleClickoutside"
  />
  <n-tree
    block-line
    expand-on-click
    draggable
    :data="treeData"
    :checked-keys="checkedKeysRef"
    :expanded-keys="expandedKeysRef"
    @drop="handleDrop"
    @update:checked-keys="handleCheckedKeysChange"
    @update:expanded-keys="handleExpandedKeysChange"
    :selected-keys="sceneStore.selectedObjectId ? [sceneStore.selectedObjectId] : []"
    style="width: 100%; height: 40%;"
    :node-props="nodeProps"
  />

  <n-divider />

  <n-tabs
    type="line"
    animated
    placement="left"
    style="width: 100%; height: 60%;"
    :value="uiEditorStore.tabKey ?? undefined"
    @update:value="(value: string) => uiEditorStore.setTabKey(value)"
  >
    <template v-for="tab in tabs" :key="tab.name">
      <n-tab-pane :name="tab.name">
        <template #tab>
          <n-popover placement="left" trigger="hover">
            <template #trigger>
              <n-icon size="22">
                <component :is="tab.icon" />
              </n-icon>
            </template>
            {{ tab.label }}
          </n-popover>
        </template>
        <!-- 属性面板内容 -->
        <component v-if="tab.name === 'project-tab' || tab.name === 'assets-tab'" :is="tab.component" />
        <component v-else-if="sceneStore.currentObjectData" :is="tab.component" />
        <n-empty v-else description="未选择对象" />
      </n-tab-pane>
    </template>
  </n-tabs>
</template>

<style scoped>
  .n-float-button-active {
    background-color: #409eff !important;
    color: white;
  }
  .n-float-button-disabled {
    color: #90A4AE;
  }
</style>

