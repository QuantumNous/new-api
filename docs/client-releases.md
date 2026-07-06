# Client Releases

客户端安装包管理用于给桌面端提供版本列表、更新检查、`latest.yml` 和安装包下载入口。安装包保存在私有 OSS，客户端只访问 New API；下载时 New API 生成短时签名 URL 后 302 跳转。

## OSS 配置

```env
CLIENT_RELEASE_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
CLIENT_RELEASE_OSS_BUCKET=your-private-bucket
CLIENT_RELEASE_OSS_ACCESS_KEY_ID=xxx
CLIENT_RELEASE_OSS_ACCESS_KEY_SECRET=xxx
CLIENT_RELEASE_OSS_PREFIX=client-releases
CLIENT_RELEASE_OSS_SIGNED_URL_EXPIRES_SECONDS=600
CLIENT_RELEASE_OSS_UPLOAD_URL_EXPIRES_SECONDS=3600
CLIENT_RELEASE_OSS_UPLOAD_TICKET_SECRET=optional-random-secret
CLIENT_RELEASE_OSS_MAX_BYTES=524288000
```

- `CLIENT_RELEASE_OSS_PREFIX` 为空时默认 `client-releases`。
- 直传对象会先写入 `CLIENT_RELEASE_OSS_PREFIX/_tmp/`；保存版本记录时后端再通过 OSS `CopyObject` 转入正式目录。
- `CLIENT_RELEASE_OSS_SIGNED_URL_EXPIRES_SECONDS` 为空时默认 `600` 秒，最大不超过 `86400` 秒。
- `CLIENT_RELEASE_OSS_UPLOAD_URL_EXPIRES_SECONDS` 为空时默认 `3600` 秒，最大不超过 `86400` 秒；这是后台直传 OSS 的 PUT signed URL 与上传票据有效期。
- `CLIENT_RELEASE_OSS_UPLOAD_TICKET_SECRET` 可选；为空时使用 OSS AccessKeySecret 对上传票据签名。
- `CLIENT_RELEASE_OSS_MAX_BYTES` 为空时默认 `500MB`。
- 生产环境建议配置系统 `ServerAddress` 为 HTTPS 外部地址，避免公开接口根据代理 Header 推导出错误的下载 URL。

## 上传与发布

- 管理后台使用 OSS 直传：先调用 New API 初始化上传，拿到短时 PUT signed URL 后由浏览器直接上传到 `CLIENT_RELEASE_OSS_PREFIX/_tmp/`，再调用 New API 完成确认。
- 初始化接口会先校验 `version / platform / arch / channel`、文件扩展名和文件大小，非法目标不会生成 signed URL。
- 文件名由后端强制生成：`Z-UP-Setup-{version}-{platform}-{arch}-{channel}.{ext}`，前端不允许编辑上传名。
- 支持扩展名：`exe`、`msi`、`dmg`、`pkg`、`zip`、`AppImage`、`deb`、`rpm`、`yml`、`yaml`。
- 上传完成确认时，后端会从 OSS 校验对象大小并重新计算 `sha256` 和 `sha512`；已发布版本必须带 `sha512`，否则 `electron-updater` 不能校验 `latest.yml`。
- 初始化、PUT 和完成确认不会写数据库；只有保存客户端版本记录后，后端才会把 `_tmp/` 对象复制到正式目录并写入数据库。
- 如果上传后没有保存，前端会在替换上传、切换记录、新建草稿或离开页面时 best-effort 调用 `POST /api/admin/client-releases/direct-upload/discard` 删除刚上传的 OSS 对象。
- 如果编辑已有版本并上传新的安装包，保存成功后后端会 best-effort 删除 `_tmp/` 对象和被替换的旧安装包 OSS 对象。
- 删除客户端版本记录成功后，后端会 best-effort 删除关联的安装包 OSS 对象。
- 浏览器崩溃、断网或直接关闭标签页时，前端无法保证一定发出 discard。生产环境应给 `CLIENT_RELEASE_OSS_PREFIX/_tmp/` 配置 OSS 生命周期规则，例如最后修改时间 3 天后删除；正式对象不在 `_tmp/` 下，不会被该规则清理。
- OSS Bucket 需要配置 CORS，允许管理后台域名执行 `PUT` 和 `OPTIONS`，允许 `Content-Type` 请求头，并暴露 `ETag`。

## 版本选择

- 后台列表按 `id DESC` 返回。
- 公开列表、`latest` 和 `latest.yml` 只读取已发布版本。
- 同一 `platform / arch / channel` 范围内，`latest` 和 `latest.yml` 按 `id` 最大的已发布记录作为最新记录。
- 客户端仍会比较 `latest.version` 和自己的当前版本；如果误发布了版本号更低但 `id` 更大的记录，客户端不会把它当作升级版本。

## 桌面端更新流程

- 客户端先请求 `GET /api/client-releases/latest` 判断是否有新版本、是否强制更新，以及弹窗展示的版本信息。
- 用户点击“下载更新”后，客户端不会打开浏览器外链，而是交给 `electron-updater` 读取 `latest.yml` 并下载安装包。
- 下载过程中客户端显示进度；下载完成后按钮切换为“更新并重启程序”。
- 用户点击“更新并重启程序”后，客户端隐藏旧窗口并调用安装器静默安装；安装完成后自动启动新版本。
- 强制更新不会提供“稍后”，但仍然按“下载更新 -> 更新并重启程序”的两段式流程执行，用户也可以直接退出程序。

## 安全边界

- 管理接口都挂在 `/api/admin/client-releases` 下，并要求 `AdminAuth`；公开接口只提供已发布版本的读取、`latest.yml` 和下载跳转。
- OSS Bucket 应保持私有。客户端只访问 New API，New API 再为已发布版本生成短时 signed URL；不要把 OSS Bucket 改成公开读。
- 直传初始化会限制文件大小，默认最大 `500MB`；文件扩展名、`version / platform / arch / channel` 会在生成 signed URL 前校验。
- signed URL 只允许上传到后端生成的单个 `_tmp/` OSS Object，前端不会拿到 OSS AccessKey；完成确认必须携带后端签发的短时上传票据。
- 上传后的文件名由后端强制生成：`Z-UP-Setup-{version}-{platform}-{arch}-{channel}.{ext}`，避免用户可控文件名进入下载路径。
- 公开响应不会返回 `objectKey / status / published` 等后台字段；公开下载会再次检查版本状态，草稿版本不会签名下载。
- 发布版本必须带 `sha512`，否则 `latest.yml` 不可用；客户端安装阶段由 `electron-updater` 按 `sha512` 校验安装包。
- 生产环境建议配置系统 `ServerAddress` 为固定 HTTPS 外部地址，避免根据 `X-Forwarded-*` Header 推导出错误或被污染的 `downloadUrl`。
- OSS AccessKey 只放服务端环境变量，不写入前端配置、打包产物或 Apifox 示例环境。

## 并发行为

- 同一 `version / platform / arch / channel` 由数据库唯一索引兜底；前端的“同版本覆盖”确认只是交互提示，最终仍以后端唯一约束为准。
- 两个管理员同时创建同一目标版本时，只会有一个写入成功；另一个请求会收到唯一索引冲突，需要刷新列表后决定是否覆盖。
- 上传到 OSS 的临时 object key 带随机 ID，避免并发上传同名文件时直接覆盖 OSS 对象。
- 保存版本记录时，后端在写数据库前把 `_tmp/` 对象复制到带时间戳的正式 object key；数据库保存失败会 best-effort 删除刚复制出的正式对象。
- 更新已有版本时，后端会在数据库事务中锁定当前记录并读取真正被本次更新覆盖的旧 object key，再执行旧对象清理，降低并发保存留下正式目录孤儿对象的风险。
- 初始化上传和完成确认没有写数据库；管理员仍需保存版本记录才会创建或更新发布元数据。
- 发布、取消发布和更新记录没有额外应用层锁；同一条记录的并发编辑采用数据库最后一次写入生效。运营上应避免多人同时编辑同一版本。
- `latest` 和 `latest.yml` 总是读取同一目标下 `id` 最大的已发布记录；如果下载过程中又发布了新记录，已开始的下载仍按当次 `latest.yml` 中的 `id` 获取安装包。
- 客户端更新检查本身做进程内去重；同一客户端同时触发自动检查和手动检查时，会复用同一次后端请求结果。

## 管理端双前端同步

- 客户端管理页同时存在 default 和 classic 两套实现：`web/default/src/features/client-releases` 与 `web/classic/src/pages/ClientReleases`。
- 修改字段、校验、按钮文案、列表标签、上传逻辑或接口 payload 时，必须同时检查两套实现。
- 例如强制更新标签应两边一致：有 `minVersion` 时显示 `≥x.x.x`，没有最低版本时才兜底显示“强更”或本地化的 Forced 文案。

## 接口入口

```txt
GET  /api/client-releases
GET  /api/client-releases/latest
GET  /api/client-releases/download/{id}
GET  /api/client-releases/updates/{platform}/{arch}/{channel}/latest.yml
GET  /api/client-releases/updates/{platform}/{arch}/{channel}/download/{id}/{filename}

GET    /api/admin/client-releases
POST   /api/admin/client-releases/direct-upload/init
POST   /api/admin/client-releases/direct-upload/complete
POST   /api/admin/client-releases/direct-upload/discard
POST   /api/admin/client-releases
PUT    /api/admin/client-releases/{id}
POST   /api/admin/client-releases/{id}/publish
POST   /api/admin/client-releases/{id}/unpublish
DELETE /api/admin/client-releases/{id}
```
