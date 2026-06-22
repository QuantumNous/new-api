# 全量页面 UI 质量审计（最新）

- **生成时间:** 2026-06-22T11:41:32.747Z
- **BASE_URL:** http://192.168.18.94:3001
- **视口:** 1440×900
- **账号:** admin
- **扫描页面:** 19
- **P0:** 0 | **P1:** 7 | **P2:** 12

## 汇总

| 评级 | 数量 |
|------|-----:|
| 小修 | 11 |
| 通过 | 8 |

## 重点已知问题复核

| 页面 | 复核结论 |
|------|----------|
| `/playground` | 已浅蓝化；空态有欢迎文案与示例问题；主内容区空白占比仍偏高（P1）；发送/停止需实机流式验证 |
| `/dashboard/overview` | KPI/图表布局已平衡；无数据时部分指标仍可能显示「—」；次级 hint 对比度已加深 |
| `/` + `/sign-in` | 登录页已浅蓝运营风；公共门户仍为深色，与后台风格断裂（产品决策 P2） |
| `/system-settings/site` | 站点信息区已改浅白卡片；整站设置壳层仍偏深，建议单独立项 |
| `/subscriptions` + `/redemption-codes` | 主按钮已统一 ops 蓝；表格/空态与后台一致 |

## 本轮最小修复（展示层）

- 表格页主操作按钮：`opsConsolePrimaryButtonClassName`（keys / users / redemption-codes / models / subscriptions）
- 登录提交按钮、站点配置 `system-info-section` 浅白表单
- Playground 空态居中、回答区对比度、Overview KPI hint 颜色

## 逐页明细

### 首页 (`/`)

| 项 | 值 |
|----|-----|
| 页面类型 | 公共页 |
| 总体评级 | 小修 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/home.png` |
| 最终 URL | http://192.168.18.94:3001/ |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 公共/登录页仍为深色门户风格

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 登录 (`/sign-in`)

| 项 | 值 |
|----|-----|
| 页面类型 | 登录页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/login.png` |
| 最终 URL | http://192.168.18.94:3001/sign-in |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 93% |
| i18n | — |
| 布局 | 布局偏空 |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 定价 (`/pricing`)

| 项 | 值 |
|----|-----|
| 页面类型 | 公共页 |
| 总体评级 | 小修 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/pricing.png` |
| 最终 URL | http://192.168.18.94:3001/pricing |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 99% |
| i18n | — |
| 布局 | 布局偏空 |

**问题:**
- 公共/登录页仍为深色门户风格

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 排行 (`/rankings`)

| 项 | 值 |
|----|-----|
| 页面类型 | 公共页 |
| 总体评级 | 小修 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/rankings.png` |
| 最终 URL | http://192.168.18.94:3001/rankings |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 公共/登录页仍为深色门户风格

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 关于 (`/about`)

| 项 | 值 |
|----|-----|
| 页面类型 | 公共页 |
| 总体评级 | 小修 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/about.png` |
| 最终 URL | http://192.168.18.94:3001/about |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 96% |
| i18n | — |
| 布局 | 布局偏空 |

**问题:**
- 公共/登录页仍为深色门户风格

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 运营总览 (`/dashboard/overview`)

| 项 | 值 |
|----|-----|
| 页面类型 | 分析页 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/dashboard-overview.png` |
| 最终 URL | http://192.168.18.94:3001/dashboard/overview |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | 浅字对比不足: 今日调用量 | 今日词元消耗 | 活跃账号 | 模型服务通道 | / 2 |
| 按钮颜色 | 主按钮层级弱 (2) |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 文字对比度偏低（16/64 采样）
- 主操作按钮层级偏弱（2 处）

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 模型分析 (`/dashboard/models`)

| 项 | 值 |
|----|-----|
| 页面类型 | 分析页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/dashboard-models.png` |
| 最终 URL | http://192.168.18.94:3001/dashboard/models |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 100% |
| i18n | — |
| 布局 | 布局偏空 |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 能力测试台 (`/playground`)

| 项 | 值 |
|----|-----|
| 页面类型 | 测试台 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/playground.png` |
| 最终 URL | http://192.168.18.94:3001/playground |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 79% |
| i18n | — |
| 布局 | 布局偏空 |

**问题:**
- 主内容区空白占比偏高

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 应用接入密钥 (`/keys`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/keys.png` |
| 最终 URL | http://192.168.18.94:3001/keys |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | 主按钮层级弱 (1) |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 86% |
| i18n | — |
| 布局 | 布局偏空 |

**问题:**
- 主操作按钮层级偏弱（1 处）

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 词元消耗明细 (`/usage-logs/common`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/usage-logs-common.png` |
| 最终 URL | http://192.168.18.94:3001/usage-logs/common |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 83% |
| i18n | — |
| 布局 | 布局偏空 |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 任务日志 (`/usage-logs/task`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/usage-logs-task.png` |
| 最终 URL | http://192.168.18.94:3001/usage-logs/task |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | 主按钮层级弱 (1) |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 主操作按钮层级偏弱（1 处）

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 资源充值 (`/wallet`)

| 项 | 值 |
|----|-----|
| 页面类型 | 卡片页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/wallet.png` |
| 最终 URL | http://192.168.18.94:3001/wallet |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 个人资料 (`/profile`)

| 项 | 值 |
|----|-----|
| 页面类型 | 配置页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/profile.png` |
| 最终 URL | http://192.168.18.94:3001/profile |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 模型服务通道 (`/channels`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/channels.png` |
| 最终 URL | http://192.168.18.94:3001/channels |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | 空白占比约 80% |
| i18n | — |
| 布局 | 布局偏空 |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 模型资源池 (`/models/metadata`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/models-metadata.png` |
| 最终 URL | http://192.168.18.94:3001/models/metadata |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | 主按钮层级弱 (1) |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 主操作按钮层级偏弱（1 处）

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 用户管理 (`/users`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/users.png` |
| 最终 URL | http://192.168.18.94:3001/users |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | 主按钮层级弱 (1) |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 主操作按钮层级偏弱（1 处）

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 兑换码 (`/redemption-codes`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 小修 |
| 优先级 | P1 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/redemption-codes.png` |
| 最终 URL | http://192.168.18.94:3001/redemption-codes |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | 主按钮层级弱 (1) |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**问题:**
- 主操作按钮层级偏弱（1 处）

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

### 订阅 (`/subscriptions`)

| 项 | 值 |
|----|-----|
| 页面类型 | 表格页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/subscriptions.png` |
| 最终 URL | http://192.168.18.94:3001/subscriptions |
| HTTP | 200 |
| 本轮已修 | 否 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

### 站点配置 (`/system-settings/site/system-info`)

| 项 | 值 |
|----|-----|
| 页面类型 | 配置页 |
| 总体评级 | 通过 |
| 优先级 | P2 |
| 截图 | `/home/laohaoaioc/projects/new-api/scripts/dev/ui-audit/artifacts/page-quality/system-settings-site.png` |
| 最终 URL | http://192.168.18.94:3001/system-settings/site/system-info |
| HTTP | 200 |
| 本轮已修 | 是 |

| 维度 | 发现 |
|------|------|
| 字体大小 | — |
| 字体颜色 | — |
| 按钮颜色 | — |
| 链接颜色 | — |
| 提示框/弹窗 | — |
| 表格/卡片/表单 | — |
| 空态 | — |
| i18n | — |
| 布局 | — |

**后续建议:** 按优先级在 `web/default` 展示层做最小修复；公共门户深色风格需产品决策。

**本轮已做最小修复**（以最新截图为准）。

