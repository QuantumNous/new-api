import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ComboboxInput } from '@/components/ui/combobox-input'
import type { ComboboxInputOption } from '@/components/ui/combobox-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { SectionPageLayout } from '@/components/layout'
import {
  getGroupRules,
  createGroupRule,
  updateGroupRule,
  deleteGroupRule,
  getPlanRules,
  createPlanRule,
  updatePlanRule,
  deletePlanRule,
  getUserRules,
  createUserRule,
  updateUserRule,
  deleteUserRule,
} from './api'
import type {
  ModelQuotaGroupRule,
  ModelQuotaPlanRule,
  ModelQuotaUserRule,
  MatchMode,
  ModelQuotaPeriod,
} from './types'
import {
  formatQuota,
  parseQuotaFromDollars,
  quotaUnitsToDollars,
} from '@/lib/format'
import {
  getCurrencyDisplay,
  getCurrencyLabel,
} from '@/lib/currency'
import { getUserModels } from '@/lib/api'
import { getGroups, searchUsers } from '@/features/users/api'
import { getAdminPlans } from '@/features/subscriptions/api'
import { cn } from '@/lib/utils'

type QuotaMode = 'add' | 'subtract' | 'override'

function getPeriodLabel(period?: ModelQuotaPeriod) {
  switch (period) {
    case 'daily':
      return '每日'
    case 'weekly':
      return '每周'
    case 'monthly':
      return '每月'
    case 'total':
    default:
      return '总额'
  }
}

// ---------------------------------------------------------------------------
// Shared hooks for dropdown data sources
// ---------------------------------------------------------------------------

function useGroupOptions(): ComboboxInputOption[] {
  const { data } = useQuery({
    queryKey: ['groups-list'],
    queryFn: () => getGroups(),
    staleTime: 60000,
  })
  return useMemo(
    () =>
      (data?.data ?? []).map((g) => ({
        value: g,
        label: g,
      })),
    [data]
  )
}

function useModelOptions(): ComboboxInputOption[] {
  const { data } = useQuery({
    queryKey: ['user-models-list'],
    queryFn: () => getUserModels(),
    staleTime: 60000,
  })
  return useMemo(
    () => (data?.data ?? []).map((m) => ({ value: m, label: m })),
    [data]
  )
}

function usePlanOptions() {
  const { data } = useQuery({
    queryKey: ['admin-plans-list'],
    queryFn: () => getAdminPlans(),
    staleTime: 60000,
  })
  return useMemo(() => {
    const records = data?.data ?? []
    return records.map((r) => ({
      value: String(r.plan.id),
      label: r.plan.title,
    }))
  }, [data])
}

// User options for the user-rule combobox. We pre-load the first 200 users
// (display_name (username) format) and let the combobox filter locally.
// For large directories, admin can switch to a remote-search variant later.
function useUserOptions(): ComboboxInputOption[] {
  const { data } = useQuery({
    queryKey: ['model-quota-user-options'],
    queryFn: () => searchUsers({ keyword: '', page_size: 200 }),
    staleTime: 60000,
  })
  return useMemo(() => {
    const users = data?.data?.items ?? []
    return users.map((u) => ({
      // value carries user_id; label shows display_name (username)
      value: String(u.id),
      label: `${u.display_name || u.username} (${u.username})`,
    }))
  }, [data])
}

// ---------------------------------------------------------------------------
// Group Rules Tab
// ---------------------------------------------------------------------------

function GroupRulesTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ModelQuotaGroupRule | null>(
    null
  )
  const [deletingRule, setDeletingRule] = useState<ModelQuotaGroupRule | null>(
    null
  )

  const { data, isLoading } = useQuery({
    queryKey: ['model-quota-group-rules'],
    queryFn: () => getGroupRules({ page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createGroupRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-group-rules'] })
      toast.success(t('规则创建成功'))
      setCreateOpen(false)
    },
    onError: () => toast.error(t('规则创建失败')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateGroupRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-group-rules'] })
      toast.success(t('规则更新成功'))
      setEditingRule(null)
    },
    onError: () => toast.error(t('规则更新失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGroupRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-group-rules'] })
      toast.success(t('规则删除成功'))
      setDeletingRule(null)
    },
    onError: () => toast.error(t('规则删除失败')),
  })

  const rules = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          {t('添加规则')}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('分组名称')}</TableHead>
              <TableHead>{t('模型匹配')}</TableHead>
              <TableHead>{t('匹配模式')}</TableHead>
              <TableHead>{t('限制周期')}</TableHead>
              <TableHead>{t('额度上限')}</TableHead>
              <TableHead>{t('状态')}</TableHead>
              <TableHead className="text-right">{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  {t('暂无规则配置')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {rule.group_name}
                  </TableCell>
                  <TableCell className="font-mono">
                    {rule.model_pattern}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rule.match_mode === 'exact' ? 'default' : 'secondary'
                      }
                    >
                      {rule.match_mode === 'exact'
                        ? t('精确匹配')
                        : t('前缀匹配')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getPeriodLabel(rule.period)}</Badge>
                  </TableCell>
                  <TableCell>{formatQuota(rule.quota_limit)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('已启用') : t('已禁用')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingRule(rule)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog — key forces fresh state each open */}
      {createOpen && (
        <GroupRuleDialog
          key="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Dialog — key forces fresh state per rule */}
      {editingRule && (
        <GroupRuleDialog
          key={`edit-${editingRule.id}`}
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
          rule={editingRule}
          onSubmit={(data) =>
            editingRule &&
            updateMutation.mutate({ id: editingRule.id, data })
          }
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('删除规则')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('确定要删除此规则吗？此操作不可撤销。')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('取消')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingRule && deleteMutation.mutate(deletingRule.id)
              }
            >
              {t('删除')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Plan Rules Tab
// ---------------------------------------------------------------------------

function PlanRulesTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ModelQuotaPlanRule | null>(
    null
  )
  const [deletingRule, setDeletingRule] = useState<ModelQuotaPlanRule | null>(
    null
  )

  const { data, isLoading } = useQuery({
    queryKey: ['model-quota-plan-rules'],
    queryFn: () => getPlanRules({ page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createPlanRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-plan-rules'] })
      toast.success(t('规则创建成功'))
      setCreateOpen(false)
    },
    onError: () => toast.error(t('规则创建失败')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updatePlanRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-plan-rules'] })
      toast.success(t('规则更新成功'))
      setEditingRule(null)
    },
    onError: () => toast.error(t('规则更新失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlanRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-plan-rules'] })
      toast.success(t('规则删除成功'))
      setDeletingRule(null)
    },
    onError: () => toast.error(t('规则删除失败')),
  })

  const rules = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          {t('添加规则')}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('订阅计划')}</TableHead>
              <TableHead>{t('模型匹配')}</TableHead>
              <TableHead>{t('匹配模式')}</TableHead>
              <TableHead>{t('额度上限')}</TableHead>
              <TableHead>{t('状态')}</TableHead>
              <TableHead className="text-right">{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center text-muted-foreground"
                >
                  {t('暂无规则配置')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    {t('计划')} #{rule.plan_id}
                  </TableCell>
                  <TableCell className="font-mono">
                    {rule.model_pattern}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rule.match_mode === 'exact' ? 'default' : 'secondary'
                      }
                    >
                      {rule.match_mode === 'exact'
                        ? t('精确匹配')
                        : t('前缀匹配')}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatQuota(rule.quota_limit)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('已启用') : t('已禁用')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingRule(rule)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      {createOpen && (
        <PlanRuleDialog
          key="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Dialog */}
      {editingRule && (
        <PlanRuleDialog
          key={`edit-${editingRule.id}`}
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
          rule={editingRule}
          onSubmit={(data) =>
            editingRule && updateMutation.mutate({ id: editingRule.id, data })
          }
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('删除规则')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('确定要删除此规则吗？此操作不可撤销。')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('取消')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingRule && deleteMutation.mutate(deletingRule.id)
              }
            >
              {t('删除')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User Rules Tab — 个人用户规则
// ---------------------------------------------------------------------------

function UserRulesTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ModelQuotaUserRule | null>(
    null
  )
  const [deletingRule, setDeletingRule] = useState<ModelQuotaUserRule | null>(
    null
  )

  const { data, isLoading } = useQuery({
    queryKey: ['model-quota-user-rules'],
    queryFn: () => getUserRules({ page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createUserRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-user-rules'] })
      toast.success(t('规则创建成功'))
      setCreateOpen(false)
    },
    onError: () => toast.error(t('规则创建失败')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      updateUserRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-user-rules'] })
      toast.success(t('规则更新成功'))
      setEditingRule(null)
    },
    onError: () => toast.error(t('规则更新失败')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUserRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-user-rules'] })
      toast.success(t('规则删除成功'))
      setDeletingRule(null)
    },
    onError: () => toast.error(t('规则删除失败')),
  })

  const rules = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          {t('添加规则')}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('用户')}</TableHead>
              <TableHead>{t('模型匹配')}</TableHead>
              <TableHead>{t('匹配模式')}</TableHead>
              <TableHead>{t('限制周期')}</TableHead>
              <TableHead>{t('额度上限')}</TableHead>
              <TableHead>{t('状态')}</TableHead>
              <TableHead className="text-right">{t('操作')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center">
                  <Loader2 className="size-4 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : rules.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
                  className="text-center text-muted-foreground"
                >
                  {t('暂无规则配置')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{rule.username || `#${rule.user_id}`}</span>
                      <span className="text-xs text-muted-foreground">
                        ID: {rule.user_id}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono">
                    {rule.model_pattern}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rule.match_mode === 'exact' ? 'default' : 'secondary'
                      }
                    >
                      {rule.match_mode === 'exact'
                        ? t('精确匹配')
                        : t('前缀匹配')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{getPeriodLabel(rule.period)}</Badge>
                  </TableCell>
                  <TableCell>{formatQuota(rule.quota_limit)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('已启用') : t('已禁用')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setEditingRule(rule)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingRule(rule)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      {createOpen && (
        <UserRuleDialog
          key="create"
          open={createOpen}
          onOpenChange={setCreateOpen}
          onSubmit={(data) => createMutation.mutate(data)}
          isLoading={createMutation.isPending}
        />
      )}

      {/* Edit Dialog */}
      {editingRule && (
        <UserRuleDialog
          key={`edit-${editingRule.id}`}
          open={!!editingRule}
          onOpenChange={(open) => !open && setEditingRule(null)}
          rule={editingRule}
          onSubmit={(data) =>
            editingRule && updateMutation.mutate({ id: editingRule.id, data })
          }
          isLoading={updateMutation.isPending}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingRule}
        onOpenChange={(open) => !open && setDeletingRule(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('删除规则')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('确定要删除此规则吗？此操作不可撤销。')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('取消')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                deletingRule && deleteMutation.mutate(deletingRule.id)
              }
            >
              {t('删除')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group Rule Dialog — with ComboboxInput for group & model
// ---------------------------------------------------------------------------

function GroupRuleDialog({
  open,
  onOpenChange,
  rule,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: ModelQuotaGroupRule | null
  onSubmit: (data: any) => void
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  const groupOptions = useGroupOptions()
  const modelOptions = useModelOptions()
  const isEdit = !!rule
  const [groupName, setGroupName] = useState(rule?.group_name ?? 'default')
  const [modelPattern, setModelPattern] = useState(rule?.model_pattern ?? '')
  const [matchMode, setMatchMode] = useState<MatchMode>(
    rule?.match_mode ?? 'exact'
  )
  const [period, setPeriod] = useState<ModelQuotaPeriod>(
    rule?.period ?? 'total'
  )
  const [quotaMode, setQuotaMode] = useState<QuotaMode>('override')
  const [quotaAmount, setQuotaAmount] = useState(
    isEdit ? String(quotaUnitsToDollars(rule!.quota_limit)) : ''
  )
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const currentQuota = rule?.quota_limit ?? 0
  const amountValue = parseFloat(quotaAmount) || 0
  const inputQuota = parseQuotaFromDollars(Math.abs(amountValue))

  const getPreviewText = () => {
    if (!isEdit) {
      return `${t('额度上限')}: ${formatQuota(inputQuota)}`
    }
    switch (quotaMode) {
      case 'add':
        return `${t('当前额度')}: ${formatQuota(currentQuota)}  +${formatQuota(inputQuota)} = ${formatQuota(currentQuota + inputQuota)}`
      case 'subtract':
        return `${t('当前额度')}: ${formatQuota(currentQuota)}  -${formatQuota(inputQuota)} = ${formatQuota(currentQuota - inputQuota)}`
      case 'override': {
        const overrideQuota = parseQuotaFromDollars(amountValue)
        return `${t('当前额度')}: ${formatQuota(currentQuota)} → ${formatQuota(overrideQuota)}`
      }
    }
  }

  const handleSubmit = () => {
    let finalQuota: number
    if (!isEdit) {
      finalQuota = inputQuota
    } else {
      switch (quotaMode) {
        case 'add':
          finalQuota = currentQuota + inputQuota
          break
        case 'subtract':
          finalQuota = Math.max(0, currentQuota - inputQuota)
          break
        case 'override':
          finalQuota = parseQuotaFromDollars(amountValue)
          break
      }
    }
    onSubmit({
      group_name: groupName,
      model_pattern: modelPattern,
      match_mode: matchMode,
      period,
      quota_limit: finalQuota,
      enabled,
      sort_order: rule?.sort_order ?? 0,
    })
  }

  const placeholder = tokensOnly
    ? t('Enter amount in tokens')
    : t('Enter amount in {{currency}}', { currency: currencyLabel })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t('编辑规则') : t('创建规则')}</DialogTitle>
          <DialogDescription>
            {t('为此分组配置指定模型的额度限制。')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('分组名称')}</Label>
            <ComboboxInput
              options={groupOptions}
              value={groupName}
              onValueChange={setGroupName}
              placeholder={t('选择或输入分组名称...')}
              emptyText={t('未找到匹配的分组')}
              allowCustomValue
            />
          </div>
          <div className="space-y-2">
            <Label>{t('模型名称')}</Label>
            <ComboboxInput
              options={modelOptions}
              value={modelPattern}
              onValueChange={setModelPattern}
              placeholder={t('选择或输入模型名称...')}
              emptyText={t('未找到匹配的模型')}
              allowCustomValue
            />
          </div>
          <div className="space-y-2">
            <Label>{t('匹配模式')}</Label>
            <Select
              value={matchMode}
              onValueChange={(v) => setMatchMode(v as MatchMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t('精确匹配')}</SelectItem>
                <SelectItem value="prefix">{t('前缀匹配')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('限制周期')}</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as ModelQuotaPeriod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total">{t('总额限制')}</SelectItem>
                <SelectItem value="daily">{t('每日限制')}</SelectItem>
                <SelectItem value="weekly">{t('每周限制')}</SelectItem>
                <SelectItem value="monthly">{t('每月限制')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('周期到期后会自动为用户重置该模型额度。')}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('额度上限')}</Label>
              {isEdit && (
                <div className="flex gap-1">
                  {(['add', 'subtract', 'override'] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        quotaMode === m &&
                          'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      )}
                      onClick={() => {
                        setQuotaMode(m)
                        setQuotaAmount('')
                      }}
                    >
                      {m === 'add'
                        ? t('Add')
                        : m === 'subtract'
                          ? t('Subtract')
                          : t('Override')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-muted-foreground text-sm">{getPreviewText()}</div>
            <Input
              type="number"
              step={tokensOnly ? 1 : 0.01}
              min={quotaMode === 'override' ? undefined : 0}
              placeholder={placeholder}
              value={quotaAmount}
              onChange={(e) => setQuotaAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('取消')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
            {rule ? t('保存') : t('创建')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Plan Rule Dialog — with ComboboxInput for model + Select for plan
// ---------------------------------------------------------------------------

function PlanRuleDialog({
  open,
  onOpenChange,
  rule,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: ModelQuotaPlanRule | null
  onSubmit: (data: any) => void
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  const modelOptions = useModelOptions()
  const planOptions = usePlanOptions()
  const isEdit = !!rule
  const [planId, setPlanId] = useState(String(rule?.plan_id ?? ''))
  const [modelPattern, setModelPattern] = useState(rule?.model_pattern ?? '')
  const [matchMode, setMatchMode] = useState<MatchMode>(
    rule?.match_mode ?? 'exact'
  )
  const [quotaMode, setQuotaMode] = useState<QuotaMode>('override')
  const [quotaAmount, setQuotaAmount] = useState(
    isEdit ? String(quotaUnitsToDollars(rule!.quota_limit)) : ''
  )
  const [enabled] = useState(rule?.enabled ?? true)

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const currentQuota = rule?.quota_limit ?? 0
  const amountValue = parseFloat(quotaAmount) || 0
  const inputQuota = parseQuotaFromDollars(Math.abs(amountValue))

  const getPreviewText = () => {
    if (!isEdit) {
      return `${t('额度上限')}: ${formatQuota(inputQuota)}`
    }
    switch (quotaMode) {
      case 'add':
        return `${t('当前额度')}: ${formatQuota(currentQuota)}  +${formatQuota(inputQuota)} = ${formatQuota(currentQuota + inputQuota)}`
      case 'subtract':
        return `${t('当前额度')}: ${formatQuota(currentQuota)}  -${formatQuota(inputQuota)} = ${formatQuota(currentQuota - inputQuota)}`
      case 'override': {
        const overrideQuota = parseQuotaFromDollars(amountValue)
        return `${t('当前额度')}: ${formatQuota(currentQuota)} → ${formatQuota(overrideQuota)}`
      }
    }
  }

  const handleSubmit = () => {
    let finalQuota: number
    if (!isEdit) {
      finalQuota = inputQuota
    } else {
      switch (quotaMode) {
        case 'add':
          finalQuota = currentQuota + inputQuota
          break
        case 'subtract':
          finalQuota = Math.max(0, currentQuota - inputQuota)
          break
        case 'override':
          finalQuota = parseQuotaFromDollars(amountValue)
          break
      }
    }
    onSubmit({
      plan_id: parseInt(planId, 10),
      model_pattern: modelPattern,
      match_mode: matchMode,
      quota_limit: finalQuota,
      enabled,
      sort_order: rule?.sort_order ?? 0,
    })
  }

  const placeholder = tokensOnly
    ? t('Enter amount in tokens')
    : t('Enter amount in {{currency}}', { currency: currencyLabel })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t('编辑规则') : t('创建规则')}</DialogTitle>
          <DialogDescription>
            {t('为此订阅计划配置指定模型的额度限制。')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('订阅计划')}</Label>
            <Select value={planId} onValueChange={(v) => setPlanId(v ?? '')}>
              <SelectTrigger>
                <SelectValue placeholder={t('请选择订阅计划...')} />
              </SelectTrigger>
              <SelectContent>
                {planOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('模型名称')}</Label>
            <ComboboxInput
              options={modelOptions}
              value={modelPattern}
              onValueChange={setModelPattern}
              placeholder={t('选择或输入模型名称...')}
              emptyText={t('未找到匹配的模型')}
              allowCustomValue
            />
          </div>
          <div className="space-y-2">
            <Label>{t('匹配模式')}</Label>
            <Select
              value={matchMode}
              onValueChange={(v) => setMatchMode(v as MatchMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t('精确匹配')}</SelectItem>
                <SelectItem value="prefix">{t('前缀匹配')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('额度上限')}</Label>
              {isEdit && (
                <div className="flex gap-1">
                  {(['add', 'subtract', 'override'] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        quotaMode === m &&
                          'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      )}
                      onClick={() => {
                        setQuotaMode(m)
                        setQuotaAmount('')
                      }}
                    >
                      {m === 'add'
                        ? t('Add')
                        : m === 'subtract'
                          ? t('Subtract')
                          : t('Override')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-muted-foreground text-sm">{getPreviewText()}</div>
            <Input
              type="number"
              step={tokensOnly ? 1 : 0.01}
              min={quotaMode === 'override' ? undefined : 0}
              placeholder={placeholder}
              value={quotaAmount}
              onChange={(e) => setQuotaAmount(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('取消')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
            {rule ? t('保存') : t('创建')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// User Rule Dialog — with ComboboxInput for user & model
// ---------------------------------------------------------------------------

function UserRuleDialog({
  open,
  onOpenChange,
  rule,
  onSubmit,
  isLoading,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rule?: ModelQuotaUserRule | null
  onSubmit: (data: any) => void
  isLoading?: boolean
}) {
  const { t } = useTranslation()
  const userOptions = useUserOptions()
  const modelOptions = useModelOptions()
  const isEdit = !!rule
  const [userId, setUserId] = useState(rule ? String(rule.user_id) : '')
  const [modelPattern, setModelPattern] = useState(rule?.model_pattern ?? '')
  const [matchMode, setMatchMode] = useState<MatchMode>(
    rule?.match_mode ?? 'exact'
  )
  const [period, setPeriod] = useState<ModelQuotaPeriod>(
    rule?.period ?? 'monthly'
  )
  const [quotaMode, setQuotaMode] = useState<QuotaMode>('override')
  const [quotaAmount, setQuotaAmount] = useState(
    isEdit ? String(quotaUnitsToDollars(rule!.quota_limit)) : ''
  )
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  const { meta: currencyMeta } = getCurrencyDisplay()
  const currencyLabel = getCurrencyLabel()
  const tokensOnly = currencyMeta.kind === 'tokens'

  const currentQuota = rule?.quota_limit ?? 0
  const amountValue = parseFloat(quotaAmount) || 0
  const inputQuota = parseQuotaFromDollars(Math.abs(amountValue))

  const getPreviewText = () => {
    if (!isEdit) {
      return `${t('额度上限')}: ${formatQuota(inputQuota)}`
    }
    switch (quotaMode) {
      case 'add':
        return `${t('当前额度')}: ${formatQuota(currentQuota)}  +${formatQuota(inputQuota)} = ${formatQuota(currentQuota + inputQuota)}`
      case 'subtract':
        return `${t('当前额度')}: ${formatQuota(currentQuota)}  -${formatQuota(inputQuota)} = ${formatQuota(currentQuota - inputQuota)}`
      case 'override': {
        const overrideQuota = parseQuotaFromDollars(amountValue)
        return `${t('当前额度')}: ${formatQuota(currentQuota)} → ${formatQuota(overrideQuota)}`
      }
    }
  }

  const handleSubmit = () => {
    let finalQuota: number
    if (!isEdit) {
      finalQuota = inputQuota
    } else {
      switch (quotaMode) {
        case 'add':
          finalQuota = currentQuota + inputQuota
          break
        case 'subtract':
          finalQuota = Math.max(0, currentQuota - inputQuota)
          break
        case 'override':
          finalQuota = parseQuotaFromDollars(amountValue)
          break
      }
    }
    onSubmit({
      user_id: parseInt(userId, 10),
      model_pattern: modelPattern,
      match_mode: matchMode,
      period,
      quota_limit: finalQuota,
      enabled,
      sort_order: rule?.sort_order ?? 0,
    })
  }

  const placeholder = tokensOnly
    ? t('Enter amount in tokens')
    : t('Enter amount in {{currency}}', { currency: currencyLabel })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t('编辑规则') : t('创建规则')}</DialogTitle>
          <DialogDescription>
            {t('为此用户单独配置指定模型的额度限制。')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('用户')}</Label>
            <ComboboxInput
              options={userOptions}
              value={userId}
              onValueChange={setUserId}
              placeholder={t('搜索并选择用户...')}
              emptyText={t('未找到匹配的用户')}
            />
            <p className="text-xs text-muted-foreground">
              {t('可通过用户名或显示名搜索，用户优先级高于分组和套餐规则。')}
            </p>
          </div>
          <div className="space-y-2">
            <Label>{t('模型名称')}</Label>
            <ComboboxInput
              options={modelOptions}
              value={modelPattern}
              onValueChange={setModelPattern}
              placeholder={t('选择或输入模型名称...')}
              emptyText={t('未找到匹配的模型')}
              allowCustomValue
            />
          </div>
          <div className="space-y-2">
            <Label>{t('匹配模式')}</Label>
            <Select
              value={matchMode}
              onValueChange={(v) => setMatchMode(v as MatchMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t('精确匹配')}</SelectItem>
                <SelectItem value="prefix">{t('前缀匹配')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('限制周期')}</Label>
            <Select
              value={period}
              onValueChange={(v) => setPeriod(v as ModelQuotaPeriod)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">{t('每日限制')}</SelectItem>
                <SelectItem value="weekly">{t('每周限制')}</SelectItem>
                <SelectItem value="monthly">{t('每月限制')}</SelectItem>
                <SelectItem value="total">{t('总额限制')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t('周期到期后会自动为该用户重置此模型额度。')}
            </p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('额度上限')}</Label>
              {isEdit && (
                <div className="flex gap-1">
                  {(['add', 'subtract', 'override'] as const).map((m) => (
                    <Button
                      key={m}
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        quotaMode === m &&
                          'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
                      )}
                      onClick={() => {
                        setQuotaMode(m)
                        setQuotaAmount('')
                      }}
                    >
                      {m === 'add'
                        ? t('Add')
                        : m === 'subtract'
                          ? t('Subtract')
                          : t('Override')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            <div className="text-muted-foreground text-sm">{getPreviewText()}</div>
            <Input
              type="number"
              step={tokensOnly ? 1 : 0.01}
              min={quotaMode === 'override' ? undefined : 0}
              placeholder={placeholder}
              value={quotaAmount}
              onChange={(e) => setQuotaAmount(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="user-rule-enabled">{t('启用')}</Label>
            <input
              id="user-rule-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('取消')}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !userId || !modelPattern}
          >
            {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
            {rule ? t('保存') : t('创建')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export function ModelQuotaRulesPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'group' | 'plan' | 'user'>(
    'group'
  )

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('模型额度规则')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className="space-y-4">
          {/* Tab switcher */}
          <div className="flex gap-2 border-b">
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'group'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('group')}
            >
              {t('分组规则')}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'plan'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('plan')}
            >
              {t('计划规则')}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'user'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('user')}
            >
              {t('用户规则')}
            </button>
          </div>

          {activeTab === 'group' ? (
            <GroupRulesTab />
          ) : activeTab === 'plan' ? (
            <PlanRulesTab />
          ) : (
            <UserRulesTab />
          )}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
