<script setup lang="ts">
  import { type TreeDropInfo, type TreeOption, NIcon, type DropdownOption, NInput } from 'naive-ui'
  import { ref, computed, watch, h, type Component} from 'vue'
  import { Cube, OptionsSharp, CubeOutline, ColorPalette, Camera, Move, Resize, Earth, ArrowUndo, ArrowRedo, SettingsOutline, FolderOutline, CopyOutline, ExtensionPuzzleOutline } from '@vicons/ionicons5'
  import { TextureOutlined, DeleteFilled, DriveFileRenameOutlineRound, LightbulbOutlined, Md3DRotationFilled, PlaceFilled } from '@vicons/material'

  import AttributesPanel from './panels/Attributes.vue'
  import GeometryAttrPanel from './panels/GeometryAttr.vue'
  import MaterialAttrPanel from './panels/MaterialAttr.vue'
  import HelperAttributesPanel from './panels/HelperAttr.vue'
  import SceneAttrPanel from './panels/SceneAttr.vue'
  import CameraAttrPanel from './panels/CameraAttr.vue'
  import LightAttrPanel from './panels/LightAttr.vue'
  import ProjectAttrPanel from './panels/ProjectAttr.vue'
  import PluginManagerPanel from './panels/PluginManager.vue'
  import { useSceneStore } from '@/stores/modules/useScene.store'
  import { useUiEditorStore } from '@/stores/modules/uiEditor.store.ts'
  import { geometryTypeOptions } from '@/types/geometry'
  import { usePluginManager } from '@/core'

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
  const { panels: pluginPanels } = usePluginManager()

  const treeData = ref<TreeOption[]>([])
  // 彻底优化：使用防抖，避免频繁重建树结构导致卡顿
  // 只有在用户停止操作一段时间后才更新树结构
  // 监听 objectDataList.length 和 historyVersion（撤回/重做时更新树）
  let treeUpdateTimer: ReturnType<typeof setTimeout> | null = null
  
  function scheduleTreeUpdate() {
    // 清除之前的定时器
    if (treeUpdateTimer) {
      clearTimeout(treeUpdateTimer)
    }
    // 防抖：300ms 后才更新树结构
    treeUpdateTimer = setTimeout(() => {
      treeData.value = sceneStore.getObjectTree()
      treeUpdateTimer = null
    }, 300)
  }
  
  // 监听数组长度变化（添加/删除对象）
  watch(() => sceneStore.objectDataList.length, scheduleTreeUpdate, { flush: 'post', immediate: true })
  // 监听历史版本变化（撤回/重做时，parentId 可能变化，需要更新树）
  watch(() => sceneStore.historyVersion, scheduleTreeUpdate, { flush: 'post' })

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
  
  function handleExpandedKeysChange(expandedKeys: string[]) {
    expandedKeysRef.value = expandedKeys
  }

  function handleCheckedKeysChange(checkedKeys: string[]) {
    checkedKeysRef.value = checkedKeys
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
  const renameInputRef = ref('')
  const optionsRef = ref<DropdownOption[]>([
    {
      label: '重命名',
      key: 'rename-object',
      icon: renderIcon(DriveFileRenameOutlineRound)
    },
    {
      label: '复制对象',
      key: 'duplicate-object',
      icon: renderIcon(CopyOutline)
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
      case 'rename-object': {
        const currentName = sceneStore.selectedObjectData?.name ?? ''
        const id = sceneStore.selectedObjectId
        if (!id || sceneStore.selectedObjectData?.type === 'scene') {
          sceneStore.notification?.warning({
            title: '无法重命名',
            content: '场景根节点不能重命名',
            duration: 2000
          })
          break
        }
        renameInputRef.value = currentName
        sceneStore.dialogProvider?.create({
          title: '重命名',
          content: () => h(NInput, {
            value: renameInputRef.value,
            placeholder: '请输入新名称',
            autofocus: true,
            onUpdateValue: (val: string) => { renameInputRef.value = val }
          }),
          positiveText: '确认',
          negativeText: '取消',
          draggable: true,
          onPositiveClick: () => {
            const newName = renameInputRef.value.trim()
            if (newName && newName !== currentName) {
              sceneStore.updateSceneObjectData(id, { name: newName })
              // 手动刷新树，因为 name 变更不会触发 historyVersion 更新
              treeData.value = sceneStore.getObjectTree()
              sceneStore.notification?.success({
                title: '重命名成功',
                content: `"${currentName}" → "${newName}"`,
                duration: 2000
              })
            }
          }
        })
        break
      }
      case 'duplicate-object': {
        const sourceData = sceneStore.selectedObjectData
        if (!sourceData || sourceData.type === 'scene') {
          sceneStore.notification?.warning({
            title: '无法复制',
            content: '场景根节点不能复制',
            duration: 2000
          })
          break
        }
        
        // 深拷贝对象数据
        const cloneData: any = {
          type: sourceData.type,
          name: `${sourceData.name}_copy`,
          parentId: sourceData.parentId,
          transform: JSON.parse(JSON.stringify(sourceData.transform)),
          visible: sourceData.visible
        }
        
        // 根据类型复制特定属性
        if (sourceData.mesh) {
          cloneData.mesh = JSON.parse(JSON.stringify(sourceData.mesh))
        }
        if (sourceData.helper) {
          cloneData.helper = JSON.parse(JSON.stringify(sourceData.helper))
        }
        if (sourceData.userData) {
          cloneData.userData = JSON.parse(JSON.stringify(sourceData.userData))
        }
        if (sourceData.assetId) {
          cloneData.assetId = sourceData.assetId
        }
        
        const created = sceneStore.addSceneObjectData(cloneData)
        sceneStore.selectedObjectId = created.id
        
        sceneStore.notification?.success({
          title: '复制成功',
          content: `已创建 "${created.name}"`,
          duration: 2000
        })
        break
      }
      case 'delete-object': {
        const name = sceneStore.selectedObjectData?.name ?? ''
        const childCount = sceneStore.selectedObjectData?.childrenIds?.length || 0
        sceneStore.dialogProvider?.warning({
          title: '警告',
          content: `确认删除 "${name}"? 它的 ${childCount} 个子对象也会被删除。`,
          positiveText: '确认',
          negativeText: '取消',
          draggable: true,
          onPositiveClick: () => {
            if (sceneStore.selectedObjectId) {
              sceneStore.notification?.success({
                title: '删除成功',
                content: `Object ID: ${sceneStore.selectedObjectId}\nChildren: ${childCount}`,
                duration: 2000
              })
              sceneStore.removeSceneObjectData(sceneStore.selectedObjectId)
            }
          },
          onNegativeClick: () => {
            sceneStore.notification?.error({
              title: '取消',
              content: '操作取消。',
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
    const currentType = sceneStore.selectedObjectData?.type
    const isMesh = currentType === 'mesh'
    const isHelper = currentType === 'helper'
    const isScene = currentType === 'scene'
    const isCamera = currentType === 'camera'
    const isLight = currentType === 'light'
    const hasLinkedHelper = sceneStore.objectDataList.some(item =>
      item.type === 'helper' && (item.helper as any)?.targetId === sceneStore.selectedObjectId
    )

    const baseTabs = [
      { name: 'attributes-tab', icon: OptionsSharp, label: '属性', component: AttributesPanel, isShow: true, requiresSelection: true },
      { name: 'scene-tab', icon: ColorPalette, label: '场景属性', component: SceneAttrPanel, isShow: isScene, requiresSelection: true },
      { name: 'camera-tab', icon: Camera, label: '相机属性', component: CameraAttrPanel, isShow: isCamera, requiresSelection: true },
      { name: 'light-tab', icon: LightbulbOutlined, label: '光源属性', component: LightAttrPanel, isShow: isLight, requiresSelection: true },
      { name: 'helper-tab', icon: CubeOutline, label: '辅助对象', component: HelperAttributesPanel, isShow: isHelper || hasLinkedHelper, requiresSelection: true },
      { name: 'geometry-tab', icon: Cube, label: '几何组件', component: GeometryAttrPanel, isShow: isMesh, requiresSelection: true },
      { name: 'material-tab', icon: TextureOutlined, label: '材质组件', component: MaterialAttrPanel, isShow: isMesh, requiresSelection: true },
      { name: 'project-tab', icon: SettingsOutline, label: '工程属性', component: ProjectAttrPanel, isShow: true, requiresSelection: false },
      { name: 'plugin-tab', icon: ExtensionPuzzleOutline, label: '插件管理', component: PluginManagerPanel, isShow: true, requiresSelection: false },
    ]

    const leftPluginPanels = pluginPanels.value
      .filter(p => p.position === 'left')
      .map(p => ({
        name: `plugin-panel:${p.id}`,
        icon: p.icon ?? ExtensionPuzzleOutline,
        label: p.name,
        component: p.component,
        isShow: true,
        requiresSelection: false
      }))

    return [...baseTabs, ...leftPluginPanels].filter(tab => tab.isShow)
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
          <n-float-button 
            :class="!sceneStore.canUndo ? 'n-float-button-disabled' : ''" 
            @click="sceneStore.undo">
            <n-icon><ArrowUndo /></n-icon>
          </n-float-button>
        </template>
        撤回
      </n-tooltip>
      <n-tooltip trigger="hover" placement="right">
        <template #trigger>
          <n-float-button 
            :class="!sceneStore.canRedo ? 'n-float-button-disabled' : ''" 
            @click.stop="sceneStore.redo">
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
    <!-- open asset panel -->
    <n-tooltip trigger="hover" placement="right">
      <template #trigger>
        <n-float-button shape="square" style="z-index: 10; margin-left: -80px; position: relative;" @click="uiEditorStore.isAssetPanelOpen ? uiEditorStore.closeAssetPanel() : uiEditorStore.openAssetPanel('model')">
          <n-icon>
            <FolderOutline />
          </n-icon>
        </n-float-button>
      </template>
      资产管理
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
        <component v-if="tab.requiresSelection === false" :is="tab.component" />
        <component v-else-if="sceneStore.selectedObjectData" :is="tab.component" />
        <n-empty v-else description="未选择对象" />
      </n-tab-pane>
    </template>
  </n-tabs>
</template>

<style scoped>
  .n-float-button-active {
    background-color: var(--n-primary-color, #18a058) !important;
    color: #fff;
  }
  .n-float-button-active:hover {
    background-color: var(--n-primary-color-hover, #36ad6a) !important;
  }
  .n-float-button-active:active {
    background-color: var(--n-primary-color-pressed, #0c7a43) !important;
  }
  .n-float-button-disabled {
    color: #90A4AE;
  }
</style>

