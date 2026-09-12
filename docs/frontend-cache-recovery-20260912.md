# 前端自动更新与入口缓存修复（2026-09-12）

已通过 hardy-app 受限部署入口发布 `hardy-image-cache-20260912-1940`，代码提交 `dcbe3e36`。发布前确认绘图队列没有运行或排队任务；上线后健康正常、重启数 0。

## 行为

- `/`、带查询参数的入口、`/index.html`、SPA 页面均返回 `no-store, no-cache, must-revalidate, max-age=0`。不再按 RequestURI 只特殊处理裸 `/`。
- `/api/status` 与 `/api/frontend-version` 禁止浏览器/CDN 缓存。
- `/static/` 下带内容哈希的资源使用一年 immutable 缓存；未带哈希的文件不长期缓存。
- 前端版本由实际嵌入的入口内容计算 SHA-256，其中包含构建后的哈希资源地址。服务端把版本写入 HTML meta；新客户端对比专用版本接口，不再依赖每次手工修改后端版本号。
- 页面每 60 秒检查版本，窗口重新聚焦、联网、重新可见时也检查；发现变化时携带 `_app_build` 参数重新获取入口，保留原路由、其他查询参数和片段。存储不可用时仍更新，并通过 URL 标记限制循环。
- 旧 JS 分块失效时返回兼容普通脚本和模块脚本的恢复代码。删除了会让普通 script 标签解析失败的 import.meta / export 用法。缺失资源响应不缓存。
- 未清空用户全部 localStorage、登录状态或提示词模板。

## 发布与验收证据

- Linux ARM64 发布文件 SHA-256：`dd7a5952defdef61569fbf7ff29b10915e6d3a45fc955a1534f5aa45aa2a24fa`。
- 新镜像：`sha256:a1196203912c827983a4b7c92a128d33a0c463011b914f1d52f200d22a8ba3c2`。
- 前端内容版本：`e3398c14bc89369c6acfd4612b2d4d3fe9d5d3ba87d8638f394059c791edc733`。
- 隔离 worktree 构建，未包含原目录 overview-dashboard.tsx 的用户未提交修改。
- Go 相关 common/model/controller/relay/openai/middleware/router 回归通过；前端版本同步 5 项测试、typecheck、变更文件 lint、生产构建通过。
- 本地真实 Chrome：旧版本标记触发更新到新 meta；普通 script 加载已删除分块后恢复到新页面；恢复页面无控制台错误。静态脚本 VM 测试同时验证无存储环境下的 URL 保留和循环保护。
- 公网 `/`、`/?cache-check=20260912`、`/index.html`、`/usage-logs/common`、两个版本接口均为 HTTP 200、no-store，Cloudflare 状态 DYNAMIC。新哈希脚本 HTTP 200、immutable，Cloudflare HIT；失效脚本 no-store、BYPASS。
- Chrome 保留同一个发布前标签页：从 `rv.hardy-auto-frontend-refresh-v3-20260911.2k6e8r7p` / `index.0664efc2a8.js` 自行切换到 `rv.hardy-image-cache-20260912-1940.2k6e8r7p` / `index.dbe0f0f876.js`，未手动导航或刷新触发这次转换。
- 自动切换后再普通刷新，仍加载新版；首页正常，日志显示中性错误摘要，绘图页面模型和分组加载完成、状态就绪、生成按钮可用，未发现控制台错误。

本次同时发布图片提示词原样转发及中性失败摘要。没有发起收费生成，不能以缓存验收证明此前全部生图拒绝已消失，也不能把所有 HTTP 500 归为缓存故障。

完整命令日志和公网响应头保存在工作区 artifacts 下的 cache-release-*.log、cache-production-headers.json。
