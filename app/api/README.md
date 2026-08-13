# `new-api` 后端模块 (`app/api`)

## 一、项目概览

`app/api` 是 new-api 的 Go 后端主模块,提供统一的 AI API 网关(40+ 上游)、用户管理、计费、频率限制与管理面板。入口为 `main.go`,通过 `//go:embed web/dist` 嵌入前端产物。

- **模块路径**:`github.com/QuantumNous/new-api`
- **Go 版本**:1.25.1 (go.mod)
- **Workspace**:`go.work` 定义 `app/api` + `modules/relaykit` 两个模块

---

## 二、技术栈

| 类别 | 技术 |
|---|---|
| 语言 | Go 1.25.1 |
| Web 框架 | Gin |
| ORM | GORM v2 |
| 数据库 | SQLite / MySQL ≥ 5.7.8 / PostgreSQL ≥ 9.6 (三数据库同时支持) |
| 缓存 | go-redis + 内存缓存 |
| 认证 | JWT / WebAuthn(Passkeys) / OAuth(GitHub, Discord, OIDC) |
| 国际化 | go-i18n v2 (`en.yaml` / `zh-CN.yaml` / `zh-TW.yaml`) |
| 内部包 | `billingexpr`(表达式计费)、`cachex`(缓存抽象)、`perf_metrics`(性能指标) |

---

## 三、目录结构

```
app/api/
├── main.go              # 入口, go:embed web/dist
├── router/              # HTTP 路由注册(API / relay / dashboard / web)
│   ├── api-router.go    # API 路由
│   ├── relay-router.go  # 中继/代理路由
│   ├── web-router.go    # 管理面板路由
│   └── main.go          # Gin 引擎初始化
├── controller/          # 请求处理
├── service/             # 业务逻辑层
│   ├── billing*.go      # 计费与额度管理
│   ├── channel*.go      # 渠道选择与亲和性
│   ├── auth*.go         # 会话与令牌管理
│   └── codex*.go        # Codex 模型同步
├── model/               # GORM 数据模型与数据库访问
├── relay/               # AI API 中继核心
│   ├── channel/         # 40+ 上游渠道适配器(openai/ / claude/ / gemini/ / aws/ / deepseek/ 等)
│   ├── helper/          # 请求验证与转换
│   ├── common/          # 中继公共类型与常量
│   └── *.go             # handlers(chat / image / audio / video / rerank / responses / gemini / claude / websocket)
├── middleware/          # Gin 中间件(认证 / 审计 / CORS / 缓存 / 分发)
├── common/              # 公共工具(JSON 封装 / 加解密 / 数据库 / 缓存 / 音频 / 邮件)
├── setting/             # 配置管理(计费比率 / 模型 / 运营 / 系统 / 性能)
├── dto/                 # 数据传输对象(请求/响应结构体)
├── constant/            # 常量(API 类型 / 渠道类型 / 上下文键)
├── types/               # 类型定义(价格数据 / 线程安全 Map / Set)
├── i18n/                # 国际化(go-i18n, en / zh-CN / zh-TW)
├── oauth/               # OAuth 认证提供方实现
├── pkg/                 # 内部独立包
│   ├── billingexpr/     # 表达式计费引擎
│   ├── cachex/          # 缓存抽象层
│   └── perf_metrics/    # 性能指标收集
└── web/dist/            # 前端构建产物嵌入目录(go:embed, gitignored)
```

---

## 四、开发与构建

### 前置条件

- Go 1.25+
- Bun(前端构建)
- just(命令运行器,替代 makefile)

### 常用命令

| 命令 | 说明 |
|---|---|
| `just build-web` | 构建前端并将产物拷贝到 `app/api/web/dist/` (go:embed 方案 A) |
| `just start-api` | 后台启动 Go 开发服务器(`go run main.go &`) |
| `just dev-api` | 启动 Docker 开发环境(postgres 等) |
| `just dev-web` | 启动前端 Rsbuild 开发服务器(端口 5173) |
| `just dev` | 同时启动 `dev-api` + `dev-web` |
| `just test` | 运行全部 Go 测试(api + relaykit, GOWORK=off) |
| `just reset-setup` | 重置本地安装向导状态(PostgreSQL 或 SQLite) |

### Workspace 注意事项

`go.work` 将 `app/api` 与 `modules/relaykit` 放在同一 workspace:

- 根模块构建: `go build ./...` (自动使用 workspace)
- relaykit 独立构建验证: `cd modules/relaykit && GOWORK=off go build ./...` (relaykit 必须不依赖根模块)

---

## 五、架构分层

```
Router → Controller → Service → Model
```

- **Router**:注册路由组,挂载中间件,将请求分发到对应 Controller
- **Controller**:解析请求参数、校验输入、调用 Service、构造响应
- **Service**:核心业务逻辑(计费、渠道选择、模型同步、认证会话)
- **Model**:GORM 数据访问层,统一跨数据库操作(SQLite / MySQL / PostgreSQL)

### Relay 中继层

`relay/` 是中继代理的核心,负责:
- 40+ 渠道适配器(`relay/channel/`),每个适配器实现特定上游的协议转换
- 流式响应转发、重试、缓存计费统计
- 支持格式转换:OpenAI ↔ Claude / OpenAI → Gemini / Gemini → OpenAI

### 计费引擎

`pkg/billingexpr/` 实现表达式计费系统,支持分层定价、折扣、计费策略版本化。详细设计见 `app/api/pkg/billingexpr/expr.md`。

---

## 六、核心约定

> 完整规则见根目录 [`AGENTS.md`](../AGENTS.md) (Backend Rules 章节)。以下为关键摘要。

### JSON 处理

所有 JSON 序列化/反序列化必须通过 `common.Marshal` / `common.Unmarshal` 等包装函数,禁止直接调用 `encoding/json`。

### 数据库兼容

所有数据库操作必须同时支持 SQLite、MySQL ≥ 5.7.8、PostgreSQL ≥ 9.6:

- 优先使用 GORM 方法,避免裸 SQL
- 行锁使用 `model.lockForUpdate(tx)`(自动为 SQLite 跳过)
- 布尔值、保留字列名、方言差异通过 `common.UsingMainDatabase` / `commonGroupCol` 等统一处理

### 计费安全

- 所有用户可控的计费乘数(image n、video duration、max_tokens 等)必须在请求验证时设上限
- 额度转换使用 `common.QuotaFromFloat` / `QuotaRound` / `QuotaFromDecimal`,禁止 `int(float64 * ratio)` 裸转换
- 溢出饱和通过 `*Checked` 变体审计并记录到请求日志

### 国际化

后端 i18n 使用 go-i18n v2,语言文件位于 `i18n/locales/`:

- `en.yaml` (基础英文)
- `zh-CN.yaml` (简体中文)
- `zh-TW.yaml` (繁体中文)

控制器/中间件通过 `i18n.T()` 或 `i18n.Translate()` 获取翻译文本,支持请求级语言切换。

---

## 七、relaykit 独立模块

`modules/relaykit/` 是一个独立可构建的 Go 模块,提供协议转换核心能力:

- 模块路径: `github.com/QuantumNous/new-api/relaykit`
- 不得依赖根模块的任何包
- 修改后必须通过 `GOWORK=off go build ./...` 验证独立构建

---

## 八、前端 Embed 契约

`main.go` 使用 `//go:embed web/dist` 嵌入前端静态文件。因 `go:embed` 不能引用父目录,前端构建产物必须从 `app/web/dist/` 拷贝到 `app/api/web/dist/`:

- `just build-web` 执行拷贝
- Dockerfile 与 CI 工作流使用相同模式
- `app/api/web/dist/` 已在 `.gitignore` 中排除

---

## 九、测试

- 测试框架: `github.com/stretchr/testify` (require 用于 setup/致命断言,assert 用于非致命值检查)
- 风格:确定性表格驱动测试,显式输入与期望输出
- 验证范围:API 契约、计费不变量、数据库兼容性、回归路径
- 避免覆盖数字、烟雾测试、随机输入、sleep 依赖
- 关键测试文件: `app/api/relay/common/relay_utils_test.go`、`app/api/common/quota_math_test.go`、`app/api/relay/helper/openai_image_request_test.go`

---

## 更新日志

- **2026-08-13**:初始文档,对齐 `app/web/README.md` 规范格式。