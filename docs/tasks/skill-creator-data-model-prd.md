# P1 — Skill Creator Data Model PRD (skill-creator-data-model)

Status: build
Owner: @sam
Date: 2026-08-24
Ticket: Module3 - P1
Refs:
- `docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md`(既有 schema 规范)
- umbrella `docs/skills-marketplace-prd.md`(产品 PRD)
- umbrella `docs/adlc/tasks/skill-creator-data-model-task.md`(任务卡)

## Problem

Skills 商场目前是**平台自营货架**:只有 root(role=100)能建 skill,`internal/skill/`
里不存在「创作者」这个概念。Module3 要把它变成双边市场,而现有 schema 有四个缺口,
每一个都会挡住后续 P2–P7 的开工。

**1. 没有归属。** `skills.created_by` 记的是「哪个管理员建的」,不是「哪个创作者拥有
它」。今天两者是同一件事,一旦开放上架就必须分开 —— 分钱和鉴权都靠它。

**2. 状态机是一条直线,中间没有审核。** 现有 `draft → published → deprecated →
archived` 是「自己写、自己发」的流程。创作者流程需要 提交 → 机器扫描 → 人工审核 →
沙箱自测 → 申请上线 → 上架,并且要留下审核痕迹(谁审的、何时、什么意见、扫描结果)。

**3. prompt 是死文本。** `skill_versions.instruction_template` 存的是一整段话。创作者
商场需要带 `{{变量}}` 的模板,以及每个变量的名称/类型/是否必填,前端才能生成填写表单。
防抄袭的 MinHash 指纹同理 —— 它是 prompt 的指纹,必须跟 prompt 同表。

**4. 有埋点,但没有账本。** `skill_usage_events` 服务于分析:丢一条只是图表少个点。
创作者分润要回答「这个月该给谁打多少钱」并且经得起对账 —— 可靠性要求差一个数量级,
不能把埋点表改造成账本。

## Goals

- 让 DB schema 能表达:归属、审核流程、模板变量、逐次计费、用户评分、创作者邀请。
- **纯加法**:只放宽约束、只加列、只建表。不删列、不改语义、不改变任何现有行为。
- 三个数据库(SQLite / MySQL / PostgreSQL)都能迁移,且在**已有数据**的库上不丢数据。

## Non-Goals

1. **不写任何新状态值。** 本任务之后没有任何代码路径会产生 `submitted` / `sandbox` /
   `pending_launch` —— CHECK 只是**允许**它们。这正是本任务能先于 P2–P7 单独上线的原因。
2. **不接创作者邀请的写入路径。** `users.creator_invited_at` 只是一个列。
   ⚠️ 留给 P2 的坑:`User.Update()`(`model/user.go:564`)用 `Updates(newUser)` 结构体
   形式会跳过零值,nil 指针永远写不进去。邀请端点应当用
   `DB.Model(&User{}).Where("id = ?", id).Update("creator_invited_at", now)`,
   而不是把该列加进 `Edit()` 的 map —— 否则管理员改别的字段时会意外清空邀请。
3. **不建运营审核队列表。** 见 D1。
4. 不做任何 API、handler、前端改动。

## Decisions

三条与任务卡原文不一致的裁决。**已定,不再重开讨论。**

### D1 · 用户评分表命名为 `skill_ratings`,不占用 `skill_reviews`

`skill_reviews` 这个名字被两份规范同时占用:

| 规范 | 定义 |
|---|---|
| `docs/skill-marketplace/tasks/03_Data_Model_and_API_Spec.md` §4.6 | **运营审核队列**,`status IN ('open','assigned','escalated','resolved','reopened')` —— 这正是 `enums.ReviewStatus` 的来源 |
| umbrella `docs/skills-marketplace-prd.md` §5.2 | **用户 1–5 星评分表** |

**裁决:用户评分表叫 `skill_ratings`。** 理由:

1. `handler/skills.go:1848` 的 `publicRatingSource()` 探测顺序本就是
   `["skill_ratings", "skill_reviews"]` —— 用这个名字天然被读到,读取端一行不用改。
2. `skill_reviews` 与 `enums.ReviewStatus` 原样留给运营队列,两份规范都不必作废。
3. ⚠️ **反面理由(这条最重要)**:若把评分表建成 `skill_reviews` 并复用
   `enums.ReviewStatus`,`loadApprovedRatingSummariesBySkill`(`handler/skills.go:1834`)
   筛的是 `status IN ('approved','published')`,与 open/assigned/escalated/resolved/reopened
   **交集为零** —— 每个 skill 的评分会永远显示 0,**没有报错、没有测试失败**。

`skills.review_status` 仍然复用 `enums.ReviewStatus` —— 那本来就是一个内嵌在行上的
审核队列,词汇完全匹配,也让「`enums.ReviewStatus` 终于被引用」这条验收成立。

### D2 · SQLite 的旧 CHECK 不修,改为开机告警

SQLite **不能 ALTER 已存在的 CHECK 约束**。生产跑 PostgreSQL 会被正常迁移,但开发机上
已存在的 `one-api.db` 会永远保留旧的 4 值约束。

**裁决:接受降级 + 加一个 log-only 开机探针。**

理由:生产是 PostgreSQL,SQLite 仅用于 `make dev` 与单测;CI 每次都是全新库,不受影响;
DR-99 / DR-100 两次扩枚举都是这么发的,先例已立。

**为什么必须加告警**:本任务自己不会暴露问题(没人写新状态值)。等 P3/P5 真正写
`submitted` 时才会炸,报错是 `CHECK constraint failed: chk_skills_status`,看起来像 P3 的
bug,而根因是一个几个月前建的本地库。探针把这半天排查省掉:

```
skills.status CHECK on this SQLite database predates the creator workflow and will
reject 'submitted'/'sandbox'/'pending_launch'. SQLite cannot ALTER a CHECK constraint.
Delete the dev database (default ./one-api.db, or $SQLITE_PATH) and restart.
PostgreSQL/MySQL are migrated automatically.
```

**恢复方法:删掉 `one-api.db` 重启。** 开发库是一次性的,没有值得保留的数据。

### D3 · `status` 只加三个值,其余用语义映射

新增 `submitted` / `sandbox` / `pending_launch`,共 7 值。

下游卡用的词与本卡对不上(P3/P4 说 `pending_review`,P4 还要 `suspended`)。
**裁决表 —— 下游一律按此实现:**

| 下游卡写的 | 实际取值 | 理由 |
|---|---|---|
| P3/P4 的 `pending_review` | `status='submitted'` + `review_status='open'` | 队列状态属于 `review_status`,在 `status` 里再存一份就是本卡要消除的漂移 |
| P4 的 `suspend` → `suspended` | `status='deprecated'` | `deprecated` 与 `DeprecatedAt`(`skill.go:126`)已存在,语义就是「撤下架」 |

⚠️ **逃生口**:若团队否决任一映射,**必须在本任务内追加**那两个值。二次扩 CHECK 要在
PG/MySQL 再做一轮 drop-and-readd,并再废掉一代开发机的 SQLite 库。现在的边际成本是两个
字符串,以后是重做本节。

## Schema Changes

### `skills` +8 列

| 列 | 类型 | 说明 |
|---|---|---|
| `source` | `varchar(32) NOT NULL DEFAULT 'official'` | `official` / `creator` |
| `creator_id` | `bigint NULL` | 归属;分钱与鉴权的依据 |
| `review_status` | `varchar(32) NULL` | `enums.ReviewStatus`;NULL = 从未进过审核 |
| `review_actor_id` | `bigint NULL` | 谁审的 |
| `reviewed_at` | `timestamp NULL` | 何时审的 |
| `review_note` | `text NULL` | 打回理由 |
| `scan_report` | `text NULL`(PG 升 `jsonb`) | 机器扫描结果 |
| `scanned_at` | `timestamp NULL` | 何时扫的 |

`chk_skills_status` 表达式扩为 7 值,**约束名不变**。

新增索引:`idx_skills_creator(creator_id,status)`、`idx_skills_source_status(source,status)`、
`idx_skills_review_status(review_status,status)`。

### `skill_versions` +2 列

| 列 | 类型 | 说明 |
|---|---|---|
| `variables_schema` | `text NOT NULL DEFAULT '[]'`(PG 升 `jsonb`) | `{{变量}}` 的定义数组 |
| `minhash_signature` | `text NULL` | 128 维防抄袭指纹(base64) |

### `users` +1 列

`creator_invited_at timestamp NULL` —— 邀请制的开关,**有值即已受邀**,不需要单独建表。
放在 `=== Airbotix / DeepRouter additions ===` 块内,紧随 `Tier2TelemetryConsentedAt`。

### 新表 `skill_calls`(逐次计费账本)

`id` / `skill_id` / `skill_version_id` / `version_number` / `user_id` / `tenant_id` /
`creator_id` / `log_id` / `request_id` / `base_quota` / `markup_quota` /
`commission_quota` / `platform_quota` / `markup_bps` / `called_at` / `created_at`

三个设计决定:

- **用 quota 不用 cents。** umbrella PRD §5.2 写的是 `*_cents bigint`,但 P6 的验收是
  「佣金加到 `users.quota`」,而 `users.Quota` 是 `int` quota 单位。存 cents 会在给钱那
  一刻强制有损换算。
- **不建外键。** 同 `skill_usage_events` 的理由(`sue_event_migrate.go:127-128`):
  append-only 账本必须能在 skill 被硬删后存活。
- `request_id` 唯一索引 = P6 的防重复计费闸门;用 `*string` 以便多行 NULL 共存。

### 新表 `skill_ratings`(用户评分)

`id` / `skill_id` / `user_id` / `tenant_id` / `rating`(CHECK 1–5)/ `comment` /
`status`(`approved`/`pending`/`rejected`/`hidden`,**默认 `approved`**)/ `created_at` / `updated_at`

- ⚠️ 列名 `skill_id` / `rating` / `status` 是**承重的** —— `handler/skills.go:1857-1874`
  靠这三个名字 duck-type 绑定。改名会静默切断评分读取。
- 唯一索引 `(skill_id, user_id)` 在 DB 层交付 P7 的「同一用户重复评分不产生多条」。
- **默认必须是 `approved`**:产品没有评分审核队列,默认 `pending` 会让每一行都不可见。

## Migration Mechanics

三个已知会咬人的机制,对策一并定死。

### M1 · 新列一律不加 `check:` struct tag

`skill_integration_test.go:329-332` 记录:glebarez/sqlite v1.9.0 + gorm v1.25.2,对**已存在**
的表 AutoMigrate 时若 `HasConstraint` 返回 false,会进入表重建路径并以
`invalid DDL, unbalanced brackets` 失败。

今天是潜伏的 —— 所有 `chk_skills_*` 名字都已存在,判断短路了。**新增一个约束名 =
每个现存 SQLite 部署下次开机即挂。**

→ `chk_skills_source` / `chk_skills_review_status` / `chk_skills_creator_has_creator_id`
**只写进 raw-DDL 数组,不写 struct tag**。代价:这三条在 SQLite 上不存在(连全新库也没有),
由 Go 层的枚举/常量校验兜底。这是刻意取舍。

`skill_calls` / `skill_ratings` **可以**带 `check:` tag —— M1 只在表已存在时触发,而它们
到处都不存在。

### M2 · 改 CHECK 表达式必须配 drop 钩子

`migrate.go:262` 有 `if HasConstraint(...) { continue }`,判断的是**名字**不是内容。只改
表达式对已存在的 PG/MySQL 库是**永久静默 no-op**。

→ 新增 `refreshSkillsStatusConstraint(db)`,照 `refreshSUEEventTypeConstraint`
(`sue_event_migrate.go:351-366`)分方言实现(PG `DROP CONSTRAINT IF EXISTS`,
MySQL `DROP CHECK`),在约束循环**之前**调用。

不沿用 DR-100 的内联 `DropConstraint` 特例(`migrate.go:256-260`):后者在 MySQL 驱动上
经 `GuessConstraintAndTable` 推断,依赖约束必须声明在 struct tag 里,与 M1 相冲。

### M3 · `skills` 与 `skill_versions` 的加列方式完全不同

- **`skills` 无手写 CREATE TABLE**(三方言全靠 AutoMigrate)→ 改 struct 即可。仍需
  `migrateSkillsCreatorColumns` 用 `db.Migrator().AddColumn` 显式补列(不手写 ALTER,
  由 gorm 从字段定义生成 DDL,类型才不会与 struct tag 漂移而在下次开机触发重建),
  并在 AutoMigrate **之前**调用。
- **`skill_versions` 有 SQLite(`migrate.go:85-122`)和 MySQL(`migrate.go:124-159`)
  两份手写 CREATE TABLE** → 需**三处协同**:struct + 两份 CREATE TABLE + 带
  `UPDATE … WHERE IS NULL` 回填的 ALTER 助手,且助手要在 PG 路径的 AutoMigrate
  前后**两处**都调用。先例:DR-93 `3cedb6bb`。

### `MigrateSkills` 最终顺序

```
migrateSkillsCreatorColumns          ← 新增,最前
AutoMigrate(&Skill{})
migrateSkillsConstraints             ← refreshSkillsStatusConstraint 在其内、循环前
warnStaleSkillsStatusCheckSQLite     ← 新增,只打日志,永不返回 error
createSkillsJSONBColumns             ← + scan_report(可空、无默认值)
createSkillsIndexes                  ← + 3
migrateSkillsTimestampDefaults       ← 不变
```

## Deployment Notes

**合并进 `main` = 直接改生产,而且连数据库一起改。** 这条链路是全自动的,中间没有人工
确认,也没有测试环境:

```
合并 PR → .github/workflows/deploy.yml(push: branches [main],paths 含 internal/** 与 model/**)
        → 构建镜像 → ECR → SSM 滚动那台 EC2
        → 新容器启动 → model/main.go:216 在 IsMasterNode 下自动跑 migrateDB()
        → 生产 PostgreSQL 15 的 schema 当场被改
```

**没有单独的「跑迁移」步骤。** 生产库是那台 EC2 上的 `postgres:15-alpine` 容器
(`deploy/docker-compose.prod.yml:82`),不是 RDS。

### 为什么这次可以走这条自动链路

本任务被刻意约束成**纯加法**(见 Non-Goals 第 1 条),就是为了让它能安全地自动上线:

| 动作 | 风险 |
|---|---|
| 加 11 个列(全部可空或带默认值) | 老代码不读它们 |
| 建 2 张空表 | 没有代码写它们 |
| status 白名单 4 值 → 7 值 | **只是放宽**,原有取值行为不变 |
| 写新状态值 | **本任务不做** |

⚠️ 唯一的**破坏性动作**是 M2:`chk_skills_status` 会被先 DROP 再重建。中间有一个极短的
窗口该约束不存在。生产上不构成问题(那一刻没有写 status 的流量),但它不是纯加法,
review 时应当被当作一个独立的点看待。

### 合并前后必须做的三件事

1. **合并前在真 PostgreSQL 上跑过测试。** 本地 SQLite 全绿**不能**说明生产没事 ——
   本任务改的恰恰是三个数据库行为差异最大的两处(CHECK 约束、jsonb)。见 Acceptance
   里那两条 PG/MySQL 专项。
2. **部署后立刻看容器日志。** 迁移失败会导致容器起不来,而那台 EC2 上**没有第二个实例
   顶着** —— 服务直接不可用。
3. **回滚预案:回滚代码,不回滚数据库。** DB 改动不会自动撤销,但因为是纯加法,旧代码
   遇到多出来的列会直接忽略,所以**只重新部署旧镜像即可**,不需要也不应该去撤销 schema。
   这正是「纯加法」这条约束真正的价值 —— 它让回滚这条后路始终敞着。

## Acceptance

- [ ] `skills` 8 个新列、`skill_versions` 2 个新列、`users` 1 个新列在 SQLite / MySQL / PostgreSQL 三平台都能建出
- [ ] `skill_calls` / `skill_ratings` 两表建成,各有 Go model 与 `TableName()`
- [ ] `enums.ReviewStatus` 被真正引用(不再是死代码)
- [ ] status CHECK 扩展后,旧的四个值行为不变;`'invalid'` 仍被拒
- [ ] **全新** SQLite 库上 raw INSERT `submitted`/`sandbox`/`pending_launch` 成功
- [ ] **带旧 4 值约束的遗留 SQLite 表**跑完迁移:不报错、数据完好、新列已加且 `source` 回填为 `official`、且 `submitted` 仍被拒(D2 的降级被显式断言,防止有人「顺手修好」)
- [ ] PG/MySQL 上:人为还原旧约束后再跑迁移,`status='sandbox'` 的 INSERT 成功(证明 M2 的 drop 钩子真的触发)
- [ ] `scan_report` 在 PG 上是 jsonb 且无默认值;`variables_schema` 是 jsonb 且默认 `'[]'`
- [ ] `skill_ratings` 含 `skill_id`/`rating`/`status` 三列(duck-typing 契约)
- [ ] 空的 `skill_ratings` 表下,marketplace 列表的 `rating_summary` 仍是 `{0,0}`(建表不改变生产行为)
- [ ] 迁移在**已有数据**的库上跑一遍不丢数据、不报错
- [ ] `MigrateSkills` / `MigrateSkillVersions` 在 PG/MySQL 上连跑两次幂等
- [ ] 现有 skill 单测全绿;`TestListMarketplaceSkills_DR89SocialProof…` 的四条断言(avg 4.5 / count 2 / 1 星排除 / download 2)保持不变

## Rejected Alternatives

| 方案 | 成本 | 否决理由 |
|---|---|---|
| `rebuildSkillsTableSQLite`(照 `rebuildSUETableSQLite` 给 skills 做表重建) | +6h | `skills` 目前**无任何手写 DDL**,重建会给它引入第二份真相源(~38 列),以后每加一列都要手工同步 —— 这正是 `skill_versions` 在付的税。为一个一次性的开发库付这个代价不划算 |
| 用 `type skillsRebuildTmp Skill` 让 gorm 生成临时表 DDL | 需先做 spike | 避开了同步税,但 SQLite 索引名是库全局的,`uni_skills_slug` 等会与原表冲突。若 SQLite 将来成为受支持的部署形态,从这条重新评估 |
| `PRAGMA writable_schema=ON` 直接改 `sqlite_master.sql` | ~20 行 | 字符串改错会损坏 schema。为开发便利用这么锋利的工具不成比例 |
| 评分表占用 `skill_reviews` + 复用 `enums.ReviewStatus` | 同等工作量 | 见 D1 反面理由:评分永远为 0 且无任何报错 |
| `skill_calls` 用 `*_cents` 存钱 | 同等 | 与 `users.quota`(int quota 单位)不同量纲,在给钱那一刻强制有损换算 |

## Known Degradation

**已存在的开发用 SQLite 库无法接受新状态值。** 影响面:仅 `make dev` / `go run main.go`
的本地库。生产(PostgreSQL)与 CI(每次全新库)不受影响。症状要到 P3/P5 才显现;
`warnStaleSkillsStatusCheckSQLite` 会在开机时明确指出并给出恢复方法(删库重启)。

**`chk_skills_source` / `chk_skills_review_status` / `chk_skills_creator_has_creator_id`
在 SQLite 上不存在。** 见 M1。Go 层的枚举与常量校验是这三者在 SQLite 上的唯一闸门。
