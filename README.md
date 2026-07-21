# 厨房管理器

## 部署到手机（5分钟）

### 第一步：上传到 GitHub
1. 打开 [github.com](https://github.com) 注册/登录
2. 点右上角「+」→「New repository」
3. 填仓库名 `kitchen-manager`，点「Create repository」
4. 把这个文件夹的所有文件上传上去（拖拽到页面即可）

### 第二步：部署到 Vercel
1. 打开 [vercel.com](https://vercel.com)，用 GitHub 账号登录
2. 点「Add New Project」→ 选择 `kitchen-manager` 仓库
3. 点「Deploy」，等待 1-2 分钟
4. 部署完成后会得到一个链接，如 `https://kitchen-manager-xxx.vercel.app`

### 第三步：添加到 iPhone 主屏幕
1. 用 Safari 打开上面的链接
2. 点底部分享按钮（方块加箭头的图标）
3. 选「添加到主屏幕」
4. 点「添加」，完成！

---

## 功能说明
- **冰箱食材**：添加食材，填入库日期+保质天数，自动计算到期日和状态
- **本周菜谱**：七天日历，可从菜谱库快捷选择，显示当日推荐
- **菜谱库**：自己添加菜谱，支持粘贴文字自动解析，标签自定义
- **智能匹配**：点击菜谱查看与冰箱食材的匹配情况，显示缺什么食材
- **数据保存**：所有数据保存在手机本地，不联网也能用，刷新不丢失
