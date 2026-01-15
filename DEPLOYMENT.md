# GitHub Pages 部署指南

## 已修复的配置问题

### 1. ✅ 路由配置
- **问题**：使用 `createWebHistory` 在 GitHub Pages 上会有路由问题
- **修复**：生产环境自动使用 `createWebHashHistory`（hash 模式）
- **文件**：`src/route/index.ts`

### 2. ✅ Base Path 配置
- **已配置**：`vite.config.ts` 中设置了 `base: '/3DWG-Engine/'`
- **注意**：如果仓库名称不是 `3DWG-Engine`，需要修改此配置

### 3. ✅ GitHub Actions 工作流
- **已配置**：`.github/workflows/static.yml`
- **环境变量**：已添加 Supabase 环境变量支持（需要在 GitHub Secrets 中配置）

### 4. ✅ .gitignore
- **已更新**：确保 `.env` 文件不会被提交

## 部署前检查清单

### 必需步骤

1. **检查仓库名称**
   - 确认 GitHub 仓库名称
   - 如果名称不是 `3DWG-Engine`，修改 `vite.config.ts` 中的 `base` 配置

2. **配置 GitHub Secrets**（如果需要云同步功能）
   - 进入 GitHub 仓库 → Settings → Secrets and variables → Actions
   - 添加以下 Secrets：
     - `VITE_SUPABASE_URL`：你的 Supabase 项目 URL
     - `VITE_SUPABASE_ANON_KEY`：你的 Supabase anon key
   - **注意**：如果不配置，应用仍可运行，但云同步功能不可用

3. **启用 GitHub Pages**
   - 进入 GitHub 仓库 → Settings → Pages
   - Source: 选择 "GitHub Actions"
   - 保存设置

### 可选步骤

4. **本地测试构建**
   ```bash
   pnpm run build
   pnpm run preview
   ```
   - 检查构建是否成功
   - 检查路由是否正常工作

5. **检查环境变量**
   - 确保 `.env` 文件在本地存在（用于开发）
   - 确保 `.env` 在 `.gitignore` 中（不会被提交）

## 部署流程

1. **推送代码到 main 分支**
   ```bash
   git add .
   git commit -m "准备部署"
   git push origin main
   ```

2. **GitHub Actions 自动构建**
   - 推送后，GitHub Actions 会自动触发构建
   - 可以在 Actions 标签页查看构建进度

3. **等待部署完成**
   - 构建完成后，GitHub Pages 会自动部署
   - 部署完成后，访问：`https://你的用户名.github.io/3DWG-Engine/`

## 常见问题

### 1. 404 错误
- **原因**：路由配置问题或 base path 不正确
- **解决**：检查 `vite.config.ts` 中的 `base` 配置是否与仓库名称一致

### 2. 资源加载失败
- **原因**：路径配置问题
- **解决**：确保所有资源路径使用相对路径或 `import.meta.env.BASE_URL`

### 3. 云同步功能不可用
- **原因**：未配置 GitHub Secrets
- **解决**：按照上述步骤配置 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`

### 4. 构建失败
- **检查**：GitHub Actions 日志
- **常见原因**：
  - 依赖安装失败
  - TypeScript 类型错误
  - 环境变量缺失（如果代码中必需）

## 验证部署

部署成功后，检查以下功能：

1. ✅ 页面可以正常访问
2. ✅ 路由跳转正常（hash 模式）
3. ✅ 3D 场景可以正常加载
4. ✅ 对象操作正常（如果云同步未配置，本地功能应正常）
5. ✅ 控制台无错误

## 注意事项

- **云同步功能**：如果未配置 GitHub Secrets，应用会回退到本地存储模式
- **性能优化**：已优化的代码在所有浏览器上都能正常工作
- **Chrome 特定问题**：如果遇到 Chrome 特定的性能问题，可以尝试其他浏览器
