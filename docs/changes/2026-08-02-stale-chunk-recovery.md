# 前端旧分包加载故障修复记录

## 背景

2026-08-02，Macroapple 的旧浏览器标签页在应用部署后进入系统设置页面时出现
500 错误。调查确认，旧页面引用的异步 JavaScript 分包已经被新版本替换，而源站
会把不存在的 `/static/` 路径回退为首页 HTML，并以 HTTP 200 返回。Cloudflare
随后按四小时缓存该错误响应，使浏览器无法按 JavaScript 模块加载。

Nanoapple 当时没有出现用户可见故障，但只读对照测试确认其生产版本具有相同旧
行为。是否出现故障取决于用户是否在部署前打开页面，并在部署后继续使用该旧标签页。

## 修复内容

- 不存在的 `/static/` 文件返回 HTTP 404，并设置 `Cache-Control: no-store`。
- 前端识别 `ChunkLoadError` 和动态模块加载失败后自动刷新一次。
- 使用会话存储限制自动刷新频率，60 秒内最多刷新一次，避免刷新循环。
- 增加后端路由测试和前端错误识别、刷新限流测试。

## 提交与部署

- 共享修复提交：`181da5c59b02`。
- Macroapple 同步提交：`4e38b4762f53`。
- Macroapple 生产镜像：`metaapple/macroapple:4e38b4762f53`。
- Nanoapple 生产版本保持 `nanoapple/new-api:919c4757a10a`，未部署或重启。

## 验证结果

- 前端回归测试通过：6 项。
- `bun run typecheck`、Oxlint、格式检查和生产构建通过。
- `go test ./router -count=1` 通过。
- Macroapple 公网缺失静态文件返回 `404 + Cache-Control: no-store`，Cloudflare
  状态为 `BYPASS`。
- 已登录浏览器访问 `/system-settings/site/system-info` 正常，
  `GET /api/option/` 返回 HTTP 200。
- Macroapple 与 Nanoapple 容器均保持健康。

## 流程补救

上述两个修复提交最初直接推送到长期分支，没有经过 Pull Request，且提交信息使用
英文，不符合当前仓库要求。本记录不改写已经部署的 Git 历史，而是如实保留该偏差；
后续通过中文 PR 模板、协作规范和分支保护禁止再次直接推送长期分支。

Nanoapple 同步本修复时必须另行创建中文 PR，并在获得明确部署授权后再更新生产环境。
