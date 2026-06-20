# R2 Jira Impact Map — Distributable Skill Package Model (D-09)

本文件把 R2 需求变更（决策 `D-09`，见 `00_Overview.md` §0）对照现有 130 张 Jira 票
（`Jira_V2/skill_marketplace_v2_tickets.md`，DR-39..DR-168），按改动量分类。

目标：**最小化 Jira 改动**。R2 刻意保留 relay 执行链、计费、entitlement、quota、Kids 服务端拦截、限流、NFR 等后端机器，因此绝大多数票**原样保留**。真正受影响的，集中在 ①执行入口从站内 Playground 改为下载包调公开路由 API；②放弃 prompt 保密带来的安全票重定义。

> 本文件**不修改**任何 Jira CSV 或票。它是改动地图，供后续在 Jira 中刻意执行。
> 数量小结：**保留 ~108 · 重定义（同票改描述）~12 · 新增 ~6 · 作废或大幅重定义 ~5**。

---

## 0. 执行状态对账（更新于 2026-06-19）

> **关键现实**：Jira 项目目前只导入了 **MVP 集 DR-39..DR-78**；v2 全量规划中的 “rest”（**DR-79..DR-168**，多为 M11 安全 / NFR / 增长）**尚未建票**。因此 B/D 两类里凡 DR 号 > 78 的票**无法“更新”**（票不存在），只能在将来建票时**直接带 R2 文案**。
>
> 状态图例：✅ 已落地（脚本/数据就绪）· ⏳ 待执行（live run 由 owner 触发）· ⏸ 延后（票未建，建时带 R2 文案）

**配套工具（已加入 `Jira_V2/`）**
- `update_jira.py` — 按 DR 号 `PUT` 更新 description（可选 Summary/Labels），带 `--dry-run`；只更新已存在票，绝不新建。
- `deeprouter_jira_update_r2.csv` — B/D 共 17 张的 R2 新描述（数据源）。
- `deeprouter_jira_create_new.csv` — C 类 6 张新增票的建票数据（喂给 `create_jira.py`）。

**B 类（重定义，12 张）**

| 子类 | 票 | 状态 |
|---|---|---|
| 已存在、可直接更新 | DR-53, DR-55, DR-56, DR-58, DR-62, DR-63, DR-64, DR-68, DR-73（9） | ✅ **已完成**（2026-06-19 `update_jira.py --with-summary` live run：9 张标题+描述全部 `[OK]`） |
| 票未建（>DR-78） | DR-82, DR-134, DR-160（3） | ⏸ 延后，建时带 R2 文案（已写入 update CSV 备用） |

**C 类（新增，6 张）— ✅ 已建（2026-06-19 `create_jira.py`，实际 key DR-79..DR-84）**

| Ref | **实际 Jira key** | 处置 | 状态 |
|---|---|---|---|
| NEW-1 发布即打包(FR-A19) | **DR-79** | `mvp`+phase1+Highest（demo 关键路径） | ✅ 已建 |
| NEW-2 运行时依赖守卫(FR-A20) | **DR-80** | phase2 | ✅ 已建 |
| NEW-3 下载 API | **DR-81** | `mvp`+phase1+Highest（demo 关键路径） | ✅ 已建 |
| NEW-4 滥用控制(T-25) | **DR-82** | phase2 | ✅ 已建 |
| NEW-5 伪造/边界测试(T-23/24) | **DR-83** | phase2 | ✅ 已建 |
| NEW-6 onboarding（可选） | **DR-84** | phase2 | ✅ 已建 |

> ⚠️ **编号冲突（重要，团队对账须知）**：Jira 按项目下一个空号自动分配，项目现有到 DR-78，故这 6 张实际拿到 **DR-79..DR-84**。但 v2 规划文档（`skill_marketplace_v2_tickets.md` 及本表 A/B/D 节）里 **DR-79..DR-168 早已是另一批未导入票的纸面号**。两者从此**不再 1:1 对应**——本文档中所有 `> DR-78` 的号请一律视为**规划标签，而非 Jira key**。最易混的一处：纸面 **DR-82 = “Query-layer guard excluding instruction_template”**（B 类待改、且 DR-45/52/53/133 依赖它），现已与**实际 DR-82 = NEW-4 滥用控制**撞号。将来这批 rest 票真正建进 Jira 时会拿 **DR-85 起**的新号。
>
> 📍 **对账唯一真相表**：`Jira_V2/jira_key_map.md`（纸面号 ↔ 实际 key 映射；rest 票建一张回填一张）。引用任何 > DR-78 的号前，先经该表换算成实际 Jira key。

**D 类（作废/缩范围，5 张）**

| 票 | 状态 |
|---|---|
| DR-91, DR-133, DR-135, DR-137, DR-139（全 M11，均 >DR-78） | ⏸ 全部票未建，延后；建时直接带 R2 缩范围文案（已写入 update CSV 备用） |

**一句话对账（2026-06-19 收口）**：本轮已落地 **B 类 9 张更新 ✅ + C 类 6 张新增 ✅（DR-79..84，其中 DR-79/DR-81 进 MVP）**；其余 **B 类 3 张 + D 类 5 张共 8 张**因票尚未导入 Jira 而延后，待安全/NFR 阶段建票时一次带对文案，**避免“先建旧文案再改”**。遗留事项：纸面号 ↔ 实际 key 的映射表（见上方 ⚠️ 编号冲突）。

---

## A. 保留 / 直接复用（无需改动）— 后端机器

这些票描述与 R2 一致，无需改动。它们就是"删不掉的护城河"所在：真正干活在服务端。

| 范围 | 票 | 说明 |
|---|---|---|
| 数据基础 | DR-39, DR-40, DR-41, DR-42, DR-43, DR-44, DR-79, DR-80, DR-81, DR-83 | 表/枚举/错误码/索引不变；`skill_versions` 仍存模板（现在可随包发布） |
| Admin 供给 | DR-45, DR-46, DR-47, DR-48, DR-49, DR-50, DR-51, DR-84, DR-106, DR-107, DR-108, DR-109, DR-110, DR-114 | 创建/版本/发布/归档/审计不变；模板编辑仍 Super Admin |
| Relay 执行链 | DR-65, DR-66, DR-67, DR-69, DR-70, DR-71, DR-72 | snapshot/生命周期/use-time entitlement/出参/拦截/兼容/可用性不变 |
| 身份/计费完整性 | **DR-94**, DR-138 | JWT-only 身份在 R2 下更核心（防包内字段伪造，T-23）；租户隔离不变 |
| 路由/模型/配额 | DR-95, DR-96, DR-97, DR-98, DR-99, DR-100, DR-101, DR-102, DR-103, DR-104, DR-105 | 模型白名单/上下文/无状态单轮/事务边界/quota 全部不变 |
| 计费 | DR-79, DR-89, DR-90, DR-93, DR-122, DR-123, DR-124, DR-125 | 计费归因/无扣费规则/append-only/幂等/对账不变；只是归因到"运行者 credential" |
| 分析/看板 | DR-74, DR-75, DR-76, DR-77, DR-119, DR-126, DR-127, DR-128, DR-129, DR-130, DR-131, DR-132 | 不变（DR-73 见 B：加一个 entry_point 值） |
| Kids | DR-140, DR-141, DR-142, DR-143, DR-144, DR-145, DR-146, DR-147, DR-121 | 服务端 Kids 拦截在外部客户端模型下更重要，全部保留 |
| NFR/可靠性 | DR-148, DR-149, DR-150, DR-151, DR-152, DR-153, DR-154, DR-155, DR-156 | 不变（DR-149 限流是 T-25 凭证滥用的基础） |
| 发布/增长 | DR-157, DR-158, DR-159, DR-161, DR-162, DR-163, DR-164, DR-165, DR-166, DR-167, DR-168 | 不变（DR-160 见 B） |
| UX | DR-60, DR-61, DR-115, DR-116, DR-117, DR-118 | 组件/导航/可访问性不变 |
| 内容 | DR-87, DR-88, DR-85, DR-86, DR-111, DR-112, DR-113 | i18n/披露/Admin Preview 保留（Preview 仍是站内测试面） |

---

## B. 重定义（同一票，仅改描述/验收）— 最小改动

保留票号与 owner，只更新 Summary/验收文字。建议改动如下：

| 票 | 现描述 | R2 改为 |
|---|---|---|
| **DR-62** | Playground Skill Picker UI | **Skill 包运行时瘦客户端**：读 manifest + 模板，干活那步调公开路由 API，带运行者 credential；无 key 报 `AUTH_REQUIRED` 提示注册 |
| **DR-63** | Playground request contract | **公开路由 API 调用契约**：`Authorization: Bearer <runner key>` + `deeprouter.skill_id`/`skill_version_id`；不发可信身份/Kids 字段 |
| **DR-64** | Relay entry: accept skill_id and resolve identity | 同左 + 明确**暴露为公开路由/执行 API**，身份只从 credential 解析（已含 resolve identity，改动极小） |
| **DR-68** | Server-side instruction_template injection + provider call | **服务端路由/选模型 + provider call**：模板不再机密，但路由/选模型仍服务端权威；provider 凭证不出服务端 |
| **DR-53** | Skill detail API | 同左 + 返回 `requires_deeprouter_key: true` 与 download CTA；仍只回公开元数据 |
| **DR-55** | Enable Skill API | **Download Skill package**：下载记录写 `user_enabled_skills`；下载不授予永久执行权 |
| **DR-56** | Disable Skill API | **Remove from My Skills**：不影响已下载副本（运行时鉴权仍拦截） |
| **DR-58** | Skill Detail UI | 同左 + 运行时依赖文案（需 DeepRouter key）+ Download CTA |
| **DR-73** | Emit P0 lifecycle analytics events | 同左 + 新增 `entry_point=skill_package`；`playground_picker` 仅历史事件 |
| **DR-82** | Query-layer guard excluding instruction_template | **重定义为**：guard 排除 provider 凭证/路由逻辑/草稿模板（已发布模板允许返回，因随包分发） |
| **DR-134** | Output-leakage guard + safe refusal | **重定义**：守卫目标改为 provider 凭证/原始 payload，而非"隐藏模板"（模板已公开） |
| **DR-160** | Security regression suite | **重定义**：加 T-23 身份/计费伪造、T-24 运行时依赖完整性、T-25 凭证滥用、包内容边界；去掉"prompt 泄露"前提 |

---

## C. 新增（尽量少）— R2 独有能力

| 建议票 | 模块 | 说明 | 依赖 |
|---|---|---|---|
| NEW-1 | M02 | **发布即打包**：发布产出版本化 zip（manifest + 已发布模板 + 瘦客户端），钉到 `skill_version_id`，构建期校验不含 provider 凭证/路由逻辑（FR-A19） | DR-48 |
| NEW-2 | M02 | **运行时依赖构建期守卫**：校验包的干活步骤确实调 DeepRouter、不可离线跑（FR-A20，护城河前提 D-09） | NEW-1 |
| NEW-3 | M03 | **包下载 API** `GET /marketplace/skills/{id}/download`：返回版本化 zip，鉴权+entitlement，发 `skill_enabled`（download） | DR-53, NEW-1 |
| NEW-4 | M11/M12 | **公开路由 API 滥用控制**：按 credential 限流/异常检测/key 撤销/凭证共享检测（T-25） | DR-149, DR-64 |
| NEW-5 | M11 | **身份/计费伪造测试 + 包内容边界测试**（T-23/T-24）：包内字段不可伪造归因；包内无 provider 凭证/路由逻辑 | DR-94, NEW-1 |
| NEW-6（可选） | M14 | 下载/运行 onboarding 文案 + "如何获取 DeepRouter key"引导 | DR-88 |

> NEW-1/2/3 是真正必需的新工作；NEW-4/5 大部分可挂在 DR-149/DR-160/DR-138 下扩展，若不想新开票可并入。

---

## D. 作废 / 大幅重定义 — 放弃 prompt 保密的代价（B 选项的必然冲突）

这批是"少改 Jira"与"模板进 zip"唯一真正打架处。选 B 即接受以下重写：

| 票 | 现描述 | R2 处置 |
|---|---|---|
| **DR-91** | D-06 at-rest encryption for instruction_template | **大幅缩范围**：仅对草稿模板 + 敏感服务端配置（provider 凭证、路由逻辑）加密；已发布模板随包分发无需加密 |
| **DR-133** | Prompt-absence redaction layer | **重定义**：从"模板缺位"改为"provider 凭证/原始输入/PII/provider payload 缺位"；模板不再是脱敏对象 |
| **DR-135** | Prompt-extraction / jailbreak test corpus | **重定义**：从"提取隐藏模板"改为"提取 provider 凭证/原始 payload"；"模板是秘密"的前提作废 |
| **DR-137** | Admin prompt-access audit | **缩范围**：已发布模板公开，读取无需审计；仅保留对**编辑/版本创建/打包**的审计 |
| **DR-139** | Telemetry restricted-key rejection rules | **微调**：保留拒绝 raw input/PII/provider payload；`instruction_template` 从受限键移除（保留亦无害，纯卫生） |

---

## E. 一致性提醒

- 上游 PRD 已全部更新到 R2（`tasks/00`–`07` + `compliance/`）。本表是把那套口径落到票号。
- 真正执行 Jira 改动时，建议先动 B（改描述，零风险），再决定 C（新增）与 D（重定义/缩范围）。
- 若希望完全零 Jira 改动，唯一办法是回到 zip 模板方案的 **A 选项（瘦包装、核心留服务端）**；当前选定为 **B（完整模板进 zip）**，故 D 类冲突不可避免。
