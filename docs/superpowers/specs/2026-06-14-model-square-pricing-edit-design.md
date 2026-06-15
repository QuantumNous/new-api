# 模型广场 root 编辑定价 — 设计

- 日期：2026-06-14
- 主题：在模型广场（`/pricing/`，"Model Square"）给 root/管理员增加直接修改模型定价的入口
- 状态：设计已确认

## 目标
模型广场当前为只读展示。让 root/管理员能在广场的模型详情抽屉里直接改定价，免去去「系统设置→模型定价」的跳转。普通用户不受影响（无入口、无越权）。

## 范围
- 可编辑：输入倍率 `ModelRatio`、输出倍率 `CompletionRatio`、固定价 `ModelPrice`（按量 / 按次二选一）。
- 不在范围：阶梯/表达式 `billingexpr`、缓存/图片/音频比率、分组倍率 `GroupRatio` —— 仍留在「系统设置→模型定价」处理。

## 设计
1. **入口**：模型详情抽屉（`pricing/components/model-details.tsx` / `ModelDetailsDrawer`）加「编辑定价」按钮，仅 `user.role >= ROLE.ADMIN` 时显示。
2. **编辑**：点按钮 → 弹出单模型编辑窗（Modal），预填该模型当前 ModelRatio / CompletionRatio / ModelPrice。
3. **保存**：更新三张 option 表中该模型那条，走现有 `PUT /api/option/`（复用 `system-settings/models/model-pricing-core` 的保存逻辑）。
4. **刷新**：保存成功后 refetch `usePricingData`，广场价格即时更新。

## 立即生效（已验证）
- **后端**：`model/option.go` 在 `PUT /api/option/` 时，对 ModelRatio / CompletionRatio / ModelPrice 分别调用 `ratio_setting.UpdateModelRatioByJSONString` / `UpdateCompletionRatioByJSONString` / `UpdateModelPriceByJSONString`，**立即刷新内存比率表**（modelRatioMap 等）。下一次 relay 请求即用新价计费。
- **前端**：保存后 refetch，广场显示即时更新。
- **结论**：复用现有 option 接口即天然立即生效，无需额外轮询或重启。

## 权限
- 前端：`role >= ROLE.ADMIN` 才显示编辑按钮。
- 后端：`/api/option/` 本就只允许管理员（沿用现有鉴权），普通用户无法越权调用。

## 预估改动
- `pricing/components/model-details.tsx`：加「编辑定价」按钮 + 权限判断。
- 新建 `pricing/components/edit-pricing-dialog.tsx`（单模型编辑窗，复用 model-pricing-core 保存）。
- 复用 `system-settings/models/model-pricing-core.ts`（保存逻辑）+ `system-settings/api.ts`（option 读写）。
- i18n：`zh.json` 加几条文案（编辑定价、保存成功等）。

## 假设 / 待确认
- 编辑窗用 Modal 形态，与站点现有 UI 组件库一致。
- 保存后仅刷新广场 + 一个成功提示，不做其他额外动作。
- 实施走「分步汇报」：改代码 → 构建前端 → 重启 dev → 验证立即生效。
