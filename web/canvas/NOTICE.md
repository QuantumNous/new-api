# NOTICE

本目录代码 vendored 自开源项目 [infinite-canvas](https://github.com/basketikun/infinite-canvas)(AGPL-3.0)。

- 来源仓库:`github.com/basketikun/infinite-canvas`
- 基线 commit:`bd0ad0aebf613a5e4cfb44491017a9915e390808`(2026-06-23)
- vendor 范围:上游仓库 `web/` 子目录(排除 `node_modules/`、`.next/`),另从上游仓库根目录拷入 `LICENSE`、`VERSION`、`CHANGELOG.md`
- 授权:AGPL-3.0,保留上游 LICENSE 与作者署名(见 `LICENSE`)

## 本地修改清单

所有内置模式相关改动均以 `BUILTIN_MODE` 常量收敛,可用 `BUILTIN_MODE` 关键字 grep 定位。静态导出必要改造如下:

1. `next.config.ts`:`output: "standalone"` → `output: "export"`,新增 `basePath: "/canvas-app"`、`trailingSlash: true`;`../VERSION`、`../CHANGELOG.md` 读取路径改为 `./VERSION`、`./CHANGELOG.md`;`env` 追加 `NEXT_PUBLIC_BUILTIN_MODE`。
2. 删除 `src/app/api/prompts/route.ts`(GitHub 提示词抓取代理,逻辑移植到 new-api Go 端 `/api/prompts`)。
3. 删除 `src/app/webdav-proxy/route.ts`(内置模式不提供 WebDAV 同步/代理)。
4. 动态路由 `src/app/(user)/canvas/[id]/` 改为静态页 `src/app/(user)/canvas/editor/?id=<projectId>`(静态导出不支持无 generateStaticParams 的动态段)。
5. 内置模式(`NEXT_PUBLIC_BUILTIN_MODE=1`):锁定站内渠道(baseUrl=/pg)、禁用外部渠道/BYO API key、`New-Api-User` 请求头注入、401 跳转登录、隐藏 WebDAV/版本检查、模型按 `supported_endpoint_types` 分类、画布项目服务端持久化(`/api/canvas/projects`)。
6. 内置模式素材库服务端化:`uploadImage`/`uploadMediaFile` 优先上传 new-api 素材库(OBS,`/api/canvas/assets/upload`),storageKey 采用 `ca:<asset_id>` 前缀,本地 IndexedDB 仅作缓存;`resolveImageUrl`/`resolveMediaUrl` 本地 miss 时经短期签名 URL 恢复(跨设备可用);素材库删除同步释放服务端对象与配额;「我的素材」页新增云端容量条(`canvas-storage-bar.tsx`)。

(随实施过程持续补充)
