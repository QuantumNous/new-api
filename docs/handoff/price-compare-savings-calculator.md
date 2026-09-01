# 交接文档:首页「价格对比表 + 省钱计算器」功能

> 交接对象:Codex(或其他编码 agent)。本文档包含需求背景、既定决策、代码位置、数据来源、实现步骤与验收标准。
> 仓库:DaydreamZXG/new-api,工作分支:`v0/project-05199d71`。

---

## 一、需求背景

用户看到竞品(HeyRoute)落地页的两个功能,希望本站也做,并调整首页主题:

1. **价格对比表**:旗舰模型「本站折扣价 vs 官方 API 原价」逐行对比,折扣价加粗、原价划线,直观展示便宜多少。
2. **省钱计算器**:用户选择用途(AI 编程 / Agent 工作流 / 客服与运营 / 研究与内容)、拖动「每月 tokens 用量」和「使用人数」滑块,实时显示一年预计省下的金额。
3. **主题调整**:用户明确表示「对用户来说,不是你的技术多牛逼,是多方便多便宜」。

### 已和用户确认的决策(不要再问)

| 问题 | 决定 |
|---|---|
| 对比列 | **只对比官方 API 原价**,不加 OpenRouter 列(避免手动维护第三方价格) |
| 主标题风格 | **方便 + 便宜双主题**,例如「一个地址用遍所有模型,价格还更便宜」 |
| 计算器 | **做**,和对比表一起上 |
| 数据来源 | 全部用真实数据自动计算,**不写死价格** |

---

## 二、数据来源与价格计算(关键)

### 后端 API

- `GET /api/pricing`(公开,无需登录;见 `router/api-router.go` 第 35、37 行)。
- 前端已有封装:`web/src/features/pricing/api.ts`,以及模型广场页面 `web/src/features/pricing/` 整个目录可参考。

### 价格公式(源自 `web/src/features/pricing/lib/price.ts`)

- **输入价(USD / 1M tokens)** = `model_ratio × 2 × groupRatio`
- **输出价** = 输入价 × `completion_ratio`
- `groupRatio = 1` 时即官方原价基准;折扣来自:
  - 分组倍率 `groupRatio < 1`(通过 `getDisplayGroupRatio(model, selectedGroup)` 取,见 `web/src/features/pricing/lib/model-helpers.ts`)
  - 充值汇率折扣 `applyRechargeRate`(`priceRate`:充多少显示货币得 1 USD 额度)
- 因此对比表两列可以这样算:
  - **官方原价**:`model_ratio × 2`(input)/ `model_ratio × 2 × completion_ratio`(output),即 groupRatio=1、不做 recharge 折扣
  - **本站价**:带默认分组倍率 + recharge 折扣的实际价
- 货币格式化用 `formatCurrencyFromUSD`(`web/src/lib/currency.ts`),不要自己写格式化。
- 只统计 `quota_type === 0`(按 token 计费)的模型;`quota_type === 1`(按次)跳过。

### 旗舰模型的挑选逻辑(建议)

不硬编码模型名。从 `/api/pricing` 返回列表中:
1. 过滤出启用的、按 token 计费的模型;
2. 按 vendor/名称匹配一组优先展示的前缀(如 `gpt-`、`claude-`、`deepseek`、`kimi`/`moonshot`、`gemini-`、`qwen`),每个厂商取 model_ratio 最高(旗舰)的 1 个,共 4~6 行;
3. 如果匹配不足 4 个,按 model_ratio 降序补足;
4. 如果 pricing 返回为空(站点还没配置渠道),**整个区块优雅隐藏**,不要渲染空表。

### 折扣比例(主标题用)

「最高省 XX%」的 XX 从真实数据算:`1 - min(本站价/官方价)`,对所有展示模型取最大折扣,向下取整到整数百分比。若无折扣(全部 ratio=1),则不显示百分比,退回文案「价格更便宜」。

---

## 三、代码位置与现状

### 首页结构

- 入口:`web/src/features/home/index.tsx`,按序渲染:`Hero → Stats → HowItWorks → Features → FAQ → CTA → Footer`,全部来自 `./components`(即 `web/src/features/home/components/`,sections 在其下 `sections/` 目录,有 barrel export)。
- Hero:`web/src/features/home/components/sections/hero.tsx`
  - 当前主标题 i18n 键:`'One key to unlock'` / `'all the best AI'` / `'models'`(三段渐变文字)
  - 保障文案现为两条:`'Pay as you go, savings you can see'`(按量付费,便宜看得见)+ `'Works with 30+ popular tools'`
- 首页 API hook:`web/src/features/home/hooks.ts`、`web/src/features/home/api.ts`

### 新增文件建议

- `web/src/features/home/components/sections/price-compare.tsx` —— 价格对比表
- `web/src/features/home/components/sections/savings-calculator.tsx` —— 省钱计算器
- 二者可合并为一个 section(先对比表后计算器),或两个相邻 section;在 `index.tsx` 中插到 `<Stats />` 之后、`<HowItWorks />` 之前。
- 记得在 sections 的 barrel(`web/src/features/home/components/index.ts` 或类似)补导出。
- **新文件必须带 AGPL 版权头**(照抄现有文件头部的 QuantumNous 注释块,不得改动)。

---

## 四、实现步骤

### Step 1: 主标题改为「方便 + 便宜」双主题

改 `hero.tsx` 三段渐变标题的 i18n 键,中文意向(英文键自拟,保持英文为键名):

- 主标题:「一个地址,用遍所有大模型」+ 副句「同样的模型,最高省 {{percent}}%」(percent 来自真实数据,见上文)
- 若 pricing 无数据,退化为静态句「价格还更便宜」。
- 描述段(现有 `'No coding needed...'` 键)可顺带微调,强调「不用改代码、复制粘贴就能用、按量付费」。

### Step 2: 价格对比表 PriceCompare

- 布局参考竞品截图 1:左列模型名+厂商,右侧两列「本站价」「官方 API」,单位注明 `USD / 每 100 万 tokens`,每格显示 `输入 / 输出` 两个数。
- 本站价加粗/主色,旁边放灰色删除线的官方价;官方列正常展示。
- 每行可加「省 XX%」徽标。
- 表格下方小字:「价格为实时数据,以模型广场为准」,并放一个链接跳 `/pricing`(模型广场路由,确认实际路径)。
- 移动端:表格改为卡片堆叠(参考 Features section 的响应式写法)。
- 数据获取:参考 `web/src/features/pricing/api.ts` 现有 fetch + `@tanstack/react-query`(如果 home 现有 hooks 用了别的模式,跟随现有模式)。

### Step 3: 省钱计算器 SavingsCalculator

参考竞品截图 2:

- 输入项:
  1. 用途单选(4 个按钮):AI 编程 / Agent 工作流 / 客服与运营 / 研究与内容。每个用途对应一个「代表模型组合」的每 token 平均单价(从对比表选中的模型里按用途取 1~2 个模型的均价,例如 AI 编程用 claude/gpt 旗舰,客服用 deepseek/kimi 便宜模型)。
  2. 每月 tokens 用量滑块(范围建议 1M ~ 200M,默认 20M,对数刻度体验更好)。
  3. 使用人数滑块(1 ~ 100,默认 20)。
- 输出:
  - 「一年预计省下 $X」大数字(官方价成本 − 本站价成本,× 12 个月 × 人数)
  - 小字:「每月可省 $X」「预计月度模型成本 $X」「按当前代表性模型组合估算」
- 输入输出 token 比例假设 1:3(编程/Agent)或 1:1(客服/研究),在代码里写成常量并注释。
- 滑块组件:优先用项目已有的 slider 组件(Base UI,搜 `web/src/components/ui/` 下是否有 slider;没有则用原生 `input[type=range]` 加样式)。

### Step 4: i18n(必须严格遵守)

**绝对不允许手改 `web/src/i18n/locales/*.json`。** 流程:

1. 读 `AGENTS.md` 和 skill `in-repo-i18n-translate` 的要求;
2. 所有新 UI 文案用 `t('English key')`,英文即键名;
3. 写临时脚本 `web/scripts/add-missing-keys.mjs`(结构见 skill 文档,`newKeys` 里必须给全 7 个语言:en、zh、zh-TW、fr、ja、ru、vi);
4. `cd web && node scripts/add-missing-keys.mjs && bun run i18n:sync`;
5. 删除临时脚本;
6. 带 `{{percent}}` 等插值的键,所有语言必须保留占位符。

### Step 5: 验证

1. `cd web && bun run typecheck`(或 `bun run build`)通过;
2. 本地起前后端验证(见下方「本地环境」),确认:
   - pricing 有数据时对比表/计算器正常渲染、数字合理;
   - pricing 为空时两个区块整体隐藏,首页不留白/不报错;
   - 中英文切换均正常,无缺键(fallback 英文键名裸露);
   - 移动端 viewport(≤768px)布局不破;
3. 提交推送到 `v0/project-05199d71`,commit 信息中文,带 `Co-authored-by: v0 <it+v0agent@vercel.com>`。

---

## 五、本地环境(沙箱内已验证的启动方式)

- 前端:`cd web && bun install && VITE_REACT_APP_SERVER_URL=http://localhost:3001 bun run dev`(端口 3000,代理到后端 3001)
- 后端:Go 1.22+(沙箱无 Go,可从 go.dev 下载解压到 /tmp/go);
  `go build -o /tmp/new-api-server .` 然后 `PORT=3001 SQLITE_PATH=/tmp/new-api-data/new-api.db /tmp/new-api-server`
- 首次访问会跳 `/setup` 初始化;可 POST `http://localhost:3001/api/setup` 传 `{username, password, confirmPassword, SelfUseModeEnabled:false, DemoSiteEnabled:false}` 快速完成(密码需大小写+数字,如 `Admin12345`)。
- **本地空库 `/api/pricing` 返回空列表**——测试对比表需先在管理后台加一个渠道+模型,或直接验证「空数据时隐藏」的分支。

---

## 六、注意事项 / 坑

1. **保护标识**:严禁修改/删除 new-api、QuantumNous 相关品牌信息(AGENTS.md 强制)。
2. **版权头**:所有新建 `.tsx/.ts` 文件带 AGPL 头(照抄邻近文件)。
3. **公开页面**:首页未登录可见,`/api/pricing` 是公开接口,不要引入需要鉴权的接口。
4. **不要写死价格**:所有数字来自 `/api/pricing` 实时计算;计算器的「代表模型组合」映射到真实模型 ID 列表,取不到就降级用展示列表的均价。
5. **货币显示**:统一走 `formatCurrencyFromUSD`,尊重站点的货币显示配置,别自己拼 `$`。
6. **首页近期已改过的内容**(不要回退):
   - Hero 保障文案已是「按量付费,便宜看得见」+「支持 30+ 款热门工具」(commit `54543747`);
   - 新手指南工具排序:聊天类 WorkBuddy 第一;编程类 Claude Code → Codex → Pi → Cline(`web/src/features/guide/data.ts`);
   - 语言包已补 97 个缺失键(commit `f0f512b9`),新增键继续走脚本流程。
7. **rsbuild 而非 vite**:环境变量前缀 `VITE_` 但构建工具是 Rsbuild,配置在 `web/rsbuild.config.ts`。
