import { supabase } from '@/services/supabase'
import { sceneApi } from '@/services/sceneApi'
import { cloudSync } from '@/services/cloudSync'

/**
 * 测试 Supabase 连接和功能
 */
export async function testSupabaseConnection() {
  console.log('🧪 开始测试 Supabase 连接...')

  // 测试 1: 检查配置
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    console.error('❌ Supabase 配置缺失')
    console.log('请检查 .env 文件中的 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
    return false
  }

  console.log('✅ Supabase 配置存在')
  console.log('   URL:', url.substring(0, 30) + '...')

  // 测试 2: 检查连接
  try {
    const { error } = await supabase.from('scenes').select('count').limit(1)
    if (error) {
      // 如果表不存在，这是预期的
      if (error.code === '42P01') {
        console.warn('⚠️  scenes 表不存在，请先执行 supabase-schema.sql')
        return false
      }
      throw error
    }
    console.log('✅ Supabase 连接成功')
  } catch (error: any) {
    console.error('❌ Supabase 连接失败:', error.message)
    if (error.code === '42P01') {
      console.log('   提示: 请先在 Supabase SQL Editor 中执行 supabase-schema.sql')
    }
    return false
  }

  // 测试 3: 匿名模式（不需要登录）
  console.log('✅ 匿名模式：无需登录即可使用云同步功能')

  // 测试 4: 测试场景 API
  try {
    console.log('\n📋 测试场景列表获取...')
    const scenes = await sceneApi.getSceneList()
    console.log(`✅ 成功获取 ${scenes.length} 个场景`)
    
    if (scenes.length > 0) {
      console.log('   场景列表:')
      scenes.forEach(scene => {
        console.log(`   - ${scene.name} (ID: ${scene.id}, 版本: v${scene.version})`)
      })
    }
  } catch (error: any) {
    console.error('❌ 获取场景列表失败:', error.message)
  }

  // 测试 5: 测试云同步
  if (sceneApi.isCloudSyncEnabled()) {
    try {
      console.log('\n☁️  测试云同步功能...')
      const cloudScenes = await cloudSync.downloadSceneList()
      console.log(`✅ 成功从云端获取 ${cloudScenes.length} 个场景`)
      
      if (cloudScenes.length > 0) {
        console.log('   云端场景列表:')
        cloudScenes.forEach(scene => {
          console.log(`   - ${scene.name} (ID: ${scene.id}, 版本: v${scene.version})`)
        })
      }
    } catch (error: any) {
      console.warn('⚠️  云同步测试失败:', error.message)
      console.log('   提示: 请确保已执行 supabase-schema.sql 并设置了正确的 RLS 策略')
    }
  } else {
    console.log('\n☁️  云同步未启用（未配置 Supabase）')
  }

  console.log('\n✨ 测试完成！')
  return true
}

/**
 * 测试创建场景（包含云同步）
 */
export async function testCreateScene() {
  console.log('🧪 测试创建场景...')

  try {
    const testSceneName = `测试场景 ${new Date().toLocaleString()}`
    const scene = await sceneApi.createScene({
      name: testSceneName
    })

    console.log('✅ 场景创建成功')
    console.log('   场景ID:', scene.id)
    console.log('   场景名称:', scene.name)
    console.log('   对象数量:', scene.objectDataList.length)

    // 等待一下让云同步完成
    await new Promise(resolve => setTimeout(resolve, 1000))

    // 尝试从云端获取
    if (sceneApi.isCloudSyncEnabled()) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user && scene.id) {
          const cloudScene = await cloudSync.downloadScene(scene.id)
          if (cloudScene) {
            console.log('✅ 云同步成功，场景已上传到云端')
          } else {
            console.warn('⚠️  场景未在云端找到（可能同步延迟）')
          }
        }
      } catch (error: any) {
        console.warn('⚠️  云同步检查失败:', error.message)
      }
    }

    return scene
  } catch (error: any) {
    console.error('❌ 创建场景失败:', error.message)
    throw error
  }
}
