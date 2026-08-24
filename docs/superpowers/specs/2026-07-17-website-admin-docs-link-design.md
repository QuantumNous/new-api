# 官网后台统一文档链接设计

日期：2026-07-17

状态：设计已由用户确认，等待实施计划
目标系统：NewAPI 后台配置、Flatkey 独立官网 `website/`

## 1. 背景与现状

后台已经存在唯一的文档地址配置 `general_setting.docs_link`：

- 管理员可在系统设置中编辑“文档链接”。
- Go 后端通过公开接口 `/api/status` 的 `data.docs_link` 返回该值。
- 已登录控制台的顶部文档入口已经读取该字段。

独立 Next.js 官网 `website/` 当前没有读取 `docs_link`，官网顶部导航和页脚也没有文档入口。因此，管理员在后台修改文档地址时，官网不会随之变化。

## 2. 目标

1. 继续使用现有 `general_setting.docs_link`，不新增第二个文档配置。
2. 让控制台文档入口、官网顶部导航和官网页脚共享同一个后台配置值。
3. 后台保存新地址后，各官网实例在最多约 60 秒内使用新地址。
4. 后台地址为空时，官网顶部和页脚都隐藏文档入口。
5. 官网文档链接在新标签页打开，并带安全的 `rel` 属性。
6. 后台不可用或返回无效地址时，不影响官网其他内容渲染。

## 3. 非目标

- 不新增数据库字段、迁移或后台表单项。
- 不新增专用 `/api/website/settings` 接口；继续复用公开的 `/api/status`。
- 不改变控制台现有文档入口的读取逻辑。
- 不在 Flatkey 官网内建设或托管文档内容。
- 不在本次范围内重写控制台页脚遗留的上游 NewAPI 链接。
- 不把文档地址硬编码为某个 Flatkey 或第三方文档域名。

## 4. 已确认的产品决策

- 配置来源：现有后台“文档链接”配置。
- 官网位置：桌面端和移动端顶部导航，以及官网页脚。
- 空值行为：隐藏官网顶部和页脚的文档入口。
- 更新时效：最多约 60 秒。
- 跳转方式：新标签页打开。
- 失败行为：隐藏入口，官网页面继续正常显示。

## 5. 架构与数据流

```text
管理员保存“文档链接”
  -> general_setting.docs_link
  -> GET {APP_CONSOLE_ORIGIN}/api/status
  -> data.docs_link
  -> 官网服务端配置读取模块（60 秒缓存）
  -> 当前根 layout 单次读取
  -> SiteConfigProvider 下传同一规范化值
     -> SiteHeader 顶部文档入口
     -> SiteFooter 页脚文档入口（包括不经过 SiteShell 的 EDM 页面）

同一个 general_setting.docs_link
  -> 现有控制台顶部文档入口（保持现状）
```

官网不直接访问数据库，也不复制后台配置。`APP_CONSOLE_ORIGIN` 继续作为官网访问 Go 控制台服务的唯一 origin 来源。

## 6. 组件设计

### 6.1 官网配置读取模块

在 `website/src/lib/` 新增一个只负责公开站点配置读取的模块，职责包括：

1. 请求 `${APP_CONSOLE_ORIGIN}/api/status`。
2. 使用 `next: { revalidate: 60 }` 缓存公开响应。
3. 解析 `{ success, data: { docs_link } }` 响应形状。
4. 规范化并校验文档地址。
5. 返回 `string | null`，不向页面抛出上游异常。

地址规范化规则：

- 非字符串、空字符串或仅包含空白字符时返回 `null`。
- 去除首尾空白后使用 `URL` 解析。
- 只接受 `http:` 和 `https:` 协议。
- `javascript:`、`data:`、相对路径和无法解析的字符串均返回 `null`。

请求使用 3 秒超时，避免控制台服务异常拖慢整页渲染。超时、非 2xx、`success !== true`、响应形状错误或 JSON 解析失败时统一返回 `null`。

### 6.2 根 layout 与 `SiteConfigProvider`

英文和本地化根 layout 在服务端读取一次文档地址，并把同一个规范化值传给 `RootDocument`。`RootDocument` 通过轻量的 `SiteConfigProvider` 向所有页面外壳提供：

- `SiteHeader` 顶部导航
- `SiteFooter` 页脚链接

这样顶部和页脚不会各自发起请求，也不会出现两个入口使用不同值的情况；同时覆盖直接使用 `SiteFooter`、不经过 `SiteShell` 的 EDM 落地页。

### 6.3 `SiteHeader`

`SiteHeader` 从 `SiteConfigProvider` 读取 `docsUrl`，并在非空时向现有 `navItems` 添加“文档”项：

- 桌面导航和移动导航复用同一个项目。
- 导航顺序位于“模型”之后、“使用场景”之前。
- 链接为外部链接，不经过 `localizePath()`。
- 使用 `target="_blank"`。
- 使用 `rel="noopener noreferrer"`。

`docsUrl` 为空时不生成该导航项。

### 6.4 `SiteFooter`

`SiteFooter` 从 `SiteConfigProvider` 读取 `docsUrl`，并在非空时增加“文档”链接。该链接与顶部使用完全相同的地址、新标签页行为和安全属性，入口放在底部版权链接行中，位于服务条款等法务链接之前。

该链接不加入法务页面的 `localizePath()` 处理，因为目标由后台完整 URL 决定。`docsUrl` 为空时不渲染占位符或禁用状态。

### 6.5 国际化

在官网 `copy.ts` 的导航文案中增加 `docs`，覆盖现有 10 种 locale：

- en: Documentation
- zh: 文档
- es: Documentación
- fr: Documentation
- pt: Documentação
- ru: Документация
- ja: ドキュメント
- vi: Tài liệu
- de: Dokumentation
- id: 当前按仓库的 staged locale 规则回退为英文 Documentation

顶部和页脚复用同一个本地化标签来源，避免重复维护。

## 7. 缓存与多实例行为

- 每个 `newapi-web` 实例使用 Next.js 的 60 秒 revalidation 获取配置。
- 不要求各官网实例在同一毫秒切换；所有实例最多约 60 秒后最终一致。
- Go 控制台仍使用现有数据库配置加载与多节点同步机制，本功能不引入进程内写状态。
- 官网配置读取是只读的，不产生数据库写入或跨节点锁需求。

## 8. 错误与降级行为

| 场景 | 官网行为 |
| --- | --- |
| 后台返回有效 HTTP(S) 地址 | 顶部和页脚显示文档入口 |
| 后台配置为空 | 两个入口均隐藏 |
| 后台返回非法或危险协议 | 两个入口均隐藏 |
| `/api/status` 超时或不可用 | 两个入口均隐藏，页面其他部分正常 |
| 响应不是预期 JSON 形状 | 两个入口均隐藏 |
| 管理员修改地址 | 各官网实例最多约 60 秒后使用新值 |

失败不显示错误横幅，也不回退到 `docs.newapi.pro`、官网首页或本地 `/docs`，避免把用户带到错误目标。

## 9. 测试与验证

### 9.1 单元测试

1. 有效 `https://` 地址被保留。
2. 有效 `http://` 地址被保留。
3. 地址首尾空白被移除。
4. 空值、非字符串、相对路径和非法 URL 返回 `null`。
5. `javascript:` 与 `data:` 地址返回 `null`。
6. 接口超时、非 2xx、失败 envelope 和错误 JSON 返回 `null`。
7. 请求使用 `APP_CONSOLE_ORIGIN` 和 60 秒 revalidation。

### 9.2 组件测试

1. 有地址时，桌面顶部、移动顶部和页脚都渲染“文档”。
2. 三个可见入口使用同一个 `href`。
3. 所有入口包含 `target="_blank"` 与 `rel="noopener noreferrer"`。
4. 地址为空时，顶部和页脚均不渲染文档入口。
5. 10 种 locale 都包含非空的文档文案。

### 9.3 工程验证

- `bun test`，并单独确认新增测试全部通过。
- `bun run typecheck`。
- `bun run lint`。
- `bun run build`。
- `git diff --check`。

基线说明：创建自最新 `origin/main` 的工作区中，当前官网测试为 157 通过、2 失败；失败均为既有 perf-metrics 代理测试对 `group=all` 的断言，与本功能无关。最终验证必须明确区分这些基线失败与本功能新增失败。

## 10. 发布影响

- Router deploy：不需要。
- `newapi-console`：不需要代码部署；继续提供现有 `/api/status` 和后台配置。
- `newapi-web`：需要部署，官网代码变更仅在该服务中生效。
- 数据库迁移：不需要。
- Terraform / Cloudflare：不需要。
- 新增环境变量：不需要，复用现有 `APP_CONSOLE_ORIGIN`。

部署后由管理员在现有后台“文档链接”中设置公开文档 URL。最多约 60 秒后检查官网桌面导航、移动导航和页脚是否使用同一地址。

## 11. 风险与缓解

| 风险 | 缓解措施 |
| --- | --- |
| 控制台状态接口异常拖慢官网 | 3 秒请求超时；失败返回 `null`，页面继续渲染 |
| 后台误填危险协议 | 只接受 HTTP(S) |
| 官网多个入口出现不同地址 | 根 layout 每次渲染只读取一次，并通过 `SiteConfigProvider` 下传同一个值 |
| 多个官网实例短时间显示不同配置 | 60 秒 revalidation，接受短暂最终一致 |
| 后端响应结构变化 | 使用窄类型解析；形状不符时安全隐藏 |
| 新增文案遗漏 locale | 扩展现有 copy 完整性测试覆盖全部 10 种语言 |

## 12. 完成标准

当且仅当以下条件全部满足，本功能视为完成：

- 后台仍只有一个 `general_setting.docs_link` 配置。
- 官网顶部桌面导航、移动导航和页脚都读取该配置。
- 三个官网入口始终使用同一规范化 URL。
- 空值、非法地址和后台异常时入口安全隐藏。
- 有效地址在新标签页打开并包含安全 `rel`。
- 后台更新在最多约 60 秒内反映到各官网实例。
- 新增测试、类型检查、Lint 和官网构建通过。
- 发布说明明确仅需部署 `newapi-web`，不需要 Router、数据库或基础设施变更。
