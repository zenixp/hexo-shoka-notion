# Shoka主题的Hexo与Notion集成

一个使用 [Hexo](https://github.com/hexojs/hexo) 构建并使用 [Shoka](https://github.com/amehime/hexo-theme-shoka) 主题的静态博客，
- 集成Notion进行内容管理
- 集成waline为评论系统

## 开始使用

### 安装

1. 克隆仓库:
   ```bash
   git clone https://github.com/zenixp/hexo-shoka-notion.git
   cd hexo-shoka-notion
   ```

2. 安装依赖:
   ```bash
   yarn install
   ```

### 配置

1. 设置 Notion integration:
   - 创建一个 Notion integration并获取您的令牌
   - 与集成共享您的 Notion 数据库
   - 在 `.env` 文件中添加 `NOTION_TOKEN` 和 `NOTION_DATA_SOURCE`

2. 设置 waline:
   - waline部署请参考 https://waline.js.org/guide/get-started/
   - 将地址配置到_config.yml中

3. 其他配置请参考原 [Shoka文档](https://shoka.lostyu.me/computer-science/note/theme-shoka-doc/)

```yaml
waline:
  url: http://your-waline-url
```

### 开发命令

```bash
# 启动本地开发服务器
yarn run server

# 从 Notion 同步内容
yarn run sync

# 生成静态文件
yarn run build

# 清除缓存文件
yarn run clean

# 索引文章到 Algolia 搜索
yarn run algolia
```

## Notion 集成

使用 `notion_sync.js` 脚本从 Notion 数据库中拉取内容。脚本会：
- 从您的 Notion 数据库中获取已发布的文章
- 将 Notion 页面转换为 Markdown 格式
- 下载和管理图片和资源
- 生成带有标签、分类和元数据的正确前言

### 必需的 Notion 数据库属性

- `Title` (标题) - 文章标题
- `Published` (复选框) - 是否发布文章
- `Date` (日期) - 发布日期
- `Tags` (多选) - 文章标签
- `Category` (下拉) - 文章分类
- `Cover` (文件) - 文章封面图片

## 部署

要部署您的博客，可以使用任何静态托管服务：

1. 构建流程:
   ```bash
   # 从 Notion 同步内容
   yarn run sync
   # 同步内容到 algolia （如果有配置algolia）
   yarn run algolia
   # 生成静态文件
   yarn run build
   ```

2. 将 `public/` 目录部署到您首选的托管服务:
   - GitHub Pages
   - Netlify
   - Vercel
   - 任何静态文件托管服务

## 项目结构

```
├── source/                 # 源内容
│   ├── _posts/            # 生成的博客文章 (来自 Notion)
│   └── assets/            # 下载的资源 (图片)
├── themes/shoka/          # Shoka 主题文件
├── public/                # 生成的静态站点
├── _config.yml            # 主 Hexo 配置
├── _config.shoka.yml      # 主题配置
└── notion_sync.js         # Notion 同步脚本
```

## 许可证

此项目根据 MIT 许可证授权 - 请参阅 LICENSE 文件了解详情。
