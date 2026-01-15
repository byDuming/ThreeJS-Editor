<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { sceneApi, type SceneListItem } from '@/services/sceneApi'
import { useDialog, useMessage } from 'naive-ui'

const router = useRouter()
const dialog = useDialog()
const message = useMessage()

const sceneList = ref<SceneListItem[]>([])
const loading = ref(false)

// 加载场景列表
async function loadSceneList() {
  loading.value = true
  try {
    // 从云端获取（如果启用云同步）
    const scenes = await sceneApi.getSceneList()
    console.log('📋 加载的场景列表:', scenes)
    sceneList.value = scenes
  } catch (error) {
    console.error('加载场景列表失败:', error)
    message.error('加载场景列表失败')
  } finally {
    loading.value = false
  }
}

// 创建新场景
async function createNewScene() {
  // 使用浏览器原生 prompt，简单直接
  const inputName = prompt('请输入场景名称：', `新场景 ${new Date().toLocaleString()}`)
  
  if (inputName === null) {
    // 用户取消了
    return
  }
  
  const name = inputName.trim() || `新场景 ${new Date().toLocaleString()}`
  
  try {
    loading.value = true
    const newScene = await sceneApi.createScene({ name })
    console.log('✅ 创建的场景:', newScene)
    console.log('   场景ID:', newScene.id)
    console.log('   场景名称:', newScene.name)
    message.success('创建成功')
    
    // 等待一下确保数据已保存
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 强制从本地获取列表（不使用云端）
    await loadSceneList()
  } catch (error: any) {
    console.error('❌ 创建场景失败:', error)
    message.error(`创建场景失败: ${error.message || '未知错误'}`)
  } finally {
    loading.value = false
  }
}

// 删除场景
async function handleDeleteScene(id: number, name: string, event: Event) {
  event.stopPropagation()
  dialog.warning({
    title: '确认删除',
    content: `确定要删除场景 "${name}" 吗？此操作不可恢复。`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      try {
        loading.value = true
        const success = await sceneApi.deleteScene(id)
        if (success) {
          message.success('删除成功')
          await loadSceneList()
        } else {
          message.error('删除失败')
        }
      } catch (error) {
        console.error('删除场景失败:', error)
        message.error('删除场景失败')
      } finally {
        loading.value = false
      }
    }
  })
}

// 跳转到编辑页面
function handleEditScene(id: number) {
  router.push(`/engine?sceneId=${id}`)
}

// 格式化日期
function formatDate(date: Date): string {
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadSceneList()
})
</script>

<template>
  <div style="padding: 1vw;">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1vw;">
      <h2 style="margin: 0;">我的作品</h2>
      <n-space>
        <!-- <n-button type="info" @click="handleTestConnection" :loading="loading">
          测试连接
        </n-button>
        <n-button type="success" @click="handleTestCreateScene" :loading="loading">
          测试创建
        </n-button> -->
        <n-button type="primary" @click="createNewScene" :loading="loading">
          新增场景
        </n-button>
      </n-space>
    </div>
    
    <n-spin :show="loading">
      <n-grid x-gap="12" :cols="6" v-if="sceneList.length > 0">
        <n-gi v-for="scene in sceneList" :key="scene.id">
          <n-card 
            :title="scene.name" 
            class="card"
            hoverable
            @click="handleEditScene(scene.id)"
            style="cursor: pointer;"
          >
            <template #cover>
              <div class="card-img" :style="{
                backgroundImage: scene.thumbnail 
                  ? `url(${scene.thumbnail})` 
                  : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }">
                <div class="card-overlay">
                  <n-space>
                    <n-button size="small" @click.stop="handleEditScene(scene.id)">
                      编辑
                    </n-button>
                    <n-button 
                      size="small" 
                      type="error" 
                      @click.stop="handleDeleteScene(scene.id, scene.name, $event)"
                    >
                      删除
                    </n-button>
                  </n-space>
                </div>
              </div>
            </template>
            <template #footer>
              <div style="font-size: 12px; color: #999;">
                <div>版本: v{{ scene.version }}</div>
                <div>更新: {{ formatDate(scene.updatedAt) }}</div>
              </div>
            </template>
          </n-card>
        </n-gi>
      </n-grid>
      <n-empty v-else description="暂无场景，点击上方按钮创建新场景" />
    </n-spin>
  </div>
</template>

<style scoped>
.card {
  height: 300px;
  transition: transform 0.2s;
}

.card:hover {
  transform: translateY(-4px);
}

.card-img {
  width: 100%;
  height: 200px;
  background: center center / cover no-repeat;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

.card-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.card:hover .card-overlay {
  opacity: 1;
}
</style>
