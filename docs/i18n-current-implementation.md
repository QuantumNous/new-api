# new-api i18n 技术说明

本文基于 2026-04-22 仓库代码现状，说明项目当前前后端国际化（i18n）的实现方式、运行链路和已知限制。它描述的是“现在是怎么工作的”，不是重构方案。

## 1. 总体设计

这个项目的前后端 i18n 是两套独立系统：

| 维度 | 后端 | 前端 |
| --- | --- | --- |
| 目录 | `i18n/` | `web/src/i18n/` |
| 库 | `github.com/nicksnyder/go-i18n/v2` | `i18next` + `react-i18next` + `i18next-browser-languagedetector` |
| 资源格式 | YAML | JSON |
| Key 设计 | 语义化 message id，例如 `common.invalid_params` | 直接使用中文文案作为 key，例如 `t('语言偏好已保存')` |
| 语言范围 | `zh-CN`、`zh-TW`、`en` | `zh-CN`、`zh-TW`、`en`、`fr`、`ru`、`ja`、`vi` |
| 主要用途 | API 成功/失败消息、鉴权/中间件错误、服务端返回文本 | React 页面文案、按钮/提示文案、部分工具函数输出 |

这意味着：

1. 前端和后端不共享同一套翻译 key。
2. 前端可选语言比后端更多，二者语言覆盖范围并不对齐。
3. “用户语言偏好”是前后端之间唯一的显式同步点，存储在用户 `setting` JSON 中的 `language` 字段里。

## 2. 后端 i18n 实现

### 2.1 初始化与资源加载

后端入口在 `main.go` 中：

1. 应用启动后调用 `i18n.Init()`。
2. 若初始化失败，只记日志，不阻塞服务启动。
3. 初始化成功后，把 `common.TranslateMessage` 指向 `i18n.T`，供 `common.ApiErrorI18n` / `common.ApiSuccessI18n` 等通用响应函数调用。
4. 同时注册 `i18n.SetUserLangLoader(model.GetUserLanguage)`，让 i18n 层可以按用户 ID 懒加载语言偏好。

核心代码在 `i18n/i18n.go`：

1. 使用 `embed.FS` 把 `i18n/locales/*.yaml` 打进二进制。
2. `go-i18n` 的 bundle 在启动时一次性加载：
   - `i18n/locales/zh-CN.yaml`
   - `i18n/locales/zh-TW.yaml`
   - `i18n/locales/en.yaml`
3. 预创建三个 `Localizer`，减少请求期重复构造。

注意两个默认值：

1. `bundle := i18n.NewBundle(language.Chinese)` 以中文语言对象初始化 bundle。
2. 运行期自定义默认语言 `DefaultLang = en`，即不支持或无法识别时最终回退到英文。

### 2.2 翻译资源组织

后端翻译资源是扁平 YAML，key 以模块名前缀分组，例如：

```yaml
common.invalid_params: "无效的参数"
token.quota_exceed_max: "额度值超出有效范围，最大值为 {{.Max}}"
```

对应的 key 常量集中在 `i18n/keys.go`，例如：

```go
const MsgInvalidParams = "common.invalid_params"
const MsgTokenQuotaExceedMax = "token.quota_exceed_max"
```

这样做的目的：

1. 业务代码避免直接写字符串 key。
2. 翻译 key 有稳定语义，不依赖具体中文文案。
3. 支持模板参数，例如 `{{.Max}}`、`{{.Error}}`。

### 2.3 运行时调用链

后端标准调用链如下：

```text
Controller / Middleware
  -> common.ApiErrorI18n / common.ApiSuccessI18n
  -> common.TranslateMessage
  -> i18n.T(c, key, args...)
  -> i18n.GetLangFromContext(c)
  -> i18n.Translate(lang, key, args...)
  -> go-i18n Localizer.Localize(...)
```

常见使用方式：

```go
common.ApiErrorI18n(c, i18n.MsgInvalidParams)
common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
common.ApiSuccessI18n(c, i18n.MsgUpdateSuccess, nil)
```

如果翻译缺失，`Translate` 会直接返回 key 本身，而不是报错。

### 2.4 语言判定优先级

后端真正用于翻译的语言解析逻辑在 `i18n.GetLangFromContext`，优先级如下：

1. `ContextKeyUserSetting` 中已加载的用户设置。
2. 使用用户 ID 懒加载用户语言：`i18n.SetUserLangLoader(model.GetUserLanguage)`。
3. `ContextKeyLanguage`，即 i18n 中间件写入的语言。
4. 请求头 `Accept-Language`。
5. 默认英文 `en`。

这比 `middleware.I18n()` 本身更重要。原因是：

1. `main.go` 中 `server.Use(middleware.I18n())` 早于 session 和鉴权中间件执行。
2. 因此全局 i18n 中间件运行时，很多请求还没有把用户设置放进 context。
3. 真正调用 `i18n.T` 时，`GetLangFromContext` 会再次检查 context 和用户 ID，并且可以懒加载数据库/缓存中的语言偏好。

换句话说：

1. `middleware.I18n()` 负责尽早给匿名请求准备一个基于 `Accept-Language` 的初始语言。
2. `GetLangFromContext()` 才是最终裁决者，确保登录用户的持久化偏好能覆盖请求头。

### 2.5 `Accept-Language` 的解析方式

后端 `ParseAcceptLanguage` 是一个简化实现：

1. 只取 header 中第一个语言标签。
2. 去掉 `;q=...` 质量因子。
3. 再调用 `normalizeLang` 归一化。

这不是完整的 RFC 解析器，意味着：

1. 不会比较多个候选语言的权重。
2. 如果第一个语言标签不受支持，就直接回退到英文，而不会继续尝试第二个候选项。

例如：

```text
Accept-Language: fr-CA,zh-CN;q=0.9
```

当前实现会把 `fr-CA` 归一化后回退为 `en`，不会进一步命中 `zh-CN`。

### 2.6 语言归一化与支持范围

后端 `normalizeLang` 的逻辑非常明确：

1. `zh-tw`、`zh-hant`、`zh-hk` 等归一为 `zh-TW`。
2. 其他 `zh*` 归一为 `zh-CN`。
3. `en*` 归一为 `en`。
4. 其他任何语言一律回退到 `en`。

因此后端当前只真正支持三种语言：

1. `zh-CN`
2. `zh-TW`
3. `en`

### 2.7 用户语言偏好的存储与读取

用户语言偏好不单独建表，而是放在用户表的 `setting` 文本字段中。

相关结构：

1. `model.User.Setting string`
2. `dto.UserSetting.Language string`

相关流程：

1. `model.User.GetSetting()` / `SetSetting()` 负责把 `setting` JSON 转为 `dto.UserSetting`。
2. `model.UserBase.GetSetting()` 负责缓存结构上的同样操作。
3. `model.GetUserLanguage(userId)` 从缓存或数据库取用户，再返回 `GetSetting().Language`。
4. `controller.UpdateSelf` 特殊处理 `/api/user/self` 中的 `language` 字段更新。

也就是说，语言偏好和其他个性化设置共用一个 JSON 容器。

### 2.8 后端对 API 返回语言的影响

只要接口使用的是 `common.ApiErrorI18n` / `common.ApiSuccessI18n` 或直接调用 `i18n.T`，它的返回文案就会受当前解析出的语言影响，包括：

1. 用户相关接口错误消息。
2. 令牌、兑换码、配置等常规接口返回。
3. 鉴权中间件产生的部分错误。
4. relay / distributor 中部分面向 API 的错误提示。

但要注意：

1. 并不是所有返回都一定经过 i18n 封装。
2. 若 `i18n.Init()` 失败，系统仍然启动，但此时会退化为直接返回 key。

## 3. 前端 i18n 实现

### 3.1 初始化方式

前端初始化入口在 `web/src/i18n/i18n.js`，特点如下：

1. 所有语言资源在构建时直接静态导入，不做运行时按需拉取。
2. 使用 `LanguageDetector` 做初始语言探测。
3. `supportedLngs` 来自 `web/src/i18n/language.js`。
4. `fallbackLng` 配置为 `en`。
5. `load: 'currentOnly'`，只加载当前语言，不做层级回退链扩展。
6. `nsSeparator: false`，把 key 当普通文本，不把 `:` 当 namespace 分隔符。

前端支持的语言列表是：

1. `zh-CN`
2. `zh-TW`
3. `en`
4. `fr`
5. `ru`
6. `ja`
7. `vi`

### 3.2 翻译资源结构

前端资源文件位于 `web/src/i18n/locales/*.json`，其结构是：

```json
{
  "translation": {
    "语言偏好已保存": "Language preference saved",
    "{{count}} 项操作_other": "{{count}} actions"
  }
}
```

这里的几个关键点：

1. 顶层 namespace 是 `translation`。
2. key 直接使用中文原文，而不是语义化 id。
3. 复数形式使用 i18next 标准后缀，例如 `_one`、`_other`。

这也是为什么 `web/i18next.config.js` 里显式关闭了 `nsSeparator` 和 `keySeparator`，否则中文句子中的符号可能被错误解释。

### 3.3 组件中的使用方式

主流用法是：

```jsx
const { t, i18n } = useTranslation();
return <span>{t('语言偏好')}</span>;
```

项目里也存在两类补充用法：

1. 在 React 组件外使用全局 `i18next.t(...)`，如 `web/src/helpers/render.jsx`。
2. 使用带 `count` 的复数翻译，例如 `t('{{count}} 项操作', { count })`。

这套设计的优点是组件书写直观，缺点是：

1. 中文原文一旦改动，就等于修改了 key。
2. 文案重构会影响所有语言文件。

### 3.4 语言归一化

前端 `normalizeLanguage` 负责把多种浏览器语言表达归一化：

1. `zh`、`zh-cn`、`zh-sg`、`zh-Hans*` 归一为 `zh-CN`。
2. `zh-tw`、`zh-hk`、`zh-mo`、`zh-Hant*` 归一为 `zh-TW`。
3. 与 `supportedLanguages` 大小写无关地匹配。
4. 未匹配时返回原始规范化值，最终再由 i18next 的 `fallbackLng: 'en'` 兜底。

前后端这里有一个明显区别：

1. 前端保留了 `fr`、`ru`、`ja`、`vi` 等语言。
2. 后端对这些语言会直接回退成英文。

### 3.5 前端运行时语言优先级

前端运行时实际优先级不是单靠 `LanguageDetector` 决定，而是由多个地方叠加形成：

1. 登录后，如果 `user.setting.language` 存在，则优先使用用户设置。
2. 否则读取 `localStorage.i18nextLng`。
3. 再不行才落回 `LanguageDetector` 的默认探测结果。
4. 最后由 `fallbackLng = 'en'` 兜底。

这个优先级是由两个组件共同完成的：

1. `web/src/context/User/index.jsx`
   - 监听 `state.user.setting`
   - 解析其中的 `language`
   - 调用 `i18n.changeLanguage(...)`
   - 同步写回 `localStorage.i18nextLng`
2. `web/src/components/layout/PageLayout.jsx`
   - 在页面初始化和用户设置变更时再次执行同样的优先级判断
   - 保证刷新页面、切路由后语言仍能恢复

从实现上看，这两处有一定重复，但目的明确：把“用户设置”和“本地缓存”尽量保持一致。

### 3.6 用户切换语言时的同步链路

前端语言切换入口主要有两个：

1. 顶栏语言切换：`web/src/hooks/common/useHeaderBar.js`
2. 个人偏好设置：`web/src/components/settings/personal/cards/PreferencesSettings.jsx`

二者策略基本一致：

1. 立即调用 `i18n.changeLanguage(lang)`，先让 UI 立刻切换。
2. 立即写入 `localStorage.i18nextLng`，保证刷新后仍生效。
3. 如果用户已登录，调用 `PUT /api/user/self`，把 `language` 持久化到后端。
4. 接口成功后，更新 `UserContext` 和 `localStorage.user` 中保存的用户 setting。
5. 如果接口失败，则回滚到切换前语言。

这是一种“先乐观更新 UI，再异步持久化”的做法，交互上很顺畅。

### 3.7 Semi UI 组件库语言同步

前端在 `web/src/index.jsx` 里通过 `SemiLocaleWrapper` 同步 Semi UI 的 locale：

```jsx
const semiLocale = ({ zh: zh_CN, en: en_GB })[i18n.language] || zh_CN;
```

当前实际效果是：

1. `en` 使用 `en_GB`。
2. `zh-CN`、`zh-TW` 由于 key 不匹配 `zh`，最终都会落到默认值 `zh_CN`。
3. `fr`、`ru`、`ja`、`vi` 也都会落到 `zh_CN`。

这意味着：

1. 项目自身 React 文案可以显示法语、俄语、日语、越南语。
2. 但 Semi UI 组件内部自带文本目前只有英文和中文同步，且非英文时都会回到中文。

这是当前实现中的一个重要限制。

### 3.8 前端请求与 `Accept-Language`

前端 Axios 实例在 `web/src/helpers/api.js` 中只显式设置了：

1. `New-API-User`
2. `Cache-Control: no-store`

项目代码没有手工往 Axios header 中注入 `Accept-Language`。因此：

1. 浏览器发请求时若自动带上 `Accept-Language`，后端就能读取到。
2. 登录后后端又会优先使用用户 `setting.language`，因此请求头不是唯一来源。

也就是说，前端并没有实现“把当前 i18n.language 强制写进每个 API 请求头”的逻辑。

### 3.9 前端 i18n 工具链

前端 i18n 维护依赖 `i18next-cli`，脚本在 `web/package.json` 中：

1. `bun run i18n:extract`
2. `bun run i18n:status`
3. `bun run i18n:sync`
4. `bun run i18n:lint`

配置在 `web/i18next.config.js`，关键点：

1. 扫描 `src/**/*.{js,jsx,ts,tsx}`。
2. 忽略 `src/i18n/**/*`。
3. 输出到 `src/i18n/locales/{{language}}.json`。
4. `sort: true`，提取后按 key 排序。
5. `removeUnusedKeys: false`，不会自动删未引用 key。
6. `mergeNamespaces: true`，所有结果并到同一 JSON 命名空间。

这说明前端翻译资源是“代码驱动提取”的，而不是完全手工维护。

## 4. 前后端联动关系

### 4.1 初次访问，未登录用户

链路如下：

```text
浏览器语言 / localStorage
  -> i18next 选择前端界面语言
  -> 浏览器请求 API
  -> 后端读取 Accept-Language
  -> API 返回对应语言的消息（仅限后端支持的三种语言）
```

此时：

1. 前端页面语言可能是 `fr` / `ru` / `ja` / `vi`。
2. 后端 API 消息若无法识别该语言，则会回到 `en`。

### 4.2 登录用户切换语言

链路如下：

```text
用户在前端选择语言
  -> i18next.changeLanguage(lang)
  -> localStorage.i18nextLng = lang
  -> PUT /api/user/self { language: lang }
  -> 后端写入 user.setting.language
  -> 后续请求优先使用用户持久化语言
```

结果是：

1. 同一账号跨设备登录时，前端可以从 `user.setting.language` 恢复语言偏好。
2. 后端 API 返回也会尽量跟随该语言。
3. 但只有 `zh-CN` / `zh-TW` / `en` 能真正影响后端消息语言。

## 5. 当前实现的关键限制

### 5.1 前后端支持语言不一致

前端支持 7 种语言，后端只支持 3 种。因此：

1. 用户把语言切到 `fr`、`ru`、`ja`、`vi` 时，前端界面可以本地化。
2. 后端接口消息仍会回退到英文。

### 5.2 前后端 key 体系不一致

当前设计是：

1. 后端用语义 key。
2. 前端用中文原文 key。

这让前后端难以复用翻译资产，也增加了统一术语维护成本。

### 5.3 `Accept-Language` 解析较简化

后端只看第一个语言标签，不处理复杂权重排序。

### 5.4 UI 组件库 locale 同步不完整

`SemiLocaleWrapper` 当前只正确处理英文；其他语言基本都会落到中文 locale。

### 5.5 i18n 初始化失败时服务仍继续启动

这提高了可用性，但会导致翻译退化为 key 回显，问题不一定会第一时间暴露。

## 6. 维护和扩展建议

### 6.1 新增一门后端语言时

至少需要同步修改：

1. 新增 `i18n/locales/<lang>.yaml`
2. 在 `i18n.Init()` 的加载列表中加入该文件
3. 扩展 `normalizeLang`
4. 扩展 `SupportedLanguages()`
5. 视情况预创建对应 `Localizer`

### 6.2 新增一门前端语言时

至少需要同步修改：

1. 新增 `web/src/i18n/locales/<lang>.json`
2. 在 `web/src/i18n/i18n.js` 中导入并注册资源
3. 更新 `web/src/i18n/language.js` 的 `supportedLanguages`
4. 更新 `web/i18next.config.js` 的 `locales`
5. 更新语言选择器选项
6. 若要让 Semi UI 组件库也同步，需要补齐 `SemiLocaleWrapper`

### 6.3 如果希望前后端语言体验一致

至少需要同时解决三件事：

1. 补齐后端对 `fr`、`ru`、`ja`、`vi` 的翻译资源和归一化规则。
2. 让前端请求显式携带当前语言，避免完全依赖浏览器默认 `Accept-Language`。
3. 修正 Semi UI locale 映射，让组件库文本不要回落到中文。

## 7. 结论

当前项目的 i18n 方案可以概括为：

1. 后端负责 API 消息国际化，采用 go-i18n + 语义化 key + YAML。
2. 前端负责界面国际化，采用 i18next + 中文原文 key + JSON。
3. 用户语言偏好通过 `user.setting.language` 在前后端之间同步。
4. 登录用户的持久化偏好优先级高于请求头和浏览器探测。
5. 当前最大的实现差异在于语言覆盖范围不一致，以及前端组件库 locale 同步不完整。

如果只是日常维护，这套方案已经足够可用；如果要继续扩展多语言体验，优先级最高的工作应该是“统一前后端支持语言范围”和“补齐请求头/组件库 locale 的同步链路”。
