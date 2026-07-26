# Skills 前端管理与内置技能包 — 设计文档

状态:已实施(P1–P3),§10 记录与本设计稿的差异。范围:GUI、server REST、内置技能包(含第三方捆绑)、市场接入、GUI 多语言(en/zh/vi)。不改动引擎侧已有的 SKILL.md 解析与渐进披露机制。

## 1. 现状

引擎侧已完备,管理面缺失:

| 层 | 现状 |
|---|---|
| 解析/加载 | `coworker/skills/base.py` — Anthropic SKILL.md 格式(YAML frontmatter: name / description / allowed-tools),渐进披露:启动只注入目录(name+description),`load_skill` 工具按需加载全文 |
| 发现目录 | `state_dir()/skills`(macOS/Linux: `~/.config/coworker/skills`,Windows: `%APPDATA%\coworker\skills`)+ `workspace/.coworker/skills`(`agent.py:_skill_dirs`) |
| REST | 仅只读 `GET /v1/skills`(`server/app.py:506`),且只扫全局目录,不含 workspace 层 |
| GUI | 零暴露(`surfaces/gui/src` 无任何 skill 相关代码) |
| Persona | manifest 已预留 `skills: list[str]` 字段(`personas/manifest.py:64`),尚未消费 |

对比:MCP 已有完整 GUI(Integrations → MCP servers,`ManageTabs.tsx` `McpTab`:JSON 粘贴添加、OAuth 预设、启停、删除、工具列表、Reload)。Skills 应对齐同等体验。

## 2. 参照 Codex 的设计要点

Codex(developers.openai.com/codex/skills)的可借鉴设计:

1. **多层发现**:REPO(`.agents/skills`,CWD 向上扫到 repo root)→ USER(`~/.agents/skills`)→ ADMIN(`/etc/codex/skills`)→ SYSTEM(随产品内置)。同名不合并,都展示并标注来源。
2. **显式 + 隐式两种触发**:`$skill` / `/skills` 显式提及;隐式靠 description 匹配。
3. **上下文预算**:初始技能列表最多占模型上下文 2%(未知时 8000 字符),超出先截断 description,再省略技能并警告。
4. **enable/disable 不删除**:config 里 `[[skills.config]] path/enabled=false`。
5. **skill-creator / skill-installer**:内置"创建技能"和"从 repo 安装技能"两个元技能。
6. **可选 UI 元数据**:`agents/openai.yaml`(display_name、icon、brand_color、`allow_implicit_invocation`、依赖声明)。

映射到本项目:1/4/5 直接采纳;2 中显式触发采用 Composer `$` 提及;3 作为防御性上限;6 暂不做(保持 SKILL.md 纯净,兼容性优先)。

## 3. 技能来源模型(四层)

```
BUILTIN   coworker/skills/builtin/<name>/SKILL.md   随 app 打包(package-data,同 personas/builtin 先例)
GLOBAL    state_dir()/skills/<name>/                用户自装(GUI 安装器写入这里)
WORKSPACE <workspace>/.coworker/skills/<name>/      随项目走,团队可入库
(禁用表)  state_dir()/skills.json                   {"disabled": ["name", ...]} — 禁用不删除
```

- `SkillLoader` 增加 builtin 目录扫描,优先级 BUILTIN < GLOBAL < WORKSPACE(同名后者覆盖,并在 UI 标注 "overrides built-in")。
- 每个 Skill 增加 `source: "builtin" | "global" | "workspace"` 与 `enabled` 字段。
- 禁用的 skill 不进入 catalog 注入,也不可被 `load_skill` 加载。

## 4. Server REST 设计(镜像 MCP 端点风格)

```
GET    /v1/skills?workspace=…         → {skills:[{name,description,source,path,enabled,overrides?}]}
POST   /v1/skills/install             → body {source:"path"|"git", path?|url?, subdir?}
                                        校验 SKILL.md frontmatter 后拷贝到 GLOBAL 目录
DELETE /v1/skills/{name}              → 仅 GLOBAL 可删;builtin/workspace 返回错误(builtin 只能 disable)
PATCH  /v1/skills/{name}              → {enabled:bool} 写 skills.json
POST   /v1/skills/reload              → 重扫目录(GUI "Reload" 按钮,行为同 /v1/mcp/reload)
GET    /v1/skills/{name}              → 详情:全文 instructions + 资源文件列表(详情抽屉用)
```

- git 安装复用系统 `git clone --depth 1` 到临时目录后拷贝 subdir;无 git 时报错提示。
- 安装校验:必须存在 `SKILL.md` 且 frontmatter 含 name/description;拒绝符号链接逃逸与路径穿越;含 `scripts/` 的技能在安装确认页显式警告(脚本执行仍受现有 shell 审批门控,无额外信任)。
- `manager.list_skills()` 改为接收 workspace 参数并返回完整元数据。

## 5. GUI 设计

### 5.1 Skills 管理页(Integrations 第三个 tab)

`IntegrationsView.tsx` 的 `IntTab` 增加 `"skills"`,新建 `SkillsTab`(模式抄 `McpTab`):

- **列表**:每行 name、description、来源徽标(Built-in / Global / Workspace)、启停 Toggle、溢出菜单(Reveal in Finder、Delete)。同名覆盖显示 "overrides built-in" 提示。
- **安装入口**:
  - "Add from folder…" — Tauri 文件夹选择器 → `POST /v1/skills/install {source:"path"}`
  - "Add from GitHub…" — 输入 repo URL(+ 可选子目录)→ `{source:"git"}`
  - **精选预设区**(同 `MCP_PRESETS` 模式):内置一个 `SKILL_PRESETS` 列表,一键从官方 repo 安装(见 §7 市场接入)
- **详情抽屉**:点击行展开,渲染 SKILL.md 全文(复用 `Markdown.tsx`)+ 资源文件树。

### 5.2 会话内可见性

- **Transcript**:`load_skill` 调用在 `humanizeTool` 中特判,渲染为 `Loaded skill: <name>` 徽标行(样式对齐 `StepRow` 现有 MCP 工具展示)。
- **Composer `$` 提及**(参照 Codex `$skill`):输入 `$` 弹出技能选择浮层(数据来自 `GET /v1/skills`),选中后在消息里附加显式指令 "Use the <name> skill"。第一期可降级为纯文本提示,不做浮层。

### 5.3 Persona 联动(第二期)

消费 `PersonaManifest.skills`:persona 详情页展示推荐技能,未安装的给一键安装按钮(同现在 MCP 推荐的 "Add" 交互,`PersonaView.tsx:161` 已有 `kind === "mcp"` 的先例,增加 `kind === "skill"`)。

## 6. 内置办公技能包(BUILTIN,含第三方捆绑)

定位:app 主打"交付真实办公产物",内置包以文档产出 + 办公流程为主。采取"第三方捆绑优先,许可缺口自研补齐"策略。

### 6.1 第三方捆绑(许可核查后打包)

只有许可明确允许再分发的技能才能进 DMG/安装包,按源分三档:

| 源 | 许可 | 结论 |
|---|---|---|
| anthropics/skills 示例区(Enterprise & Communication 等,如 internal-comms、brand-guidelines) | Apache 2.0 | **可捆绑**,保留 LICENSE + NOTICE,登记进 `THIRD-PARTY-LICENSES.md` |
| anthropics/skills 的 `docx` / `pdf` / `pptx` / `xlsx` 文档技能 | 专有(LICENSE.txt 明文禁止:提取到 Services 之外、复制、衍生、分发/再许可) | **不可捆绑,也不可进预设安装列表**(用户侧下载同样违反其 extraction 条款);文档产出能力由 §6.2 自研补齐 |
| openai/skills 精选 | 仓库无顶层 LICENSE(`license: null`,默认保留所有权利) | **暂不捆绑**;逐技能核查,出现明确开源许可的条目再纳入 |

捆绑流程:`vendor` 脚本(`packaging/vendor_skills.py`)按锁定的 commit 从上游拉取 → 校验 SKILL.md → 拷入 `coworker/skills/builtin/<name>/` 并保留原 LICENSE 文件 → CI 校验每个 builtin 第三方技能目录必须含允许再分发的许可文件,缺失即构建失败。升级 = 更新锁定 commit 重跑脚本。

### 6.2 自研办公包(补文档产出缺口)

第一批(建议 6 个,每个都是纯 SKILL.md 指令 + 可选轻量脚本,BoxAI 版权、MIT):

| 技能 | 内容 | 依赖 |
|---|---|---|
| `docx-report` | 结构化 Word 报告/提案产出(样式、目录、页眉) | `python-docx` |
| `xlsx-workbook` | 数据表/预算/图表 Excel 产出 | `openpyxl` |
| `pptx-deck` | 演示文稿产出(版式、母版、图文排布) | `python-pptx` |
| `pdf-deliverable` | 排版 PDF(报告/信函/单据);读取侧复用已有 pypdf/pypdfium2 | `reportlab` 或 HTML→PDF |
| `meeting-notes` | 会议纪要:从转写/聊天记录提炼决议、行动项,产出 docx + 可选日历跟进(联动 Google Calendar connector) | 无 |
| `weekly-report` | 周报/晨报:汇总 Slack/邮件/日历/GitHub 活动成文(联动已有 connectors,配合 automation 定时跑) | 无 |

工程注意:

- 脚本依赖进 `pyproject.toml` 新增 optional extra `office`,打包脚本(`packaging/build_dmg.sh` / `build_windows.ps1`)默认安装;许可须全部 MIT/BSD/Apache(排除 AGPL,同 pypdfium2 选型时的原则)。
- 内置技能可被用户 disable(§3 禁用表),不可删除。
- 内置包对上下文的占用受 §2.3 预算上限保护。

## 7. 市场接入

现状(2026):无统一市场 API,事实标准是 agentskills.io 的 SKILL.md 格式 + git repo 分发。生态:anthropics/skills(官方目录,示例 Apache 2.0)、openai/skills(Codex 精选)、skills.sh / SkillsMP(200 万+ GitHub 技能索引)、Agensi。

接入策略(不自建市场协议):

1. **通用 git 安装器**(§4 `POST /v1/skills/install {source:"git"}`)即可覆盖所有市场——市场页面最终都指向 GitHub repo。
2. **精选预设列表** `SKILL_PRESETS`:硬编码一批审核过的技能,一键安装,注明来源与许可。收录条件:来自官方仓库 + 许可允许用户侧获取(Anthropic 专有文档技能因 extraction 条款排除,见 §6.1)。这一层等价于"应用内小市场",可通过版本更新迭代。
3. 不做第三方市场的动态 API 对接(SkillsMP 等无稳定安装协议,且未审核技能有 prompt-injection 供应链风险);未来若 agentskills.io 出注册中心标准再评估。

安全基线:安装确认页展示 frontmatter 与是否含脚本;技能指令视为不可信输入,现有审批门控(shell/写操作/发送)不因技能而放宽。

## 8. GUI 多语言(en / zh / vi)

现状:desktop GUI(`surfaces/gui/src`)全部英文硬编码,无任何 i18n 框架;主站 `web/default` 已有成熟约定(i18next + react-i18next,扁平 JSON,英文原文作 key)。桌面端对齐主站方案,首批三种语言:**en(基准)、zh、vi**。

### 8.1 技术方案

- 依赖:`i18next` + `react-i18next` + `i18next-browser-languagedetector`(与 `web/default` 同栈,复用团队心智与 CLI 工具链思路)。
- 目录:`surfaces/gui/src/i18n/locales/{en,zh,vi}.json`,扁平 JSON,key 为英文原文;`en.json` 为恒等映射,fallback 链 `vi/zh → en`。
- 组件内 `useTranslation()` + `t('English key')`,覆盖全部视图:Sidebar、Composer、Transcript(含 `humanizeTool` 的工具行文案与 "Loaded skill" 徽标)、Approval/Inbox、Integrations(Connectors/MCP/Skills 三个 tab)、Settings、Onboarding、Scheduled、Personas。
- 语言选择:默认 languagedetector 跟随系统语言,SettingsView 增加语言下拉(en/中文/Tiếng Việt),选择持久化到 localStorage;切换即时生效,无需重启。
- Tauri 层少量原生字符串(窗口菜单、托盘)从 `tauri.conf.json`/Rust 侧读取同一份语言偏好(通过已有的 GUI↔shell 桥接传递)。
- 服务端返回的用户可见错误信息:GUI 层按 error code 映射翻译,不在 Python 端做 i18n(server 保持英文,GUI 兜底显示原文)。

### 8.2 Skills 相关的本地化

- SKILL.md 保持英文单语(兼容 agentskills.io 规范与第三方生态,不发明多语 frontmatter)。
- 内置技能(§6)的名称/描述在 GUI 层本地化:locale JSON 中维护 `skill:<name>:description` 词条,列表页优先显示本地化描述,详情抽屉展示原文。第三方捆绑技能不翻译正文,仅可加一句本地化简介。
- 模型输出语言无需处理:引擎会跟随用户输入语言作答。

### 8.3 工程约束

- 新增/修改 GUI 组件一律 `t()` 包裹用户可见文案,vitest 增加"无裸英文字符串"的抽查用例(关键视图快照)。
- zh/vi 翻译缺失时构建不阻塞,fallback 到英文;提供 `npm run i18n:check` 脚本报告缺失 key(对齐 `web/default` 的 `i18n:sync` 思路)。

## 9. 实施分期

| 期 | 内容 |
|---|---|
| P1 | SkillLoader 补 builtin 目录 + source/enabled 元数据;REST 全套;SkillsTab(列表/启停/删除/文件夹安装);Transcript `load_skill` 徽标;**i18n 框架落地 + Settings 语言切换 + Skills/Integrations/Settings 视图三语覆盖** |
| P2 | git 安装器 + `SKILL_PRESETS` 精选区;详情抽屉;第三方捆绑管线(`vendor_skills.py` + CI 许可校验)+ Apache 2.0 技能首批入包;自研办公包前 3 个(docx/xlsx/pptx);**其余视图三语覆盖(Sidebar/Composer/Transcript/Approval/Onboarding)** |
| P3 | Composer `$` 提及浮层;Persona skills 联动;办公包后 3 个;catalog 上下文预算上限;**内置技能描述本地化 + `i18n:check` 工具 + Tauri 原生菜单三语** |

测试:server 侧 pytest(install 校验/禁用表/分层覆盖/vendor 许可校验),GUI 侧 vitest + e2e(SkillsTab CRUD 流,模式抄 `McpTab` 现有 e2e;语言切换 e2e 断言关键视图渲染三语)。

## 10. 落地差异(as implemented)

| 设计稿 | 实际实现 |
|---|---|
| §5.1 硬编码 `SKILL_PRESETS` 精选区 | 改为接入 skills.sh 搜索 API(`coworker/skills/market.py`)+ GitHub raw 下载,`POST /v1/skills/install {source:"market", id}`;GUI 为 "Browse marketplace…" 搜索面板,免装 git/node |
| §4 `source: "path"|"git"` | 增加 `"market"`;git 安装同样走 GitHub API 抓取,不依赖本地 git |
| §5.3 persona 联动放 `recommends` | 独立 `skills` 段:`GET /v1/personas/{id}` 返回 `skills:[{name,installed}]`,PersonaView 渲染 "Recommended skills",未安装跳 Connectors ▸ Skills |
| §6.1 捆绑 `brand-guidelines` | 该技能内容强绑 Anthropic 品牌,换成 `theme-factory`;实际捆绑 `internal-comms`、`theme-factory`、`skill-creator`(均 Apache-2.0,保留 LICENSE.txt) |
| §8.1 `en.json` 恒等映射 | en 不落地资源文件:key 即英文原文,缺失即回落到 key;`fallbackLng: false` |
| §8.2 `skill:<name>:description` 词条 | 未实现:内置技能描述保持英文原文,避免翻译与 SKILL.md 正文不一致 |
| §8.1 Tauri 原生菜单三语 | 未实现:原生菜单项极少,仍为英文 |
| §8.3 "无裸英文字符串"抽查用例 | 改为 `npm run i18n:check`(`scripts/i18n-check.mjs`):校验代码里的 `t()` key 与各 locale 文件双向一致,缺失或残留即失败 |
| §5.1 Skills 只作为 Connectors 的三级 tab | 左侧主导航新增 `Skills` 行(`nav-skills`,账户菜单同步加一项),深链到 Connectors ▸ Skills,`IntegrationsView` 接受 `initialTab` |
| 列表平铺 | 按来源分组:Included with the app(预装)/ Installed by you / From this workspace |
| §7.2 精选预设 | 落为 `GET /v1/skills/recommended`(`coworker/skills/recommend.py`):5 个审阅过的 Apache-2.0 技能(canvas-design、frontend-design、web-artifacts-builder、webapp-testing、mcp-builder),按锁定 commit 一键安装;已安装的自动从推荐区消失,不随包分发 |

覆盖到的测试:`tests/test_skills.py`、`tests/test_skills_install.py`、`tests/test_persona_connections.py`(persona skills 段);GUI `src/components/SkillsTab.test.tsx`(分层标签/启停 PATCH/中文渲染)、`e2e/skills.spec.ts`(列表、详情、GitHub + 市场安装、Composer `$` 提及)。
