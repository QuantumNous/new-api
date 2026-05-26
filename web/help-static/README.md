# aiapi114 静态帮助中心

这是第一版独立静态 HTML 帮助中心，不依赖 React 路由或后端服务。

## 本地预览

在仓库根目录运行：

```powershell
node "web/help-static/scripts/build-content.mjs"
node "web/help-static/scripts/serve.mjs"
```

访问：

```text
http://localhost:3014
```

## 内容规则

- 参考资料来自 `docs/reference-help-docs`。
- 不导入管理员相关文档路径。
- 竞品名称和平台 URL 会在生成阶段替换为 aiapi114 语境。
- 图片不会直接沿用竞品素材，所有图片位置会渲染为“图片待替换”占位块。
- 第一版只覆盖用户向路径：注册、充值、API Key、常用工具、模型计费、日志和排查。

## 更新内容

修改 `web/help-static/scripts/build-content.mjs` 中的 `defaultSources` 后重新运行：

```powershell
node "web/help-static/scripts/build-content.mjs"
```
