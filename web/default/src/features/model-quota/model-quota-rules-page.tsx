import { useState } from 'react'
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
} from './api'
import type {
  ModelQuotaGroupRule,
  ModelQuotaPlanRule,
  MatchMode,
} from './types'
import { formatQuota } from '@/lib/format'

// ---------------------------------------------------------------------------
// Group Rules Tab
// ---------------------------------------------------------------------------

function GroupRulesTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<ModelQuotaGroupRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<ModelQuotaGroupRule | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['model-quota-group-rules'],
    queryFn: () => getGroupRules({ page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createGroupRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-group-rules'] })
      toast.success(t('Rule created successfully'))
      setCreateOpen(false)
    },
    onError: () => toast.error(t('Failed to create rule')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updateGroupRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-group-rules'] })
      toast.success(t('Rule updated successfully'))
      setEditingRule(null)
    },
    onError: () => toast.error(t('Failed to update rule')),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteGroupRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-group-rules'] })
      toast.success(t('Rule deleted successfully'))
      setDeletingRule(null)
    },
    onError: () => toast.error(t('Failed to delete rule')),
  })

  const rules = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          {t('Add Rule')}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Group')}</TableHead>
              <TableHead>{t('Model Pattern')}</TableHead>
              <TableHead>{t('Match Mode')}</TableHead>
              <TableHead>{t('Quota Limit')}</TableHead>
              <TableHead>{t('Enabled')}</TableHead>
              <TableHead className="text-right">{t('Actions')}</TableHead>
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
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('No rules configured')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.group_name}</TableCell>
                  <TableCell className="font-mono">{rule.model_pattern}</TableCell>
                  <TableCell>
                    <Badge variant={rule.match_mode === 'exact' ? 'default' : 'secondary'}>
                      {rule.match_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatQuota(rule.quota_limit)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('Enabled') : t('Disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingRule(rule)}>
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
      <GroupRuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <GroupRuleDialog
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
        rule={editingRule}
        onSubmit={(data) => editingRule && updateMutation.mutate({ id: editingRule.id, data })}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRule} onOpenChange={(open) => !open && setDeletingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Rule')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete this rule? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRule && deleteMutation.mutate(deletingRule.id)}>
              {t('Delete')}
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
  const [editingRule, setEditingRule] = useState<ModelQuotaPlanRule | null>(null)
  const [deletingRule, setDeletingRule] = useState<ModelQuotaPlanRule | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['model-quota-plan-rules'],
    queryFn: () => getPlanRules({ page_size: 100 }),
  })

  const createMutation = useMutation({
    mutationFn: createPlanRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-plan-rules'] })
      toast.success(t('Rule created successfully'))
      setCreateOpen(false)
    },
    onError: () => toast.error(t('Failed to create rule')),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => updatePlanRule(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-plan-rules'] })
      toast.success(t('Rule updated successfully'))
      setEditingRule(null)
    },
    onError: () => toast.error(t('Failed to update rule')),
  })

  const deleteMutation = useMutation({
    mutationFn: deletePlanRule,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['model-quota-plan-rules'] })
      toast.success(t('Rule deleted successfully'))
      setDeletingRule(null)
    },
    onError: () => toast.error(t('Failed to delete rule')),
  })

  const rules = data?.data?.items ?? []

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="size-4 mr-2" />
          {t('Add Rule')}
        </Button>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('Plan ID')}</TableHead>
              <TableHead>{t('Model Pattern')}</TableHead>
              <TableHead>{t('Match Mode')}</TableHead>
              <TableHead>{t('Quota Limit')}</TableHead>
              <TableHead>{t('Enabled')}</TableHead>
              <TableHead className="text-right">{t('Actions')}</TableHead>
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
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  {t('No rules configured')}
                </TableCell>
              </TableRow>
            ) : (
              rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.plan_id}</TableCell>
                  <TableCell className="font-mono">{rule.model_pattern}</TableCell>
                  <TableCell>
                    <Badge variant={rule.match_mode === 'exact' ? 'default' : 'secondary'}>
                      {rule.match_mode}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatQuota(rule.quota_limit)}</TableCell>
                  <TableCell>
                    <Badge variant={rule.enabled ? 'default' : 'outline'}>
                      {rule.enabled ? t('Enabled') : t('Disabled')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditingRule(rule)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeletingRule(rule)}>
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
      <PlanRuleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onSubmit={(data) => createMutation.mutate(data)}
        isLoading={createMutation.isPending}
      />

      {/* Edit Dialog */}
      <PlanRuleDialog
        open={!!editingRule}
        onOpenChange={(open) => !open && setEditingRule(null)}
        rule={editingRule}
        onSubmit={(data) => editingRule && updateMutation.mutate({ id: editingRule.id, data })}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingRule} onOpenChange={(open) => !open && setDeletingRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Rule')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('Are you sure you want to delete this rule? This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingRule && deleteMutation.mutate(deletingRule.id)}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group Rule Dialog
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
  const [groupName, setGroupName] = useState(rule?.group_name ?? 'default')
  const [modelPattern, setModelPattern] = useState(rule?.model_pattern ?? '')
  const [matchMode, setMatchMode] = useState<MatchMode>(rule?.match_mode ?? 'exact')
  const [quotaLimit, setQuotaLimit] = useState(String(rule?.quota_limit ?? ''))
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  // Sync form when rule changes
  useState(() => {
    if (rule) {
      setGroupName(rule.group_name)
      setModelPattern(rule.model_pattern)
      setMatchMode(rule.match_mode)
      setQuotaLimit(String(rule.quota_limit))
      setEnabled(rule.enabled)
    }
  })

  const handleSubmit = () => {
    onSubmit({
      group_name: groupName,
      model_pattern: modelPattern,
      match_mode: matchMode,
      quota_limit: parseInt(quotaLimit, 10),
      enabled,
      sort_order: rule?.sort_order ?? 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t('Edit Rule') : t('Create Rule')}</DialogTitle>
          <DialogDescription>
            {t('Configure model-specific quota limits for this group.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('Group Name')}</Label>
            <Input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="default" />
          </div>
          <div className="space-y-2">
            <Label>{t('Model Pattern')}</Label>
            <Input value={modelPattern} onChange={(e) => setModelPattern(e.target.value)} placeholder="gpt-5.5" />
          </div>
          <div className="space-y-2">
            <Label>{t('Match Mode')}</Label>
            <Select value={matchMode} onValueChange={(v) => setMatchMode(v as MatchMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t('Exact Match')}</SelectItem>
                <SelectItem value="prefix">{t('Prefix Match')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Quota Limit')}</Label>
            <Input
              type="number"
              value={quotaLimit}
              onChange={(e) => setQuotaLimit(e.target.value)}
              placeholder="500000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
            {rule ? t('Save') : t('Create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Plan Rule Dialog
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
  const [planId, setPlanId] = useState(String(rule?.plan_id ?? ''))
  const [modelPattern, setModelPattern] = useState(rule?.model_pattern ?? '')
  const [matchMode, setMatchMode] = useState<MatchMode>(rule?.match_mode ?? 'exact')
  const [quotaLimit, setQuotaLimit] = useState(String(rule?.quota_limit ?? ''))
  const [enabled, setEnabled] = useState(rule?.enabled ?? true)

  const handleSubmit = () => {
    onSubmit({
      plan_id: parseInt(planId, 10),
      model_pattern: modelPattern,
      match_mode: matchMode,
      quota_limit: parseInt(quotaLimit, 10),
      enabled,
      sort_order: rule?.sort_order ?? 0,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{rule ? t('Edit Rule') : t('Create Rule')}</DialogTitle>
          <DialogDescription>
            {t('Configure model-specific quota limits for this subscription plan.')}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{t('Plan ID')}</Label>
            <Input
              type="number"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-2">
            <Label>{t('Model Pattern')}</Label>
            <Input value={modelPattern} onChange={(e) => setModelPattern(e.target.value)} placeholder="gpt-5.5" />
          </div>
          <div className="space-y-2">
            <Label>{t('Match Mode')}</Label>
            <Select value={matchMode} onValueChange={(v) => setMatchMode(v as MatchMode)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="exact">{t('Exact Match')}</SelectItem>
                <SelectItem value="prefix">{t('Prefix Match')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t('Quota Limit')}</Label>
            <Input
              type="number"
              value={quotaLimit}
              onChange={(e) => setQuotaLimit(e.target.value)}
              placeholder="500000"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('Cancel')}
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="size-4 mr-2 animate-spin" />}
            {rule ? t('Save') : t('Create')}
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
  const [activeTab, setActiveTab] = useState<'group' | 'plan'>('group')

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Model Quota Rules')}</SectionPageLayout.Title>
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
              {t('Group Rules')}
            </button>
            <button
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'plan'
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setActiveTab('plan')}
            >
              {t('Plan Rules')}
            </button>
          </div>

          {activeTab === 'group' ? <GroupRulesTab /> : <PlanRulesTab />}
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
