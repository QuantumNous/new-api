# Skill Hub 配置说明

Skill Hub 用于向本地 connector 返回可安装的 Skill 列表。当前支持通过 HTTPS Zip 包安装，并支持在管理后台上传 Skill 图标到 OSS 后展示给 connector 用户。

## OSS 存储策略

Skill 包和 Skill 图标的访问方式不同：

| 资源         | 建议 Bucket 权限 | 访问方式                                             |
| ------------ | ---------------- | ---------------------------------------------------- |
| Skill Zip 包 | 私有读写         | New API 生成短期 signed URL 后跳转下载               |
| Skill 图标   | 公共读           | 管理后台上传后保存稳定 HTTPS URL，connector 直接展示 |

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

## 管理后台结构

管理后台入口显示为 `技能广场管理`，下挂两个页面：

| 页面     | 默认前端路由      | Classic 路由              | 用途                                                       |
| -------- | ----------------- | ------------------------- | ---------------------------------------------------------- |
| 技能管理 | `/skill-hub`      | `/console/skill-hub`      | 维护 connector 可安装的 Skill 列表、Zip 包、图标和发布状态 |
| 标签管理 | `/skill-hub/tags` | `/console/skill-hub/tags` | 维护全局标签库，供技能管理页选择                           |

后台只保留当前界面需要的数据，不再维护旧的推荐位。公开接口仍只返回已发布 Skill，connector 按公开列表展示。

## 技能管理使用流程

1. 在管理后台打开 `技能广场管理` -> `技能管理`。
2. 新建或编辑 Skill，先填写 Skill ID。
3. 上传 Skill Zip 包，系统会写入 `source.type=zip` 和下载 URL。
4. 点击图标区域的上传按钮，选择 `png`、`jpg`、`jpeg` 或 `webp` 图片。
5. 上传成功后，系统自动回填图标 URL。
6. 从已有标签里选择 Skill 标签。
7. 保存 Skill，确认无误后发布。

connector 会通过公开 Skill Hub 接口拿到 `icon` 字段，并在 Skill 列表和已安装列表中展示图标。没有图标时，connector 会回退显示首字母。

## 标签管理规则

标签是独立资源，不建议在技能编辑表单里临时新建：

- 新建标签：在 `标签管理` 页填写名称后保存。
- 搜索标签：标签列表支持按名称搜索。
- 删除标签：未被任何 Skill 使用的标签可以删除；已被使用的标签会显示使用数量并禁止删除。
- 自动同步：读取标签列表时，会把历史 Skill 中已有的标签同步到标签库，避免旧数据丢失。
- 技能表单：只允许从标签库候选项中选择标签，减少同名、错别字和临时标签。

标签字段限制：

| 字段   | 限制                                                        |
| ------ | ----------------------------------------------------------- |
| `name` | 必填，最多 32 个字符，不能包含 `/` 或 `\`，同名标签不可重复 |
| `sort` | 可选，数值越大排序越靠前                                    |

## 本地开发与 mock

默认前端通过 `VITE_REACT_APP_SERVER_URL` 指定 API 代理目标。连接本地 new-api 服务时，可以这样启动：

```powershell
cd web/default
$env:VITE_REACT_APP_SERVER_URL = 'http://192.168.1.8:3000/'
npm run dev -- --port 3001 --host 0.0.0.0
```

默认前端 dev server 已启用 history fallback，直接打开 `/skill-hub` 或 `/skill-hub/tags` 也会返回前端入口页。

connector 本地 mock 只需要实现公开接口的数据形状。最小列表响应示例：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "demo-skill",
        "name": "Demo Skill",
        "description": "用于本地联调的示例 Skill。",
        "version": "1.0.0",
        "icon": "https://example.com/skill-hub/icons/demo.png",
        "tags": ["开发工具"],
        "verified": true,
        "source": {
          "type": "zip",
          "url": "https://example.com/demo-skill.zip"
        }
      }
    ],
    "total": 1
  }
}
```

标签列表响应示例：

```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": 1,
        "name": "开发工具",
        "sort": 0,
        "usageCount": 3
      }
    ],
    "total": 1
  }
}
```

按标签查询技能时传标签 ID，多个标签用英文逗号分隔；不传 `tag_ids` 时返回全部技能：

```http
GET /api/skill-hub/tags/skills?tag_ids=1,2&p=1&page_size=20
```

如果要测试安装下载流程，`GET /api/skill-hub/skills/:id/download` 可以 mock 为 `302` 跳转到可下载的 Zip 包地址。

## 相关接口

| 接口                                             | 权限   | 用途                                                         |
| ------------------------------------------------ | ------ | ------------------------------------------------------------ |
| `POST /api/admin/skill-hub/upload`               | 管理员 | 上传 Skill Zip 包到 OSS                                      |
| `POST /api/admin/skill-hub/upload-icon`          | 管理员 | 上传 Skill 图标到 OSS                                        |
| `GET /api/admin/skill-hub/skills`                | 管理员 | 分页搜索后台 Skill 列表，支持 `keyword`、`page`、`page_size` |
| `POST /api/admin/skill-hub/skills`               | 管理员 | 新建 Skill                                                   |
| `GET /api/admin/skill-hub/skills/:id`            | 管理员 | 获取后台 Skill 详情                                          |
| `PUT /api/admin/skill-hub/skills/:id`            | 管理员 | 更新 Skill                                                   |
| `DELETE /api/admin/skill-hub/skills/:id`         | 管理员 | 删除 Skill                                                   |
| `POST /api/admin/skill-hub/skills/:id/publish`   | 管理员 | 发布 Skill                                                   |
| `POST /api/admin/skill-hub/skills/:id/unpublish` | 管理员 | 下架 Skill                                                   |
| `GET /api/admin/skill-hub/tags`                  | 管理员 | 分页搜索标签库，支持 `keyword`、`page`、`page_size`          |
| `GET /api/admin/skill-hub/tags/skills`           | 管理员 | 按 `tag_ids` 查询后台 Skill；不传标签时返回全部              |
| `POST /api/admin/skill-hub/tags`                 | 管理员 | 新建标签                                                     |
| `DELETE /api/admin/skill-hub/tags/:name`         | 管理员 | 删除未被 Skill 使用的标签                                    |
| `GET /api/skill-hub/skills`                      | 公开   | connector 拉取已发布 Skill 列表                              |
| `GET /api/skill-hub/tags`                        | 公开   | connector 拉取已发布 Skill 使用中的标签列表                  |
| `GET /api/skill-hub/tags/skills`                 | 公开   | 按 `tag_ids` 查询已发布 Skill；不传标签时返回全部            |
| `GET /api/skill-hub/skills/:id`                  | 公开   | connector 拉取 Skill 详情                                    |
| `GET /api/skill-hub/skills/:id/download`         | 公开   | 跳转到 Zip 包短期 signed URL                                 |

## 管理接口 payload 示例

新建或更新 Skill：

```json
{
  "id": "demo-skill",
  "name": "Demo Skill",
  "description": "用于演示的 Skill。",
  "version": "1.0.0",
  "icon": "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/skill-hub/icons/demo.png",
  "tags": ["开发工具", "自动化"],
  "verified": true,
  "published": false,
  "sort": 0,
  "source": {
    "type": "zip",
    "url": "https://example.com/demo-skill.zip",
    "ref": "skill-hub/skills/demo-skill-1.0.0.zip",
    "checksum": ""
  }
}
```

新建标签：

```json
{
  "name": "开发工具",
  "sort": 100
}
```
