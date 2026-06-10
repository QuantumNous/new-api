# 用户工单（Ticket）设计文档

> **命名**：用户侧菜单/卡片 =「**我的工单**」；管理后台页 =「**工单管理**」。功能内核仍是"用户发帖 + 管理员回复"的轻量工单（原名"建议及咨询/反馈管理"，已按需求改名）。文件名保留 `feedback-consult-design.md`。

> 版本：v0.4（草案，待评审）
> 适用项目：new-api
> 模式：**用户发帖 + 管理员回复**（轻量工单 / 站内对话）
> 日期：2026-06-09
>
> **设计基线**：在结构、路由分层、图片处理、权限、生命周期、审计等维度上**复用 KYC / 企业认证已落地的范式**（见 `docs/kyc-design.md`、`docs/enterprise-cert-design.md`）。本文档只描述本功能的**专有设计**与与既有模式的**差异点**，凡未特别说明处，约定与跨库兼容策略与二者一致。
>
> **v0.2 修订**（对 v0.1 评审问题的收口）：①图片改为**按主键 id 寻址**，详情响应每条消息返回 `image_ids` 列表（弃用 `has_images` 布尔）；②未读聚合**排除已关闭主题**，且**关闭时清对方未读位**；③定死状态机转移（用户回复不打掉管理员的「处理中」标记）；④`admin_unread` 为**全局共享位**，显式标注为已知局限；⑤纯图片消息允许空正文；⑥重开/连续回复加节流；⑦加消息与主题计数更新**强制同事务**；⑧消息详情**分页**；⑨后端**枚举入参校验**；⑩对话气泡采用**微信式「视角相对」对齐**（自己靠右、对方靠左，用户端与管理员端左右相反，由前端按 `author_role` 推导）。详见各节标注。
>
> **v0.3 修订**：⑪管理员回复**可区分具体管理员**——消息已存发言者 `UserId`，详情接口补返 `author_id` + `author_name`，气泡显示是哪位管理员（§二、§四、§六）；⑫管理员列表**按用户筛选**做实——支持 `user_id` 精确 + `username` 模糊（§四、§六）。
>
> **v0.4 修订**：⑬轮询定为 **30s**、明确不做"正在输入"；⑭两端列表均按 `last_reply_at DESC`（最新创建/回复置顶）；⑮明确**非回合制**，一方可连发多条；⑯新增 **§十 性能与扩展性**——未读轮询的负载画像与 v1 强制三优化（后台暂停轮询 / 无工单不轮询 / Redis 缓存计数，Redis 缺失自动回退 DB）。

---

## 一、背景与目标

平台目前缺少「用户 ↔ 管理员」的轻量沟通通道：用户有建议、咨询、Bug、充值问题时无处反馈，管理员也无法主动跟进。本功能在个人中心新增「我的工单」入口，让每个用户能就某个**主题/工单（Topic）**与管理员进行**多轮对话**。

本质上这是一个**轻量工单系统**：主题 = 工单，回复 = 工单消息。

### 目标

- 用户可在个人中心「我的工单」卡片中：**新建工单**（标题 + 分类 + 正文 + 可选图片）、查看**自己的工单列表**、点击工单查看**完整对话**、**回复**工单。
- 用户**只能看到自己的主题**（后端强制隔离，不依赖前端）。
- 管理员（`role ≥ 10`）在后台「工单管理」页可查看**所有用户的工单**，按用户 / 状态 / 分类筛选并搜索，点击进入对话与用户**多轮讨论**、变更状态、关闭工单。
- 主题带**状态**（待处理 / 处理中 / 已回复 / 已关闭）与**分类**（建议 / 咨询 / Bug / 充值账单 / 其他）。
- **未读红点**：双向。用户侧——管理员回复后未读高亮；管理员侧——有新主题/新回复时高亮。通过轮询拉取未读计数，**不发邮件、不发站内信**（已评审决策）。

### 设计原则（与既有模式一致）

- **后端强制权限**：用户侧所有查询强制 `user_id = 当前用户`；敏感/全量数据仅 `adminRoute`（`AdminAuth`）暴露。
- **数据库兼容**：SQLite / MySQL / PostgreSQL 三库同时支持（遵守 CLAUDE.md Rule 2）。图片列不打 `type:text` 标签，避免 MySQL 被截到 64KiB（与企业认证图片表同一教训）。
- **软删除**：主题用「已关闭」状态 + `DeletedAt` 软删，不物理删除，留痕可追溯。
- **复用优先**：客户端图片压缩、限流中间件、列表分页组件、`common.ApiSuccess/ApiError` 响应封装一律复用。

### 非目标（本期不做，已评审）

- 不发邮件、不发站内信通知（仅红点）。
- 不做 WebSocket / SSE 实时推送，也**不做"对方正在输入"提示**（前端**30s 轮询** + 进入详情时拉取最新即可）。实时性演进路径（轮询 → SSE → WS）见 §九。
- 不做富文本 / Markdown 渲染（纯文本 + 图片附件）；正文按纯文本展示，前端做 `white-space: pre-wrap` 与超链接识别即可。
- 不做工单分配 / 多客服协同 / SLA 计时（管理员共享一个全量视图）。

---

## 二、数据模型

三张表：主题、消息、图片。图片单独成表，避免大 blob 撑大列表查询行（与企业认证 `UserEnterpriseImage` 同理）。

### 2.1 `feedback_topics`（主题 / 工单）

```go
// model/feedback.go
type FeedbackTopic struct {
    Id            int            `json:"id"             gorm:"primaryKey;autoIncrement"`
    UserId        int            `json:"user_id"        gorm:"index;not null"`        // 发起人
    Category      int            `json:"category"       gorm:"type:int;not null;default:1"` // 见 §三
    Title         string         `json:"title"          gorm:"type:varchar(128);not null"`
    Status        int            `json:"status"         gorm:"type:int;not null;default:1;index"` // 见 §三
    MessageCount  int            `json:"message_count"  gorm:"type:int;not null;default:0"` // 含首帖
    LastReplyAt   time.Time      `json:"last_reply_at"  gorm:"index"`                 // 排序用；建主题时置为创建时间
    LastReplyRole int            `json:"last_reply_role" gorm:"type:int;not null;default:1"` // 1=用户 10=管理员，列表标识"谁最后说话"
    UserUnread    bool           `json:"user_unread"    gorm:"not null;default:false"` // 管理员回复后置 true
    AdminUnread   bool           `json:"admin_unread"   gorm:"not null;default:true"`  // 用户发帖/回复后置 true；新建即 true（全局共享位，见 §五）
    ClosedBy      int            `json:"closed_by,omitempty" gorm:"type:int"`         // 关闭操作人；重开（用户回复已关闭主题）时清零
    CreatedAt     time.Time      `json:"created_at"`
    UpdatedAt     time.Time      `json:"updated_at"`
    DeletedAt     gorm.DeletedAt `json:"-" gorm:"index"`
}
```

> **建主题时显式赋值** `LastReplyAt = CreatedAt`、`LastReplyRole = 1`（`time.Time` 是值类型，不赋值会落零值导致排序异常）。
>
> **复合索引**：用户列表按 `(user_id, status)` 过滤、管理员列表按 `(status, last_reply_at)` 排序，建议各加一个复合索引（GORM `index:idx_xxx,priority:n` 或迁移后手工建），单列索引在量大时不够。

### 2.2 `feedback_messages`（对话消息）

```go
type FeedbackMessage struct {
    Id         int       `json:"id"          gorm:"primaryKey;autoIncrement"`
    TopicId    int       `json:"topic_id"    gorm:"index;not null"`
    UserId     int       `json:"user_id"     gorm:"index;not null"`  // 发言者 user_id（用户或**具体某个管理员**）
    AuthorRole int       `json:"author_role" gorm:"type:int;not null"` // 1=用户 10=管理员，决定气泡左右 + "官方"徽标
    Content    string    `json:"content"     gorm:"type:varchar(5000)"` // 允许空串（纯图片消息），去掉 not null
    CreatedAt  time.Time `json:"created_at"  gorm:"index"`
    // 以下非持久化，详情接口填充
    ImageIds   []int     `json:"image_ids"   gorm:"-"` // 查 feedback_images 后填充，前端按 id 取图
    AuthorName string    `json:"author_name" gorm:"-"` // 发言者展示名（见下）
}
```

> 首帖也是一条 `FeedbackMessage`（`author_role=1`），主题的标题/分类存在 `FeedbackTopic` 上。这样「主题正文」与「后续回复」结构统一。
>
> **v0.3：区分是哪个管理员回复**。`UserId` 本就记录了发言者（管理员回复时即该管理员的 user_id），无需新增列；详情接口按发言者 id 批量查 `users` 表补 `author_name`（管理员取 `username`/显示名）。前端管理员气泡显示「客服 · 张三」之类，**多位管理员参与时能逐条看出是谁回的**。
>
> **隐私取舍（待你拍板，默认方案已定）**：默认**对用户也展示回复管理员的显示名**（更透明、有人情味）。若你倾向对终端用户隐去具体管理员、只显示统一「官方客服」，则用户端 `author_name` 返回固定标签、管理员端返回真实用户名即可——一个开关，后端按请求者角色决定返回哪种。当前文档按"都显示真实名"实现，需要隐藏告诉我改。
>
> **v0.2：弃用 `has_images` 布尔**。原设计前端只知"有图"但不知有几张、id 是多少，无法驱动 `/images/:idx` 取图。改为详情接口对每条消息返回 `image_ids: []int`（来自 `feedback_images`），前端按 id 逐张拉取。`Content` 去掉 `not null`，**有图片时允许空正文**（纯图消息），但「正文为空且无图片」的消息必须拒绝。

### 2.3 `feedback_images`（图片附件）

```go
type FeedbackImage struct {
    Id        int       `gorm:"primaryKey;autoIncrement"`
    MessageId int       `gorm:"index;not null"`
    TopicId   int       `gorm:"index;not null"` // 冗余，便于按主题级联删除
    UserId    int       `gorm:"index;not null"`
    Data      string    `gorm:"not null"` // 压缩后 base64（不打 type:text，跨库走默认 longtext/text）
    CreatedAt time.Time
}
```

> **图片不加密**（反馈图非敏感证件），与 KYC/企业认证的加密图区别于此。每条消息最多 **3 张**图片，单张客户端压缩到 **≤ 1.5MB**（最长边 2400px，JPEG 0.88，复用 KYC 客户端 canvas 压缩）。
>
> **存储取舍**：v1 沿用项目既有「base64 存库」做法（三库兼容、零外部依赖）。若后续接入对象存储（见 `docs/media-storage-obs-design.md`），`Data` 改存 URL 即可，表结构不变。

### 2.4 迁移注册

在 `model/main.go` 的 `migrateDB()`（`AutoMigrate(...)`）与 `migrateDBFast()` 的表清单里追加：

```go
&FeedbackTopic{}, &FeedbackMessage{}, &FeedbackImage{},
```

---

## 三、枚举：状态与分类

### 状态 `Status`

| 值 | 含义 | 进入条件 |
|----|------|---------|
| 1 | 待处理 | 新建主题；或已关闭主题被用户回复**重开** |
| 2 | 处理中 | 管理员手动标记（表示已接手但未给结论） |
| 3 | 已回复 | 管理员回复后**自动**置为此态 |
| 4 | 已关闭 | 管理员手动关闭；或用户主动关闭自己的主题 |

**状态转移表（v0.2 定死，消除 v0.1「保持/回到」歧义）**：

| 触发动作 | 前置状态 | 后置状态 | 未读位副作用 |
|---------|---------|---------|------------|
| 用户新建主题 | —（新建） | `1 待处理` | `admin_unread=true`，`user_unread=false` |
| 用户回复 | `1 待处理` | `1 待处理`（不变） | `admin_unread=true`（`user_unread` 不动） |
| 用户回复 | `2 处理中` | `2 处理中`（**保持不变**） | `admin_unread=true` |
| 用户回复 | `3 已回复` | `1 待处理`（**下调**） | `admin_unread=true` |
| 用户回复 | `4 已关闭` | `1 待处理`（**重开**，清 `ClosedBy`） | `admin_unread=true` |
| 管理员回复 | 任意非关闭 | `3 已回复` | `user_unread=true`，`admin_unread=false` |
| 管理员标记处理中 | `1/3` | `2 处理中` | 不变 |
| 管理员/用户关闭 | 任意 | `4 已关闭`（记 `ClosedBy`） | **两侧未读位都清零**（见 §五） |

核心约定：
- **用户回复一律 `admin_unread=true`**（管理员需感知"有新内容"），但**只在 `已回复→待处理` 时下调状态**；`处理中`**保持不变**——不让用户的追问反复打掉管理员"我已接手"的标记。红点负责表达"有新内容"，状态负责表达"处理阶段"，两者解耦。
- `已关闭` 是唯一可被用户回复**重开**的状态，重开即清 `ClosedBy`。
- 管理员回复永远把状态推进到 `已回复`（哪怕之前是 `处理中`）。

### 分类 `Category`

| 值 | 含义 |
|----|------|
| 1 | 建议 |
| 2 | 咨询 |
| 3 | Bug 反馈 |
| 4 | 充值与账单 |
| 5 | 其他 |

> 枚举先硬编码常量（`model/feedback.go` 内 `const`）+ 前端 i18n 文案映射；后续若需后台可配再抽成配置项。

---

## 四、后端 API

路由注册在 `router/api-router.go`，沿用现有 `selfRoute`（`UserAuth`）/ `adminRoute`（`AdminAuth`）分组。控制器 `controller/feedback.go`，模型方法 `model/feedback.go`，DTO `dto/feedback.go`。

### 4.1 用户侧（`/api/user/...`，`UserAuth`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/feedback/topics` | 我的工单列表（分页：`page`/`page_size`，可按 `status`/`category` 过滤）。**默认按 `last_reply_at DESC` 排序——最新创建或回复的工单置顶**。**强制 `user_id=当前用户`**。 |
| POST | `/feedback/topics` | 新建主题（`title`/`category`/`content`/`images[]`）。限流 + 配额校验。 |
| GET  | `/feedback/topics/:id` | 主题详情 + 消息**分页**（`page`/`page_size`，默认按 `created_at` 升序，长对话不全量加载；每条消息含 `image_ids` 与 `author_name`，用户可看出是哪位管理员回的）。校验归属。**进入即把 `user_unread` 清零**。 |
| POST | `/feedback/topics/:id/messages` | 回复主题（`content`/`images[]`）。校验归属；触发状态/未读流转。 |
| PUT  | `/feedback/topics/:id/close` | 用户关闭自己的主题。 |
| GET  | `/feedback/images/:imageId` | 按**图片主键 id** 拉取图（base64）。校验该图所属主题归属当前用户。 |
| GET  | `/feedback/unread` | 返回 `{ unread, has_topics }`：`unread`=我的未读未关闭工单数（`count where user_id=me and user_unread and status!=4`），`has_topics`=我是否有过任何工单（供前端决定**是否挂轮询**，见 §十）。**读经 Redis 缓存、缺 Redis 回退直查 DB**（见 §十）。 |

### 4.2 管理员侧（`/api/feedback/admin/...`，`AdminAuth`，`role ≥ 10`）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET  | `/feedback/admin/topics` | 全量工单列表，分页。**默认按 `last_reply_at DESC` 排序——最新有动静（新建/任意一方回复）的工单置顶**。**按用户筛选**：`user_id`（精确）或 `username`（模糊，先查 `users` 命中 id 集再过滤 topics）；另支持 `status`/`category`/`keyword`(标题模糊)。列表项附 `username`（join/批量查 users 回填）便于展示是谁的工单。 |
| GET  | `/feedback/admin/topics/:id` | 任意主题详情 + 消息分页；每条消息含 `author_id`/`author_name`/`image_ids`，**管理员消息能看出具体是哪位管理员**。**进入即把 `admin_unread` 清零**。 |
| POST | `/feedback/admin/topics/:id/messages` | 管理员回复（`author_role=10`）。置 `已回复` + `user_unread=true`。 |
| PUT  | `/feedback/admin/topics/:id/status` | 变更状态（处理中 / 关闭）。 |
| GET  | `/feedback/admin/images/:imageId` | 管理员按图片 id 看任意图片。 |
| GET  | `/feedback/admin/unread` | 待处理工单数（`count(admin_unread=true and status!=4)`），**Redis 缓存（单一全局 key）、缺 Redis 回退 DB**（见 §十）。 |

> 路由顺序：与 KYC/企业认证一致，**具体段路由先于 `/:id` 注册**，避免 `:id` 吞掉 `admin`/`unread` 等字面量。
>
> **分页上限**：主题列表 `page_size` 上限 100；**消息分页 `page_size` 上限 200**（前端一次拉满最近 200 条，保证 ≤200 条工单完整显示、回复后新消息必现）。超过 200 条消息的工单（极罕见）只显示最旧 200 条，作为 v1 已知限制，未来以「向上加载更早」补足。`page_size` 超过对应上限时后端回退默认值（主题 20 / 消息 50），故前端务必请求 ≤ 上限的值。

### 4.3 限流、配额与入参校验（防刷）

- 新建主题、回复：挂 `middleware.CriticalRateLimit()`。
- **配额**：单用户**未关闭**主题数 ≤ 10（`count` 排除 `DeletedAt`）；单日新建主题 ≤ 20。
- **非回合制，允许一方连发多条**（v0.3 明确）：对话**不是"你一句我一句"的轮流制**——用户或管理员都可以在对方没回复前**连续发多条消息**（补充信息、追加截图等），每条都是独立 `FeedbackMessage`，正常入库与排序。这是预期行为，**不做回合锁**。
- **重开/防刷节流**（仅防刷，不限制正常连发）：连发只受 `CriticalRateLimit()` 频率限制（防止脚本刷屏），不设"连续条数硬上限"；已关闭工单的"回复重开"计入单日新建配额，避免绕过新建限制。
- **入参枚举校验**（v0.2 补）：`category` 必须 ∈ {1..5}、用户提交不接受 `status`（状态由后端按转移表推导，绝不信任前端传入）；管理员变更状态仅允许 `{2 处理中, 4 已关闭}`。非法值返回 400。
- **写操作同事务**（v0.2 补）：「插入消息 + 更新主题 `MessageCount/LastReplyAt/LastReplyRole/Status/未读位` + 插入图片」必须包在**同一 DB 事务**内，避免计数漂移与部分写入；配额 `count` 校验亦在事务内（或对 `user_id` 加行级约束）降低 TOCTOU。
- 文本：`content` ≤ 5000 字符（有图片时可为空，但不可"空文本且无图"）；`title` ≤ 128，必填非空。
- 图片：每条消息 ≤ 3 张，单张解码后 ≤ 1.5MB（复用 KYC 的 `maxImageDecodedBytes` 快速校验）。

### 4.4 审计

管理员关闭主题、变更状态写 `LogTypeManage` 日志（操作人 + topicId），与既有后台操作一致。读消息/图片量大，**不逐条写审计**（与 reveal 类敏感接口不同，反馈非敏感）。

---

## 五、未读红点机制

不发通知，仅靠 `user_unread` / `admin_unread` 两个布尔位 + 轮询计数：

- **置位**：用户发帖/回复 → `admin_unread=true`；管理员回复 → `user_unread=true`。
- **清零**：
  - 对应角色**打开主题详情**时清零自己那一侧；
  - **关闭主题时两侧未读位都清零**（v0.2 修：否则被关闭前对方没看过的主题会永久挂在其红点里）。
- **聚合**：`GET /feedback/unread`（用户）/ `/feedback/admin/unread`（管理员）返回「有未读的**未关闭**主题数」——**查询必须带 `status != 4`**（v0.2 修），与上一条形成双重保险。
- **轮询性能**：未读计数是唯一随"在线总人数"线性增长的负载，v1 强制三项优化——①后台标签页暂停轮询 ②无工单用户不轮询 ③Redis 缓存计数。详见 **§十 性能与扩展性**。
- **前端**：
  - 用户端——`SiderBar` 「个人设置」菜单项挂角标（或「我的工单」卡片标题挂角标），**轮询间隔 30s**（后台标签页暂停、无工单用户不挂，见 §十）。
  - 管理员端——`SiderBar` 「工单管理」菜单项挂角标，**轮询 30s**（后台标签页暂停，见 §十）。
  - 复用现有轮询/角标实现（如签到、未读通知处的模式），无则用 `setInterval` + Semi `Badge`。

> **已知局限（v0.2 显式标注）**：`admin_unread` 是**全局共享**的单一布尔位，不区分具体管理员——管理员 A 打开主题后该位清零，从未看过的管理员 B 也不再看到红点。这是「共享工单池」模型的有意取舍（管理员共用一个全量视图），v1 **不**做按管理员维度的已读位点。若将来需要"每个管理员各自的未读"或"未读条数"，再引入 `feedback_reads(topic_id, reader_id, last_read_msg_id)` 表按位点 count。

---

## 六、前端

### 6.1 用户侧：个人中心卡片

- 新增 `web/classic/src/components/settings/personal/cards/FeedbackConsult.jsx`，在 `PersonalSetting.jsx` 中 `import` 并挂到卡片流（紧随 `EnterpriseSetting` 之后），与现有卡片排版一致。
- **布局**（贴合需求描述）：
  - **上方**：我的工单列表（标题、分类标签、状态标签、最后回复时间、未读红点、"管理员已回复"提示），**按最后活动时间倒序——最新创建/回复置顶**。点击某行 → 展开/进入该工单对话。
  - **中间**：选中主题的消息流，**微信式「视角相对」气泡对齐**——以当前查看者为基准，**自己发的靠右、对方发的靠左**。在用户端即：本人消息靠右，管理员消息靠左 + 「官方」徽标 + **该管理员的 `author_name`**（多位管理员先后回复时逐条可辨）。气泡含头像/角色标识、时间、文本（`white-space: pre-wrap`）、图片缩略图（点开大图）。底部回复框（文本 + 图片上传，≤3 张）+「关闭主题」按钮。
  - **下方**：新建主题表单（标题 + 分类下拉 + 正文 + 图片上传 + 提交）。
- 图片上传复用 KYC/企业认证的客户端压缩工具函数（canvas 压缩 → base64）。

### 6.2 管理员侧：后台「工单管理」页

- 新增页面 `web/classic/src/pages/Feedback/index.jsx`。
- 路由：`App.jsx` 增加 `/console/feedback`，用 `<AdminRoute>` 包裹（与 `/console/enterprise` 同款）。
- 侧边栏：`SiderBar.jsx` 管理分组内新增菜单项 `{ text: t('工单管理'), to: '/console/feedback', className: isAdmin() ? '' : 'tableHiddle' }`（放在「企业认证」之后）。
- **页面形态**（复用 `User`/`Reconcile` 列表范式）：
  - 顶部筛选区：**按用户筛选**（用户 ID 精确 / 用户名模糊）、状态、分类、标题关键字、查询/重置；列表列含「所属用户」。
  - 主体：分页表格（主题 ID、用户、标题、分类、状态、消息数、最后回复时间、未读标识）。
  - 点击行 → `Drawer`/详情：消息流采用**同一套「视角相对」气泡**，但视角是管理员——**管理员（含其他管理员）的回复靠右、用户消息靠左** + 用户标识。即：同一条消息在用户端和管理员端左右相反，由前端按「`author_role` 是否等于当前查看者角色」决定对齐方向，后端只存 `author_role`、不存对齐。**每条管理员气泡显示 `author_name`**，多位管理员协同时一眼看清是哪位同事回的（包括当前管理员自己 vs 其他管理员）。+ 管理员回复框 + 状态切换（处理中/关闭）。

### 6.3 i18n

新增中英文案键（`web/classic/src/i18n` 或现有词条文件）：菜单「工单管理」、卡片「我的工单」、状态/分类枚举、空态与校验提示。遵循 `docs/translation-glossary.md` 术语，保证 classic 非中文语言下文案切换（参考最近 i18n 修复 commit）。

---

## 七、实现清单（建议提交顺序）

**后端**
1. `model/feedback.go`：三个 struct + 状态/分类常量 + 方法（建主题、加消息、列表分页、归属校验、未读置位/清零、配额 count、关闭）；写操作包同事务。
2. `model/main.go`：`migrateDB()` + `migrateDBFast()` 注册三表；建好 §10.3 复合索引。
3. `dto/feedback.go`：请求/响应 DTO（列表项脱敏不含图片 blob；详情含消息 + `image_ids`/`author_name`；`unread` 响应含 `has_topics`）。
4. `controller/feedback.go`：用户侧 + 管理员侧 handler，图片大小快速校验复用 KYC 常量；枚举入参校验；不信任前端 `status`。
5. `router/api-router.go`：`selfRoute` / `adminRoute` 注册（注意字面量路由先于 `:id`）。
6. **未读计数 Redis 缓存层**（§10.2 ③）：`common.RedisEnabled` 分支 + 写时失效 + 出错降级 DB。

**前端**
7. `cards/FeedbackConsult.jsx` + 挂载到 `PersonalSetting.jsx`（微信式视角相对气泡）。
8. `pages/Feedback/index.jsx` + `App.jsx` 路由 + `SiderBar.jsx` 菜单 + 红点轮询；**轮询 30s + 后台标签页暂停（Page Visibility）+ 无工单用户不挂轮询（依 `has_topics`）**（§10.2 ①②）。
9. i18n 文案。

**验证**
10. 三库（至少 SQLite + 一种）跑 `AutoMigrate` 无误；用户隔离越权用例（A 用户访问 B 工单/图片应 404）；配额与限流；连发多条；图片压缩与大小拒绝；管理员全量、按用户筛选与状态流转；红点置位/清零；**Redis 开/关两种部署下 unread 都正确（缓存命中/失效/降级）**。

---

## 八、安全与边界检查清单

- [ ] 用户侧所有读写**强制 `user_id = c.GetInt("id")`**，越权访问主题/消息/图片返回 404（不泄露存在性）。
- [ ] 管理员接口全部在 `adminRoute`（`AdminAuth`）下，普通用户不可达。
- [ ] 图片接口按 `imageId` 取图并校验「该图所属主题归属请求者」（用户）或管理员身份。
- [ ] **状态不信任前端**：用户提交不接受 `status`，由后端按转移表推导；`category` 校验 ∈ {1..5}，管理员 `status` 仅允许 {2,4}。
- [ ] **写操作同事务**：消息插入 + 主题计数/时间/状态/未读更新 + 图片插入原子提交。
- [ ] 文本/图片大小、数量、配额、连发/重开节流齐全，防刷；"空文本且无图"拒绝。
- [ ] 关闭 = 软删/状态，不物理删除；关闭时清两侧未读位；未读聚合带 `status != 4`。
- [ ] 级联删除（如硬删用户）用 `Unscoped` 清理三表。
- [ ] 三库 GORM 标签兼容（图片列不打 `type:text`）。
- [ ] 管理员状态变更写 `LogTypeManage` 审计。

---

## 九、未来可演进项（非本期）

- **实时性演进：轮询 → SSE → WS**。v1 用 **30s 轮询**（零额外架构）。若需"秒级实时"，优先上 **SSE 单向推送**（新工单/新回复即时到达，复用 new-api 既有 SSE；多实例需 Redis 发布订阅扇出）——这是工单这种**异步**场景的甜点区。**WebSocket + "正在输入"** 仅在把本功能升级为**在线客服实时聊天**时才值得（异步工单里双方同时在线概率低，typing 收益小却要扛 WS + HA 全部复杂度），故本期及近期不做。
- 站内信/邮件通知（接入现有 `NotificationSettings`），用于管理员/用户**离线也能感知**——轮询/SSE 都只在登录在线时有效。
- 未读「条数」精确化（已读位点）。
- 工单分配 / 客服身份区分 / SLA 计时与超时提醒。
- 图片迁移对象存储（OBS）。
- 用户满意度评价（关闭时打分）。
- 后台可配置分类、置顶公告型主题。

---

## 十、性能与扩展性

### 10.1 负载画像

| 负载来源 | 触发 | 随什么增长 | 风险 |
|---------|------|-----------|------|
| 列表 / 详情 / 发消息 | 用户打开工单页时 | 工单**使用量** | 低（分页 + 索引） |
| **未读红点轮询** | 每个在线用户每 30s | **在线总人数** | **中**：与是否使用工单无关的恒定后台负载 |
| 管理员全局未读 count | 每个在线管理员每 30s | 工单表总行数 | 低（管理员数少；靠索引 + 集合天然有界） |
| 图片 base64 存库 | 用户传图 | 附件累计量 | 中：撑大 DB 体积、备份/复制变重 |

唯一随"在线总人数"线性增长的是**未读轮询**：1k 在线≈33 QPS、10k≈333、100k≈3,333 的恒定 `COUNT`。故 v1 强制下列三项优化。

### 10.2 v1 强制优化（1+2+3 全上）

**① 后台标签页暂停轮询**（前端）
用 Page Visibility API：标签页 `hidden` 时停掉 30s 定时器，`visible` 时立即拉一次并恢复。大量后台标签直接不产生请求。

**② 无工单用户不轮询**（前端）
应用初始化时调用一次 `GET /feedback/unread`，依据返回的 `has_topics`：
- `false`（从未建过工单的绝大多数用户）→ **完全不挂轮询**，仅在用户进入"我的工单"页或新建工单后再启动；
- `true` → 挂 30s 轮询（且受 ① 约束）。

这一条把 95%+ 用户移出轮询池，是最高性价比优化。

**③ Redis 缓存未读计数**（后端，自适应）
仿 `CriticalRateLimit` 的写法——**有 Redis 用 Redis，无 Redis 回退直查 DB**，不引入硬依赖：

```go
if common.RedisEnabled {
    // 命中缓存直接返回；未命中则查 DB 回种缓存
} else {
    // 直接 COUNT(DB)
}
```

- **Key**：用户 `feedback:unread:user:{userId}` → 计数；管理员 `feedback:unread:admin` → 全局计数（单一 key，契合 §五 的全局共享未读位）。
- **TTL**：60s（安全网，兜住漏失效；实际新鲜度靠写时失效）。
- **写时失效**（在写事务提交后执行）：
  - 用户发帖/回复 → 删 `feedback:unread:admin`；
  - 管理员回复 → 删该工单 owner 的 `feedback:unread:user:{ownerId}`；
  - 用户打开详情（清 user_unread）→ 删 `feedback:unread:user:{me}`；
  - 管理员打开详情（清 admin_unread）→ 删 `feedback:unread:admin`；
  - 关闭工单 → 两个 key 都删。
- Redis 读写出错一律**降级为直查 DB**，绝不因缓存故障影响功能。

> 缓存延迟：写时失效保证有动作后下一次 poll 即新鲜；TTL 仅兜底漏失效，最坏 60s 自愈。感知延迟主要由 30s poll 间隔决定，缓存不额外增加用户可感的滞后。

### 10.3 索引与数据增长

- 必备复合索引：`feedback_topics(user_id, status)`、`feedback_topics(status, last_reply_at)`、`feedback_messages(topic_id, created_at)`、`feedback_images(message_id)`。
- 管理员全局 `COUNT(admin_unread AND status!=4)` 走 `(status, admin_unread)`；"未关闭且未读"集合被管理员处理后收敛，天然有界，不会随历史无限膨胀。
- topics/messages 单调增长，但分页查询是索引区间扫描，规模无关。若历史极大，可后续**归档 N 个月前已关闭工单**（演进项）。

### 10.4 图片存储（现状与演进）

- **现状**：前端 canvas 压缩（最长边 2400px / JPEG 0.88 / ≤1.5MB / ≤3 张）后，以 **base64 文本存 DB 独立表 `feedback_images`**，不加密、与列表查询隔离。三库兼容、零外部依赖。
- **这是 DB 体积增长的主要来源**：附件累积会让库变大、备份/主从复制变重。
- **演进**：接入对象存储（OBS，见 `docs/media-storage-obs-design.md`）后 `Data` 改存 URL，表结构与接口不变，列表查询不受影响。若预期图片量大，可把此项提前到 v1.5。
