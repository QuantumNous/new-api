# Skill Hub 配置说明

Skill Hub 用于向本地 connector 返回可安装的 Skill 列表。当前支持通过 HTTPS Zip 包安装，并支持在管理后台上传 Skill 图标到 OSS 后展示给 connector 用户。

## OSS 存储策略

Skill 包和 Skill 图标的访问方式不同：

| 资源 | 建议 Bucket 权限 | 访问方式 |
| --- | --- | --- |
| Skill Zip 包 | 私有读写 | New API 生成短期 signed URL 后跳转下载 |
| Skill 图标 | 公共读 | 管理后台上传后保存稳定 HTTPS URL，connector 直接展示 |

图标 URL 需要长期稳定，不能使用短期 signed URL，否则 connector 页面刷新或缓存后图片可能失效。

## Zip 包 OSS 配置

Zip 包沿用 Skill Hub 原有 OSS 配置：

```env
SKILL_HUB_OSS_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
SKILL_HUB_OSS_BUCKET=your-private-bucket
SKILL_HUB_OSS_ACCESS_KEY_ID=xxx
SKILL_HUB_OSS_ACCESS_KEY_SECRET=xxx
SKILL_HUB_OSS_PREFIX=skill-hub/skills
SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS=600
```

说明：

- `SKILL_HUB_OSS_PREFIX` 为空时默认使用 `skill-hub/skills`。
- `SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS` 为空时默认 `600` 秒，最大不超过 `86400` 秒。
- Zip 包上传接口只接受 `.zip` 文件，并校验 Zip 文件头。

## 图标 OSS 配置

图标必须通过管理后台上传，不能手工填写任意 URL。上传成功后，系统会把 OSS 公开 URL 写入 Skill 的 `icon` 字段。

你当前的公共读 Bucket 可以这样配置：

```env
SKILL_HUB_OSS_ICON_ENDPOINT=oss-cn-hangzhou.aliyuncs.com
SKILL_HUB_OSS_ICON_BUCKET=z-up-api-public
SKILL_HUB_OSS_ICON_PREFIX=skill-hub/icons
SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL=https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com
```

如果图标 Bucket 和 Zip Bucket 可以共用同一组 AccessKey，可以不用配置图标专用 AK，系统会回退使用 `SKILL_HUB_OSS_ACCESS_KEY_ID` 和 `SKILL_HUB_OSS_ACCESS_KEY_SECRET`。

如果要给图标 Bucket 单独授权，增加：

```env
SKILL_HUB_OSS_ICON_ACCESS_KEY_ID=xxx
SKILL_HUB_OSS_ICON_ACCESS_KEY_SECRET=xxx
```

建议 RAM 权限只允许访问图标目录：

```text
acs:oss:*:*:z-up-api-public/skill-hub/icons/*
```

建议允许的动作：

```text
oss:PutObject
oss:GetObject
oss:DeleteObject
```

## 图标安全限制

后端会同时校验上传内容和保存后的 URL：

- 图标只能通过 `POST /api/admin/skill-hub/upload-icon` 上传。
- 文件大小限制为 `1 MB`。
- 只允许 `png`、`jpg`、`jpeg`、`webp`。
- 上传时会校验文件魔数，不只依赖扩展名或浏览器 MIME。
- `icon` 非空时必须是 `SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL` 下的 HTTPS URL。
- `icon` 路径必须位于 `SKILL_HUB_OSS_ICON_PREFIX` 目录下。
- `icon` URL 禁止 query、fragment、userinfo。
- `icon` URL 后缀必须是 `.png`、`.jpg`、`.jpeg` 或 `.webp`。

这些限制用于避免管理员或外部请求绕过前端写入任意外链、HTTP URL、签名 URL 或非图片资源。

## 管理后台使用流程

1. 在管理后台打开 Skill Hub。
2. 新建或编辑 Skill，先填写 Skill ID。
3. 点击图标区域的上传按钮，选择 `png`、`jpg`、`jpeg` 或 `webp` 图片。
4. 上传成功后，系统自动回填图标 URL。
5. 保存 Skill。

connector 会通过公开 Skill Hub 接口拿到 `icon` 字段，并在 Skill 列表和已安装列表中展示图标。没有图标时，connector 会回退显示首字母。

## 相关接口

| 接口 | 权限 | 用途 |
| --- | --- | --- |
| `POST /api/admin/skill-hub/upload` | 管理员 | 上传 Skill Zip 包到 OSS |
| `POST /api/admin/skill-hub/upload-icon` | 管理员 | 上传 Skill 图标到 OSS |
| `GET /api/skill-hub/skills` | 公开 | connector 拉取已发布 Skill 列表 |
| `GET /api/skill-hub/skills/:id` | 公开 | connector 拉取 Skill 详情 |
| `GET /api/skill-hub/skills/:id/download` | 公开 | 跳转到 Zip 包短期 signed URL |
