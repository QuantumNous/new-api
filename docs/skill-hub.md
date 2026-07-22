# Skill Hub 配置说明

Skill Hub 用于向本地 connector 返回可安装的 Skill 列表。当前支持通过 HTTPS Zip 包安装，并支持在管理后台上传 Skill 图标到 OSS 后展示给 connector 用户。

## 用户收藏

登录用户可以收藏技能，收藏关系保存在服务端 `skill_hub_favorites` 表中，并通过用户 ID 与技能内部 ID 的唯一组合约束避免重复记录。收藏和本地安装状态互相独立，因此用户可以收藏尚未安装或已经安装的技能，并在使用同一账号的不同客户端上恢复收藏列表。

收藏列表只返回当前仍存在且处于已发布状态的技能。技能下架时收藏关系保留但不展示，重新发布后恢复展示；技能被删除时会在同一数据库事务中清理对应收藏关系。收藏关系使用技能内部 ID，删除后重新创建同名技能不会继承旧收藏。

收藏、取消收藏接口是幂等的。普通技能列表、推荐列表和详情接口在存在登录会话时会返回 `favorited: true`；匿名请求保持原有公开响应语义。

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
SKILL_HUB_OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
SKILL_HUB_OSS_BUCKET=your-private-bucket
SKILL_HUB_OSS_ACCESS_KEY_ID=xxx
SKILL_HUB_OSS_ACCESS_KEY_SECRET=xxx
SKILL_HUB_OSS_PREFIX=skill-hub/skills
SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS=600
SKILL_HUB_OSS_UPLOAD_URL_EXPIRES_SECONDS=3600
SKILL_HUB_OSS_UPLOAD_TICKET_SECRET=optional-random-secret
```

本地或局域网调试时，如果后台上传后自动回填的 Zip 包地址是
`http://192.168.1.8:3000/api/skill-hub/skills/.../download` 这类私有网段
HTTP 地址，可以设置：

```env
SKILL_HUB_ALLOW_LOCAL_HTTP=true
```

该开关仅用于开发调试，并且只允许 `localhost`、回环地址、私有网段地址和本地链路
地址使用 HTTP；公网 HTTP Zip 包地址仍会被拒绝。生产环境仍建议配置 HTTPS
外部访问地址。

说明：

- `SKILL_HUB_OSS_PREFIX` 为空时默认使用 `skill-hub/skills`。
- Zip 直传对象会先写入 `SKILL_HUB_OSS_PREFIX/_tmp/`；保存 Skill 时后端再通过 OSS `CopyObject` 转入正式 Zip 目录。
- `SKILL_HUB_OSS_SIGNED_URL_EXPIRES_SECONDS` 为空时默认 `600` 秒，最大不超过 `86400` 秒。
- `SKILL_HUB_OSS_UPLOAD_URL_EXPIRES_SECONDS` 为空时默认 `3600` 秒，最大不超过 `86400` 秒；这是后台直传 OSS 的 PUT signed URL 与上传票据有效期。
- `SKILL_HUB_OSS_UPLOAD_TICKET_SECRET` 可选；为空时使用 OSS AccessKeySecret 对上传票据签名。
- Zip 包直传初始化只接受 `.zip` 文件；完成确认时会从 OSS 读取对象并校验 Zip 文件头。
- 保存直传 Zip 时，服务端只读取根目录或唯一一级目录下的 `SKILL.md`，不解压文件到磁盘。Zip 最大 50 MB，`SKILL.md` 最大 256000 字节且必须是非空 UTF-8 普通文件；绝对路径、反斜杠、盘符、`.`、`..`、符号链接、多份候选文件和更深层候选文件均会被拒绝。

## 图标 OSS 配置

图标必须通过管理后台上传，不能手工填写任意 URL。上传成功后，系统会把 OSS 公开 URL 写入 Skill 的 `icon` 字段。

你当前的公共读 Bucket 可以这样配置：

```env
SKILL_HUB_OSS_ICON_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
SKILL_HUB_OSS_ICON_BUCKET=z-up-api-public
SKILL_HUB_OSS_ICON_PREFIX=skill-hub/icons
SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL=https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com
```

如果图标 Bucket 和 Zip Bucket 可以共用同一组 AccessKey，可以不用配置图标专用 AK，系统会回退使用 `SKILL_HUB_OSS_ACCESS_KEY_ID` 和 `SKILL_HUB_OSS_ACCESS_KEY_SECRET`。

图标直传对象会先写入 `SKILL_HUB_OSS_ICON_PREFIX/_tmp/`；保存 Skill 时后端再复制到正式图标目录，并把正式公开 URL 写入数据库。

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

- 图标只能通过 `POST /api/admin/skill-hub/direct-upload/init`、OSS `PUT`、`POST /api/admin/skill-hub/direct-upload/complete` 这一组直传流程上传。
- 文件大小限制为 `1 MB`。
- 只允许 `png`、`jpg`、`jpeg`、`webp`。
- 完成确认时会从 OSS 读取对象并校验文件魔数，不只依赖扩展名或浏览器 MIME。
- `icon` 非空时必须是 `SKILL_HUB_OSS_ICON_PUBLIC_BASE_URL` 下的 HTTPS URL。
- `icon` 路径必须位于 `SKILL_HUB_OSS_ICON_PREFIX` 目录下。
- `icon` URL 禁止 query、fragment、userinfo。
- `icon` URL 后缀必须是 `.png`、`.jpg`、`.jpeg` 或 `.webp`。

这些限制用于避免管理员或外部请求绕过前端写入任意外链、HTTP URL、签名 URL 或非图片资源。

## 直传和 OSS 清理

- 管理后台上传 Zip 包或图标时，先调用 New API 初始化直传，浏览器再用返回的短期 PUT signed URL 直接上传到对应 OSS 前缀的 `_tmp/` 目录，最后调用完成确认接口回填 URL、OSS object 和 checksum。
- 初始化、PUT 和完成确认不会写数据库；只有保存 Skill 后，后端才会把 `_tmp/` 对象复制到正式目录并写入数据库。
- 如果上传后没有保存，前端会在替换上传、切换记录、新建草稿或离开页面时 best-effort 调用 `POST /api/admin/skill-hub/direct-upload/discard` 删除刚上传的 OSS 对象。
- 如果编辑已有 Skill 并上传了新的 Zip 包或图标，保存成功后后端会 best-effort 删除 `_tmp/` 对象和被替换的旧 OSS 对象。
- 删除 Skill 成功后，后端会 best-effort 删除关联的 Zip 包和图标 OSS 对象。
- 浏览器崩溃、断网或直接关闭标签页时，前端无法保证一定发出 discard。生产环境应给 `SKILL_HUB_OSS_PREFIX/_tmp/` 和 `SKILL_HUB_OSS_ICON_PREFIX/_tmp/` 配置 OSS 生命周期规则，例如最后修改时间 3 天后删除；正式对象不在 `_tmp/` 下，不会被该规则清理。

OSS Bucket 需要允许管理后台域名执行 `PUT` 和 `OPTIONS`，允许 `Content-Type` 请求头，并建议暴露 `ETag`。Zip Bucket 仍保持私有读写；图标 Bucket 可公共读，但写入仍通过服务端签发的短期 PUT signed URL。

## 管理后台结构

管理后台入口显示为 `技能广场管理`，下挂两个页面：

| 页面     | 默认前端路由      | Classic 路由              | 用途                                                       |
| -------- | ----------------- | ------------------------- | ---------------------------------------------------------- |
| 技能管理 | `/skill-hub`      | `/console/skill-hub`      | 维护 connector 可安装的 Skill 列表、Zip 包、图标和发布状态 |
| 标签管理 | `/skill-hub/tags` | `/console/skill-hub/tags` | 维护全局标签库，供技能管理页选择                           |

后台只保留当前界面需要的数据，不再维护旧的推荐位。公开接口仍只返回已发布 Skill，connector 按公开列表展示。

## 技能管理使用流程

1. 在管理后台打开 `技能广场管理` -> `技能管理`。
2. 新建或编辑 Skill，先填写 Skill ID；可填写来源（例如 `Clawhub`）、源项目地址和许可证。
3. 上传 Skill Zip 包，系统会写入 `source.type=zip` 和下载 URL。
4. 点击图标区域的上传按钮，选择 `png`、`jpg`、`jpeg` 或 `webp` 图片。
5. 上传成功后，系统自动回填图标 URL。
6. 从已有标签里选择 Skill 标签。
7. 可选填写固定五维评测，或上传效果预览案例 JSON。
8. 保存 Skill，确认无误后发布；保存直传 Zip 后可在后台预览提取出的 `SKILL.md`。

## 详情、评测与案例

技能列表接口只返回摘要字段，不加载较大的 `SKILL.md`、评测和案例数据。公开与管理详情接口会额外返回：

- `skillMarkdown`：从 Zip 安全读取的 `SKILL.md` 原文。
- `evaluation`：可选评测报告。五个固定维度为 `trust`、`reliability`、`adaptability`、`convention`、`effectiveness`，每个维度必须提供 `0` 到 `5` 的分数，评价可为空。
- `evaluation.overallScore`：可选综合评分；为空时客户端取五维平均值。
- `evaluation.overallRating` 与 `evaluation.overallReview`：可选综合评级和综合评价；评级为空时客户端按综合评分生成展示文案。
- `testcases`：可选效果预览案例。整个 JSON 最大 2 MB，最多 50 个案例；`slug` 只要求是字符串，不要求与 Skill ID 一致。
- `reportingEnabled`：是否已配置举报接收邮箱。

案例文件结构如下，桌面端按 `sortOrder` 稳定排序并切换展示：

```json
{
  "slug": "any-string",
  "testcases": [
    {
      "id": 8,
      "question": "用户问题",
      "answer": "# Markdown 回答",
      "sortOrder": 0
    }
  ]
}
```

客户端用 Markdown 渲染 `skillMarkdown` 和案例回答，但不启用原始 HTML，并限制链接和图片协议，防止脚本或本地文件 URL 被执行或打开。

## 举报通知

管理员在系统设置的 SMTP 区域配置 `SkillHubReportEmail`（Skill 举报接收邮箱）后，技能详情会开放举报入口。举报接口要求登录，并按用户限制为每小时 5 次；描述必填，最多 1000 个字符。

客户端为每次举报生成 `requestId`，网络失败重试时复用同一个值。数据库以 `user_id + request_id` 唯一约束去重，邮件发送用条件更新抢占通知权，确保并发请求最多只有一个发送者。已通知的重复请求直接返回原记录；SMTP 失败会保留记录并允许同请求重试。

举报邮件不会包含用户填写的正文、用户名、用户邮箱或用户提供的链接，只发送举报编号、Skill 元数据、数字用户 ID、提交时间，以及根据系统 `ServerAddress` 生成的固定 `/skill-hub/reports?report=:id` 后台入口。管理员必须登录后台后才能读取举报正文，避免攻击者利用受信任的系统发件人向管理员投递钓鱼内容。

管理员举报管理页支持按状态和关键词分页查询、查看纯文本正文、填写处理备注，以及标记为 `pending`、`resolved` 或 `dismissed`。正文不渲染 HTML、Markdown 或自动链接。处理接口要求提交当前 `revision`，数据库以 `id + revision` 条件更新；两个管理员同时处理时只有一个请求成功，另一个请求必须刷新最新记录后重试。

技能列表优先按 `sort` 字段升序展示，排序值越小越靠前（包括 `sort=0`）；`sort`
相同时再按更新时间倒序排列，更新时间仍相同时按内部 ID 倒序兜底。

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
| `name` | 必填，最多 40 个字符，不能包含 `/` 或 `\`，同名标签不可重复 |
| `sort` | 可选，数值越大排序越靠前                                    |

## 查询与过滤规则

Skill Hub 列表接口统一使用 `GET` query 参数，不需要请求体。

分页参数：

| 参数        | 说明                                   |
| ----------- | -------------------------------------- |
| `p`         | 页码，从 `1` 开始；为空时默认第 1 页   |
| `page_size` | 每页数量；为空时使用系统默认，最大 100 |

关键字参数：

| 参数      | 说明                                                                                  |
| --------- | ------------------------------------------------------------------------------------- |
| `keyword` | 可选。技能列表匹配 Skill ID、名称、描述、标签、来源和源地址；标签列表只匹配标签名称。 |

`keyword` 会先去除首尾空白，最大 128 个字符。`%`、`_`、`!` 会被当作普通字符处理，不再作为 SQL `LIKE` 通配符参与匹配。

标签筛选参数：

| 参数      | 说明                                                                       |
| --------- | -------------------------------------------------------------------------- |
| `tag_ids` | 可选。标签 ID，多个 ID 用英文逗号分隔，例如 `1,2`；也兼容重复 query 写法。 |
| `tag_id`  | 可选。兼容单标签 ID 参数。                                                 |
| `ids`     | 可选。兼容多个标签 ID 参数。                                               |

标签筛选是“匹配任一标签”的 OR 语义。`tag_ids` 为空、不传或传空字符串时，不启用标签过滤，返回全部技能。一次最多传 50 个标签 ID；非法 ID 会返回统一错误结构。

公开端和管理端的可见范围不同：

| 接口类型 | 技能列表范围       | 标签列表范围                                                       |
| -------- | ------------------ | ------------------------------------------------------------------ |
| 公开端   | 只返回已发布 Skill | 只返回已发布 Skill 正在使用的标签，`usageCount` 只统计已发布 Skill |
| 管理端   | 返回全部状态 Skill | 返回标签库中的全部标签，`usageCount` 统计全部状态 Skill            |

标签和 Skill 的关联由数据库迁移、后台标签列表兜底同步，以及 Skill 新建/更新/删除流程维护。公开 `GET /api/skill-hub/tags` 只读关联表，不会在请求中扫描 Skill 表并写入标签表。

客户端可以统一调用按标签技能列表接口：

```http
GET /api/skill-hub/tags/skills?tag_ids=1,2&keyword=demo&p=1&page_size=20
```

当没有选中标签时：

```http
GET /api/skill-hub/tags/skills?keyword=demo&p=1&page_size=20
```

等价于拉取全部已发布 Skill 后按 `keyword` 搜索。

## 公开接口对接

### 获取标签列表

```http
GET /api/skill-hub/tags?keyword=开发&p=1&page_size=20
```

响应：

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": 1,
        "name": "开发工具",
        "usageCount": 3
      }
    ],
    "total": 1
  }
}
```

### 按标签获取技能

```http
GET /api/skill-hub/tags/skills?tag_ids=1,2&p=1&page_size=20
```

`tag_ids` 可省略。省略时返回全部已发布 Skill。响应结构与 `GET /api/skill-hub/skills` 一致：

```json
{
  "success": true,
  "message": "",
  "data": {
    "items": [
      {
        "id": "demo-skill",
        "name": "Demo Skill",
        "description": "用于本地联调的示例 Skill。",
        "version": "1.0.0",
        "origin": "Clawhub",
        "originUrl": "https://clawhub.ai/skills/demo-skill",
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
        "origin": "Clawhub",
        "originUrl": "https://clawhub.ai/skills/demo-skill",
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

| 接口                                               | 权限   | 用途                                                              |
| -------------------------------------------------- | ------ | ----------------------------------------------------------------- |
| `POST /api/admin/skill-hub/direct-upload/init`     | 管理员 | 初始化 Skill Zip 包或图标 OSS 直传，返回 PUT signed URL           |
| `POST /api/admin/skill-hub/direct-upload/complete` | 管理员 | 完成直传确认，校验 OSS 对象并返回 URL、object、checksum           |
| `POST /api/admin/skill-hub/direct-upload/discard`  | 管理员 | 丢弃未保存上传，删除对应 OSS 对象                                 |
| `GET /api/admin/skill-hub/reports`                 | 管理员 | 分页查询举报，支持 `keyword`、`status`、`p`、`page_size`          |
| `GET /api/admin/skill-hub/reports/:id`             | 管理员 | 获取举报详情及当前处理版本                                        |
| `PUT /api/admin/skill-hub/reports/:id`             | 管理员 | 使用 `revision` 乐观锁更新处理状态和处理备注                       |
| `GET /api/admin/skill-hub/skills`                  | 管理员 | 分页搜索后台 Skill 列表，支持 `keyword`、`p`、`page_size`         |
| `POST /api/admin/skill-hub/skills`                 | 管理员 | 新建 Skill                                                        |
| `GET /api/admin/skill-hub/skills/:id`              | 管理员 | 获取后台 Skill 详情                                               |
| `PUT /api/admin/skill-hub/skills/:id`              | 管理员 | 更新 Skill，保存成功后清理被替换的旧 OSS 对象                     |
| `DELETE /api/admin/skill-hub/skills/:id`           | 管理员 | 删除 Skill，并 best-effort 删除关联 OSS 对象                      |
| `POST /api/admin/skill-hub/skills/:id/publish`     | 管理员 | 发布 Skill                                                        |
| `POST /api/admin/skill-hub/skills/:id/unpublish`   | 管理员 | 下架 Skill                                                        |
| `GET /api/admin/skill-hub/tags`                    | 管理员 | 分页搜索标签库，支持 `keyword`、`p`、`page_size`                  |
| `GET /api/admin/skill-hub/tags/skills`             | 管理员 | 按 `tag_ids` 查询后台 Skill；不传标签时返回全部，支持 `keyword`   |
| `POST /api/admin/skill-hub/tags`                   | 管理员 | 新建标签                                                          |
| `DELETE /api/admin/skill-hub/tags/:name`           | 管理员 | 删除未被 Skill 使用的标签                                         |
| `GET /api/skill-hub/skills`                        | 公开   | connector 拉取已发布 Skill 列表                                   |
| `GET /api/skill-hub/tags`                          | 公开   | connector 拉取已发布 Skill 使用中的标签列表                       |
| `GET /api/skill-hub/tags/skills`                   | 公开   | 按 `tag_ids` 查询已发布 Skill；不传标签时返回全部，支持 `keyword` |
| `GET /api/skill-hub/skills/:id`                    | 公开   | connector 拉取 Skill 详情                                         |
| `POST /api/skill-hub/skills/:id/reports`           | 用户   | 幂等提交举报并通知配置的管理员邮箱；每用户每小时最多 5 次          |
| `GET /api/skill-hub/skills/:id/download`           | 公开   | 跳转到 Zip 包短期 signed URL                                      |
| `GET /api/skill-hub/favorites`                     | 用户   | 获取当前账号收藏且仍存在、已发布的技能，支持搜索和标签筛选        |
| `PUT /api/skill-hub/favorites/:id`                 | 用户   | 幂等收藏指定技能                                                  |
| `DELETE /api/skill-hub/favorites/:id`              | 用户   | 幂等取消收藏指定技能                                              |

## 管理接口 payload 示例

新建或更新 Skill：

```json
{
  "id": "demo-skill",
  "name": "Demo Skill",
  "description": "用于演示的 Skill。",
  "version": "1.0.0",
  "origin": "Clawhub",
  "originUrl": "https://clawhub.ai/skills/demo-skill",
  "license": "MIT License",
  "icon": "https://z-up-api-public.oss-cn-hangzhou.aliyuncs.com/skill-hub/icons/demo.png",
  "tags": ["开发工具", "自动化"],
  "verified": true,
  "published": false,
  "sort": 0,
  "evaluation": {
    "overallRating": "优秀",
    "overallReview": "综合表现稳定。",
    "dimensions": {
      "trust": { "score": 4.2, "review": "来源和行为边界清晰。" },
      "reliability": { "score": 4.1, "review": "" },
      "adaptability": { "score": 3.9, "review": "" },
      "convention": { "score": 4.0, "review": "" },
      "effectiveness": { "score": 4.3, "review": "" }
    }
  },
  "testcases": {
    "slug": "does-not-need-to-match",
    "testcases": [
      { "id": 8, "question": "用户问题", "answer": "# Markdown 回答", "sortOrder": 0 }
    ]
  },
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
