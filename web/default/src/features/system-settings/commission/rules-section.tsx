import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { listCommissionRules, createCommissionRule, updateCommissionRule, deleteCommissionRule, toggleCommissionRule, type CommissionRule, type CommissionRuleForm } from './rule-api'

interface RulesSectionProps { maxLevel?: number }

const EMPTY_FORM: CommissionRuleForm = {
  rule_code: '', rule_name: '', rule_type: 'percentage',
  level1_rate: 0, level2_rate: 0, level3_rate: 0,
  min_consumption: 0, max_commission: 0, daily_limit: 0, monthly_limit: 0,
  applicable_models: '', excluded_models: '', is_active: true, priority: 0,
}

export function RulesSection({ maxLevel = 3 }: RulesSectionProps) {
  const { t } = useTranslation()
  const [rules, setRules] = useState<CommissionRule[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<CommissionRuleForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const fetchRules = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listCommissionRules()
      if (res.success && res.data) setRules(res.data)
    } catch { /* */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRules() }, [fetchRules])

  const openCreate = () => { setEditingId(null); setForm(EMPTY_FORM); setErrors({}); setDialogOpen(true) }
  const openEdit = (rule: CommissionRule) => {
    setEditingId(rule.id)
    setForm({ rule_code: rule.rule_code, rule_name: rule.rule_name, rule_type: 'percentage', level1_rate: rule.level1_rate, level2_rate: rule.level2_rate, level3_rate: rule.level3_rate, min_consumption: rule.min_consumption, max_commission: rule.max_commission, daily_limit: rule.daily_limit, monthly_limit: rule.monthly_limit, applicable_models: rule.applicable_models || '', excluded_models: rule.excluded_models || '', is_active: rule.is_active, priority: rule.priority })
    setErrors({}); setDialogOpen(true)
  }

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.rule_code.trim()) errs.rule_code = t('必填')
    if (!form.rule_name.trim()) errs.rule_name = t('必填')
    if (form.level1_rate < 0 || form.level1_rate > 1) errs.level1_rate = t('比例须在 0-1 之间')
    if (form.min_consumption < 0) errs.min_consumption = t('不能为负')
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSave = async () => {
    if (!validate()) return
    setSaving(true)
    try {
      const res = editingId ? await updateCommissionRule(editingId, form) : await createCommissionRule(form)
      if (res.success) { toast.success(editingId ? t('更新成功') : t('创建成功')); setDialogOpen(false); fetchRules() }
      else toast.error(res.message || t('操作失败'))
    } catch { toast.error(t('操作失败')) } finally { setSaving(false) }
  }

  const handleToggle = async (id: number) => {
    try { const res = await toggleCommissionRule(id); if (res.success) fetchRules(); else toast.error(res.message || t('操作失败')) }
    catch { toast.error(t('操作失败')) }
  }

  const handleDelete = async () => {
    if (deleteId === null) return
    try { const res = await deleteCommissionRule(deleteId); if (res.success) { toast.success(t('删除成功')); fetchRules() } else toast.error(res.message || t('删除失败')) }
    catch { toast.error(t('删除失败')) }
    setDeleteId(null)
  }

  const updateForm = <K extends keyof CommissionRuleForm>(key: K, value: CommissionRuleForm[K]) => setForm((prev) => ({ ...prev, [key]: value }))
  const rateToPercent = (rate: number) => Math.round(rate * 100)
  const percentToRate = (pct: number) => pct / 100

  return (
    <>
      <Card className='bg-muted/20 py-0'>
        <CardHeader className='flex flex-row items-center justify-between p-4 sm:p-5'>
          <div>
            <CardTitle className='text-sm font-semibold'>{t('返佣规则')}</CardTitle>
            <p className='text-muted-foreground mt-1 text-xs'>{rules.length === 0 && t('暂无启用规则,返佣开关将无法开启')}</p>
          </div>
          <Button size='sm' className='h-8' onClick={openCreate}><Plus className='mr-1 size-3.5' />{t('新建规则')}</Button>
        </CardHeader>
        <CardContent className='p-0'>
          <div className='overflow-x-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('名称')}</TableHead>
                  <TableHead>{t('代码')}</TableHead>
                  <TableHead className='text-center'>L1 %</TableHead>
                  {maxLevel >= 2 && <TableHead className='text-center'>L2 %</TableHead>}
                  {maxLevel >= 3 && <TableHead className='text-center'>L3 %</TableHead>}
                  <TableHead className='text-right'>{t('消费门槛')}</TableHead>
                  <TableHead className='text-right'>{t('单次上限')}</TableHead>
                  <TableHead className='text-center'>{t('状态')}</TableHead>
                  <TableHead className='text-center'>{t('优先级')}</TableHead>
                  <TableHead className='text-right'>{t('操作')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>{Array.from({ length: 10 }).map((_, j) => <TableCell key={j}><Skeleton className='h-4 w-12' /></TableCell>)}</TableRow>
                  ))
                ) : rules.length === 0 ? (
                  <TableRow><TableCell colSpan={10} className='text-muted-foreground py-8 text-center'><AlertCircle className='mx-auto mb-2 size-5 opacity-50' />{t('暂无规则')}</TableCell></TableRow>
                ) : (
                  rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className='font-medium text-xs'>{rule.rule_name}</TableCell>
                      <TableCell className='font-mono text-xs'>{rule.rule_code}</TableCell>
                      <TableCell className='text-center text-xs tabular-nums'>{rateToPercent(rule.level1_rate)}%</TableCell>
                      {maxLevel >= 2 && <TableCell className='text-center text-xs tabular-nums'>{rateToPercent(rule.level2_rate)}%</TableCell>}
                      {maxLevel >= 3 && <TableCell className='text-center text-xs tabular-nums'>{rateToPercent(rule.level3_rate)}%</TableCell>}
                      <TableCell className='text-right text-xs tabular-nums'>{rule.min_consumption}</TableCell>
                      <TableCell className='text-right text-xs tabular-nums'>{rule.max_commission}</TableCell>
                      <TableCell className='text-center'><Switch checked={rule.is_active} onCheckedChange={() => handleToggle(rule.id)} className='scale-75' /></TableCell>
                      <TableCell className='text-center text-xs'>{rule.priority}</TableCell>
                      <TableCell className='text-right'>
                        <div className='flex items-center justify-end gap-1'>
                          <Button variant='ghost' size='icon' className='size-7' onClick={() => openEdit(rule)}><Pencil className='size-3.5' /></Button>
                          <Button variant='ghost' size='icon' className='size-7 text-red-500 hover:text-red-600' onClick={() => setDeleteId(rule.id)}><Trash2 className='size-3.5' /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className='max-h-[85vh] overflow-y-auto sm:max-w-lg'>
          <DialogHeader><DialogTitle>{editingId ? t('编辑规则') : t('新建规则')}</DialogTitle></DialogHeader>
          <div className='space-y-4 py-2'>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('规则代码')}</Label>
                <Input value={form.rule_code} onChange={(e) => updateForm('rule_code', e.target.value)} disabled={!!editingId} className='font-mono text-xs' />
                {errors.rule_code && <p className='text-xs text-red-500'>{errors.rule_code}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('规则名称')}</Label>
                <Input value={form.rule_name} onChange={(e) => updateForm('rule_name', e.target.value)} />
                {errors.rule_name && <p className='text-xs text-red-500'>{errors.rule_name}</p>}
              </div>
            </div>
            <div className='grid gap-4 sm:grid-cols-3'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>L1 {t('比例')} (%)</Label>
                <Input type='number' value={rateToPercent(form.level1_rate)} onChange={(e) => updateForm('level1_rate', percentToRate(Number(e.target.value)))} min={0} max={100} className='font-mono' />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>L2 {t('比例')} (%)</Label>
                <Input type='number' value={rateToPercent(form.level2_rate)} onChange={(e) => updateForm('level2_rate', percentToRate(Number(e.target.value)))} min={0} max={100} disabled={maxLevel < 2} className='font-mono' />
                {maxLevel < 2 && <p className='text-muted-foreground text-[10px]'>{t('当前层级设置为1级,此项不生效')}</p>}
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>L3 {t('比例')} (%)</Label>
                <Input type='number' value={rateToPercent(form.level3_rate)} onChange={(e) => updateForm('level3_rate', percentToRate(Number(e.target.value)))} min={0} max={100} disabled={maxLevel < 3} className='font-mono' />
                {maxLevel < 3 && <p className='text-muted-foreground text-[10px]'>{t('当前层级设置不支持3级')}</p>}
              </div>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('消费门槛')}</Label>
                <Input type='number' value={form.min_consumption} onChange={(e) => updateForm('min_consumption', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('单次返佣上限')}</Label>
                <Input type='number' value={form.max_commission} onChange={(e) => updateForm('max_commission', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
              </div>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('每日限额')}</Label>
                <Input type='number' value={form.daily_limit} onChange={(e) => updateForm('daily_limit', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
                <p className='text-muted-foreground text-[10px]'>{t('0 = 不限')}</p>
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('每月限额')}</Label>
                <Input type='number' value={form.monthly_limit} onChange={(e) => updateForm('monthly_limit', Math.max(0, Number(e.target.value)))} min={0} className='font-mono' />
              </div>
            </div>
            <div className='grid gap-4 sm:grid-cols-2'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('适用模型')}</Label>
                <Input value={form.applicable_models} onChange={(e) => updateForm('applicable_models', e.target.value)} placeholder={t('逗号分隔,空=全部')} className='text-xs' />
              </div>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('排除模型')}</Label>
                <Input value={form.excluded_models} onChange={(e) => updateForm('excluded_models', e.target.value)} placeholder={t('逗号分隔')} className='text-xs' />
              </div>
            </div>
            <div className='flex items-center gap-4'>
              <div className='space-y-1.5'>
                <Label className='text-xs'>{t('优先级')}</Label>
                <Input type='number' value={form.priority} onChange={(e) => updateForm('priority', Number(e.target.value))} className='w-24 font-mono' />
              </div>
              <div className='flex items-center gap-2 pt-4'>
                <Switch checked={form.is_active} onCheckedChange={(v) => updateForm('is_active', v)} />
                <Label className='text-xs'>{t('启用')}</Label>
              </div>
            </div>
          </div>
          <DialogFooter className='grid grid-cols-2 gap-2 sm:flex'>
            <Button variant='outline' onClick={() => setDialogOpen(false)} disabled={saving}>{t('取消')}</Button>
            <Button onClick={handleSave} disabled={saving}>{saving && <Loader2 className='mr-2 h-4 w-4 animate-spin' />}{editingId ? t('保存') : t('创建')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('确认删除')}</AlertDialogTitle>
            <AlertDialogDescription>{t('删除后不可恢复,确定要删除这条规则吗?')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('取消')}</AlertDialogCancel>
            <AlertDialogAction className='bg-red-500 hover:bg-red-600' onClick={handleDelete}>{t('删除')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
