/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getPricing } from '@/features/pricing/api'
import {
  getResellerDownlines,
  getResellerRules,
  saveResellerRules,
} from '../api'
import { type User } from '../types'

type ResellerRulesPanelProps = {
  resellerId: number
  enabled: boolean
}

function accountEmailLabel(user: User): string {
  if (user.email) return user.email
  return user.username ? `${user.username} · ${user.id}` : String(user.id)
}

export function ResellerRulesPanel({
  resellerId,
  enabled,
}: ResellerRulesPanelProps) {
  const [selectedDownlineId, setSelectedDownlineId] = useState<number>(0)
  const [ratios, setRatios] = useState<Record<string, string>>({})
  const [isSaving, setIsSaving] = useState(false)

  const downlinesQuery = useQuery({
    queryKey: ['reseller-downlines', resellerId],
    queryFn: () => getResellerDownlines(resellerId),
    enabled: enabled && resellerId > 0,
  })

  const pricingQuery = useQuery({
    queryKey: ['pricing'],
    queryFn: getPricing,
    enabled,
    staleTime: 5 * 60 * 1000,
  })

  const downlines = useMemo(
    () => downlinesQuery.data?.data || [],
    [downlinesQuery.data?.data]
  )
  const models = useMemo(() => {
    const names = pricingQuery.data?.data?.map((item) => item.model_name) || []
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b))
  }, [pricingQuery.data?.data])

  const rulesQuery = useQuery({
    queryKey: ['reseller-rules', resellerId, selectedDownlineId],
    queryFn: () => getResellerRules(resellerId, selectedDownlineId),
    enabled: enabled && resellerId > 0 && selectedDownlineId > 0,
  })

  useEffect(() => {
    if (!selectedDownlineId && downlines.length > 0) {
      setSelectedDownlineId(downlines[0].id)
    }
  }, [downlines, selectedDownlineId])

  useEffect(() => {
    const next: Record<string, string> = {}
    for (const name of models) {
      next[name] = '1'
    }
    for (const rule of rulesQuery.data?.data || []) {
      if (rule.model_name) {
        next[rule.model_name] = String(rule.discount_ratio)
      }
    }
    setRatios(next)
  }, [models, rulesQuery.data?.data])

  const saveRules = async () => {
    if (!selectedDownlineId) return
    const rules = models.map((modelName) => ({
      model_name: modelName,
      discount_ratio: Number(ratios[modelName] || 1),
      enabled: true,
    }))
    const invalid = rules.find(
      (rule) =>
        !Number.isFinite(rule.discount_ratio) ||
        rule.discount_ratio <= 0 ||
        rule.discount_ratio > 1
    )
    if (invalid) {
      toast.error('折扣比例必须大于 0 且小于等于 1')
      return
    }
    setIsSaving(true)
    try {
      const result = await saveResellerRules(resellerId, {
        downline_user_id: selectedDownlineId,
        rules,
      })
      if (result.success) {
        toast.success('分销商折扣比例已保存')
        await rulesQuery.refetch()
      } else {
        toast.error(result.message || '保存失败')
      }
    } catch (_error) {
      toast.error('保存失败')
    } finally {
      setIsSaving(false)
    }
  }

  if (!enabled) return null

  return (
    <div className='space-y-4'>
      <div className='flex items-end gap-2'>
        <div className='min-w-0 flex-1 space-y-2'>
          <Label>下线邮箱</Label>
          <Select
            value={selectedDownlineId ? String(selectedDownlineId) : ''}
            onValueChange={(value) => setSelectedDownlineId(Number(value))}
            disabled={downlines.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder='选择下线邮箱' />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectGroup>
                {downlines.map((user) => (
                  <SelectItem key={user.id} value={String(user.id)}>
                    {accountEmailLabel(user)}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <Button
          type='button'
          onClick={saveRules}
          disabled={!selectedDownlineId || models.length === 0 || isSaving}
        >
          <Save className='mr-1 h-4 w-4' />
          {isSaving ? '保存中...' : '保存折扣比例'}
        </Button>
      </div>

      {selectedDownlineId > 0 && models.length > 0 && (
        <div className='max-h-[360px] overflow-auto rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>模型</TableHead>
                <TableHead className='w-[150px]'>折扣比例</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {models.map((modelName) => (
                <TableRow key={modelName}>
                  <TableCell className='max-w-[320px] truncate font-mono text-xs'>
                    {modelName}
                  </TableCell>
                  <TableCell>
                    <Input
                      type='number'
                      min='0.0001'
                      max='1'
                      step='0.0001'
                      value={ratios[modelName] || '1'}
                      onChange={(event) =>
                        setRatios((prev) => ({
                          ...prev,
                          [modelName]: event.target.value,
                        }))
                      }
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
