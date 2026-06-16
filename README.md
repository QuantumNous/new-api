# new-api（定制版）

本仓库 clone 自上游 [QuantumNous/new-api](https://github.com/QuantumNous/new-api)。

## 定制修改记录

- 用户统计：排行榜支持「费用消耗 / 调用次数」切换
- 主页：移除「文档」按钮
- 页脚：内容居中 + 支持 Markdown 超链接（可配置备案信息）
- 系统名称动态化（默认 "Yunlong API"），不再硬编码品牌名
- 页脚：移除默认页脚的品牌区
- 界面语言：仅中文（移除多语言切换与多语言资源）
- 品牌图标：替换为 Agently 图标（`logo.png` + `favicon.ico` + `logo.svg` 源，蓝→紫渐变 + 字母 A + 火花，180×180）
- CI：新增 Docker 镜像发布 workflow（`.github/workflows/docker-publish.yml`，手动触发，amd64+arm64 多架构推送到 Docker Hub `yunlong1989/new-api`）
