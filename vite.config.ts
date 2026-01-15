import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

import AutoImport from 'unplugin-auto-import/vite'
import { NaiveUiResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/3DWG-Engine/',   // GitHub Pages 仓库名称
  build: { 
    outDir: 'dist',
    // 确保构建产物正确
    assetsDir: 'assets',
    // 启用 sourcemap（可选，用于调试）
    sourcemap: false,
  },
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        {
          'naive-ui': [
            'useDialog',
            'useMessage',
            'useNotification',
            'useLoadingBar'
          ]
        }
      ]
    }),
    Components({
      resolvers: [NaiveUiResolver()]
    })],
  resolve:{
    alias:{
      '@':path.resolve(__dirname,'./src')
    }
  }
})
