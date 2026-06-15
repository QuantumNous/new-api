# 模型广场 root 编辑定价 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 让 root/管理员在模型广场（`/pricing/`）的模型详情抽屉里直接修改模型定价（ModelRatio / CompletionRatio / ModelPrice），保存后立即生效；普通用户无入口、无越权。

**Architecture:** 在 pricing feature 新建一个自包含的 `EditPricingDialog`（打开时从 `/api/option/` 读取当前三张比率表预填该模型值；保存时更新该模型条目并 `PUT /api/option/` 回写），并在 `ModelDetailsDrawer` 加一个仅 `role >= ROLE.ADMIN` 可见的「编辑定价」按钮触发它；保存成功后调用 `usePricingData().refetch` 刷新广场。复用 system-settings 的 option API 与现有 UI 组件库，不重写计费逻辑。

**Tech Stack:** React 19 + TS + Rsbuild + react-hook-form + zod + @tanstack/react-query + shadcn/ui（Dialog/Form/Input/Button）+ i18next。本仓库无前端单测 runner，验证沿用项目既有模式：构建 + 浏览器手测 + 后端即时生效核对。

---

## File Structure

- **Create** `web/default/src/features/pricing/components/edit-pricing-dialog.tsx` — 单模型定价编辑对话框。职责：加载该模型当前 ModelRatio/CompletionRatio/ModelPrice → 表单编辑 → 保存回写 option。自包含，仅依赖 option API + UI 组件库。
- **Modify** `web/default/src/features/pricing/components/model-details.tsx`（`ModelDetailsContent` 标题区 + `ModelDetailsDrawer`）— 在模型名旁加「编辑定价」按钮（admin gate），并挂载 dialog。
- **Modify** `web/default/src/i18n/locales/zh.json` — 新增文案。
- **Reuse（不改）**：`system-settings/api.ts`（`getSystemOptions` / `updateSystemOption`）、`system-settings/types.ts`（`SystemOptionsResponse` / `UpdateOptionRequest`）、`@/lib/roles`（`ROLE`）、`@/stores/auth-store`（`auth.user.role`）、`pricing/hooks/use-pricing-data`（`refetch`）、`@/components/ui/{dialog,form,input,button}`。

设计边界：dialog 只管"单模型基础三项"的读写；缓存/图片/音频比率、表达式 billingexpr、GroupRatio 不进广场（留在系统设置）。

---

## Task 1: EditPricingDialog 组件

**Files:** Create `web/default/src/features/pricing/components/edit-pricing-dialog.tsx`

- [ ] **Step 1: 组件骨架 + props**

```tsx
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { getSystemOptions, updateSystemOption } from '@/features/system-settings/api'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface EditPricingDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  modelName: string
  onSaved: () => void
}

type Mode = 'per-token' | 'per-request'
```

- [ ] **Step 2: 打开时加载当前值并预填**

读取三张 option 表（值是 JSON 字符串 map），解析出该模型当前值；按"是否有 ModelPrice"决定初始模式。

```tsx
const [mode, setMode] = useState<Mode>('per-token')
const [ratio, setRatio] = useState('')        // ModelRatio
const [completionRatio, setCompletionRatio] = useState('') // CompletionRatio
const [price, setPrice] = useState('')        // ModelPrice
const [saving, setSaving] = useState(false)

useEffect(() => {
  if (!open || !modelName) return
  let alive = true
  ;(async () => {
    const opts = await getSystemOptions()
    if (!alive) return
    const pick = (json?: string) => {
      try { return json ? JSON.parse(json) : {} } catch { return {} }
    }
    const mr = pick(opts.data?.ModelRatio)
    const cr = pick(opts.data?.CompletionRatio)
    const mp = pick(opts.data?.ModelPrice)
    const hasPrice = mp[modelName] !== undefined && mp[modelName] !== ''
    setMode(hasPrice ? 'per-request' : 'per-token')
    setRatio(mr[modelName] != null ? String(mr[modelName]) : '')
    setCompletionRatio(cr[modelName] != null ? String(cr[modelName]) : '')
    setPrice(hasPrice ? String(mp[modelName]) : '')
  })()
  return () => { alive = false }
}, [open, modelName])
```

注：`opts.data` 的精确字段名（`ModelRatio`/`CompletionRatio`/`ModelPrice`）以 `system-settings/types.ts` 的 `SystemOptionsResponse` 为准；ratio-settings-card.tsx 已用相同 key，照搬。

- [ ] **Step 3: 保存逻辑（更新单条 + 回写，防覆盖）**

重新拉最新 map（避免覆盖他人改动）→ 按模式改该模型那条 → stringify → `updateSystemOption`。

```tsx
const toNum = (s: string) => (s === '' ? null : Number(s))

const handleSave = async () => {
  setSaving(true)
  try {
    const opts = await getSystemOptions()
    const clone = (json?: string) => {
      try { return json ? JSON.parse(json) : {} } catch { return {} }
    }
    const mr = clone(opts.data?.ModelRatio)
    const cr = clone(opts.data?.CompletionRatio)
    const mp = clone(opts.data?.ModelPrice)

    if (mode === 'per-token') {
      const r = toNum(ratio)
      if (r == null || !Number.isFinite(r) || r <= 0) throw new Error('请填有效的输入倍率')
      mr[modelName] = r
      const c = toNum(completionRatio)
      if (c != null && Number.isFinite(c)) cr[modelName] = c; else delete cr[modelName]
      delete mp[modelName]
    } else {
      const p = toNum(price)
      if (p == null || !Number.isFinite(p) || p < 0) throw new Error('请填有效的固定价')
      mp[modelName] = p
      delete mr[modelName]
      delete cr[modelName]
    }

    await updateSystemOption({
      // UpdateOptionRequest 形状以 system-settings/types.ts 为准；
      // ratio-settings-card.tsx 提交同样三个 JSON-string key
      ModelRatio: JSON.stringify(mr),
      CompletionRatio: JSON.stringify(cr),
      ModelPrice: JSON.stringify(mp),
    } as any)

    toast.success(t('定价已保存，立即生效'))
    onSaved()
    onOpenChange(false)
  } catch (e: any) {
    toast.error(e?.message || t('保存失败'))
  } finally {
    setSaving(false)
  }
}
```

- [ ] **Step 4: 渲染 UI**

```tsx
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{t('Edit Pricing')} — {modelName}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {/* 模式切换 */}
        <div className="flex gap-2">
          <Button variant={mode==='per-token'?'default':'outline'} size="sm" onClick={()=>setMode('per-token')}>{t('Per-token')}</Button>
          <Button variant={mode==='per-request'?'default':'outline'} size="sm" onClick={()=>setMode('per-request')}>{t('Per-request')}</Button>
        </div>
        {mode === 'per-token' ? (
          <>
            <div><Label>{t('Input ratio (ModelRatio)')}</Label><Input value={ratio} onChange={(e)=>setRatio(e.target.value)} placeholder="1" /></div>
            <div><Label>{t('Completion ratio')}</Label><Input value={completionRatio} onChange={(e)=>setCompletionRatio(e.target.value)} placeholder="2" /></div>
          </>
        ) : (
          <div><Label>{t('Fixed price ($) per call')}</Label><Input value={price} onChange={(e)=>setPrice(e.target.value)} placeholder="0.01" /></div>
        )}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={()=>onOpenChange(false)}>{t('Cancel')}</Button>
        <Button onClick={handleSave} disabled={saving}>{saving ? t('Saving...') : t('Save')}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

- [ ] **Step 5: 导出**

在 `pricing/components/index.ts` 加 `export { EditPricingDialog } from './edit-pricing-dialog'`。

---

## Task 2: ModelDetailsDrawer 加「编辑定价」按钮（admin gate）

**Files:** Modify `web/default/src/features/pricing/components/model-details.tsx`

- [ ] **Step 1: 引入依赖**

在 `ModelDetailsContent`（或 `ModelDetailsDrawer`）所在文件顶部：
```tsx
import { useState } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'
import { EditPricingDialog } from './edit-pricing-dialog'
import { usePricingData } from '../hooks/use-pricing-data'
```

- [ ] **Step 2: 组件内取权限 + 状态**

在 `ModelDetailsContent` 内（持有 `model` 的地方）：
```tsx
const { t } = useTranslation()
const { auth } = useAuthStore()
const isAdmin = (auth.user?.role ?? 0) >= ROLE.ADMIN
const { refetch } = usePricingData()
const [editOpen, setEditOpen] = useState(false)
```

- [ ] **Step 3: 在模型标题旁加按钮（仅 admin）**

在模型名/标题那一行的右侧加入：
```tsx
{isAdmin && (
  <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
    {t('Edit Pricing')}
  </Button>
)}
<EditPricingDialog
  open={editOpen}
  onOpenChange={setEditOpen}
  modelName={model.model_name}
  onSaved={() => refetch()}
/>
```
（实现时定位 ModelDetailsContent 里模型名渲染的具体行作为插入点；逻辑不变。）

---

## Task 3: i18n 文案

**Files:** Modify `web/default/src/i18n/locales/zh.json`（在 `translation` 对象内追加）

```json
"Edit Pricing": "编辑定价",
"Per-token": "按量计费",
"Per-request": "按次计费",
"Input ratio (ModelRatio)": "输入倍率",
"Completion ratio": "输出倍率",
"Fixed price ($) per call": "固定价（$/次）",
"定价已保存，立即生效": "定价已保存，立即生效",
"保存失败": "保存失败",
"Saving...": "保存中…",
"Cancel": "取消",
"Save": "保存",
```
（"Cancel"/"Save" 若已存在则跳过，避免重复 key。）

---

## Task 4: 构建 + 部署

- [ ] **Step 1: 预检** — `swapon --show` + `free -h`，确认可用 RAM > ~400MB、`/swapfile` 在位。
- [ ] **Step 2: 构建前端** — `cd web/default && DISABLE_ESLINT_PLUGIN=true bun run build`，产物无报错。
- [ ] **Step 3: 重编 Go** — `cd repo && PATH=/usr/local/btgo/bin:$PATH GOMAXPROCS=2 go build -p 2 -ldflags "-s -w" -o new-api`，exit 0。
- [ ] **Step 4: 重启 dev** — 精准 kill `./new-api`（不碰 prod `/new-api`），`SQLITE_PATH=... PORT=3000 TZ=Asia/Shanghai nohup ./new-api > data-dev/new-api.log 2>&1 & disown`，确认 :3000 由新 PID 监听。

---

## Task 5: 验证（含立即生效 + 权限）

- [ ] **Step 1: root 可见可改** — root 登录 → `/pricing/` → 点开一个模型 → 详情里有「编辑定价」按钮 → 改 ModelRatio 保存 → 广场价格立即变化（refetch 生效）。
- [ ] **Step 2: 立即生效（后端）** — 保存后发起一次该模型调用（或在用量日志看），确认按新比率计费；或 `curl /api/option/` 确认该模型值已更新（后端 `model/option.go` 已在 PUT 时即时刷新内存比率表）。
- [ ] **Step 3: 普通用户隔离** — 普通用户登录 → 看不到「编辑定价」按钮；用普通用户 token 直接 `PUT /api/option/` → 应 403（后端仅管理员）。

---

## Self-Review

- **Spec 覆盖**：入口（抽屉按钮）✓；可编辑三项（ModelRatio/CompletionRatio/ModelPrice）✓；复用 option API 保存 ✓；refetch 刷新 ✓；立即生效（后端已验证即时刷新内存表）✓；权限（前端 role>=ADMIN + 后端鉴权）✓。
- **立即生效依据**：`model/option.go` 对 `PUT /api/option/` 的 ModelRatio/CompletionRatio/ModelPrice 分别调用 `ratio_setting.Update*ByJSONString`，即时刷新内存比率表，下一次 relay 请求即用新价；无需轮询/重启。
- **防覆盖**：保存前重新 `getSystemOptions` 拿最新 map 再改单条，避免并发覆盖。
- **类型**：`UpdateOptionRequest` 精确形状实现时以 `system-settings/types.ts` 为准（`as any` 仅占位，落地时改强类型）。
- **范围**：基础三项；表达式/缓存/图片/音频/GroupRatio 不在本次范围。

## Execution

按用户要求：本计划需经用户确认后才实现。确认后采用「会话内分步执行 + 每步汇报」（executing-plans 风格），按 Task 1→5 顺序推进，构建/重启遵循防 OOM 规矩。
