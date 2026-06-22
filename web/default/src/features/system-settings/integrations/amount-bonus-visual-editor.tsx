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
import { useMemo, useState } from 'react'
import { Check as CheckIcon, ChevronDown, Pencil, Plus, Trash2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getAssignableUserGroups } from '@/features/users/api'
import {
  AMOUNT_BONUS_GROUP_ALL,
  parseAmountBonusGroupsJson,
  parseAmountBonusJson,
  parseAmountBonusLimitJson,
  removeAmountBonusGroups,
  serializeAmountBonusTiers,
  setAmountBonusGroups,
  setAmountBonusLimit,
  upsertAmountBonusTier,
  type AmountBonusTier,
} from './amount-bonus-utils'

type AmountBonusVisualEditorProps = {
  value: string
  onChange: (value: string) => void
  limitValue?: string
  onLimitChange?: (value: string) => void
  groupsValue?: string
  onGroupsChange?: (value: string) => void
}

// TierGroupSelect 是某档位「生效用户组」的行内下拉多选。
// 勾选即时回写该档位白名单：勾 all → 仅保留 ["all"]；勾具体组 → 自动去掉 all。
// 空选 = 显式配置为「谁都不送」（opt-in 语义）。
function TierGroupSelect({
  selected,
  options,
  onChange,
}: {
  selected: string[]
  options: string[]
  onChange: (groups: string[]) => void
}) {
  const { t } = useTranslation()

  const hasAll = selected.includes(AMOUNT_BONUS_GROUP_ALL)

  const toggle = (group: string) => {
    if (group === AMOUNT_BONUS_GROUP_ALL) {
      // 勾 all = 全部用户组；与具体组互斥，直接收敛为 ["all"]。再次点击则清空。
      onChange(hasAll ? [] : [AMOUNT_BONUS_GROUP_ALL])
      return
    }
    // 勾具体组时，自动剥离 all（从「全部」切换到「按组」）。
    const base = selected.filter((g) => g !== AMOUNT_BONUS_GROUP_ALL)
    if (base.includes(group)) {
      onChange(base.filter((g) => g !== group))
    } else {
      onChange([...base, group])
    }
  }

  // 触发按钮上的摘要文案。
  const summary = (() => {
    if (hasAll) {
      return <span className='text-foreground'>{t('All user groups')}</span>
    }
    if (selected.length === 0) {
      return (
        <span className='text-destructive'>{t('No groups (not granted)')}</span>
      )
    }
    if (selected.length <= 2) {
      return <span className='text-foreground'>{selected.join(', ')}</span>
    }
    return (
      <span className='text-foreground'>
        {t('{{count}} groups', { count: selected.length })}
      </span>
    )
  })()

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 w-full min-w-40 justify-between font-normal'
          />
        }
      >
        <span className='truncate'>{summary}</span>
        <ChevronDown className='text-muted-foreground ml-2 size-4 shrink-0' />
      </PopoverTrigger>
      <PopoverContent className='max-w-[320px] min-w-[200px] p-0' align='start'>
        <Command>
          <CommandList>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            <CommandGroup>
              <CommandItem
                key={AMOUNT_BONUS_GROUP_ALL}
                onSelect={() => toggle(AMOUNT_BONUS_GROUP_ALL)}
              >
                <div
                  className={cn(
                    'border-primary flex size-4 items-center justify-center rounded-sm border',
                    hasAll
                      ? 'bg-primary text-primary-foreground'
                      : 'opacity-50 [&_svg]:invisible'
                  )}
                >
                  <CheckIcon className='text-background h-4 w-4' />
                </div>
                <span className='min-w-0 flex-1 truncate font-medium'>
                  {t('all (every group)')}
                </span>
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              {options.map((group) => {
                const isSelected = !hasAll && selected.includes(group)
                return (
                  <CommandItem
                    key={group}
                    onSelect={() => toggle(group)}
                    // all 选中时具体组置灰：语义上已涵盖全部，避免误解。
                    className={cn(hasAll && 'opacity-50')}
                  >
                    <div
                      className={cn(
                        'border-primary flex size-4 items-center justify-center rounded-sm border',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible'
                      )}
                    >
                      <CheckIcon className='text-background h-4 w-4' />
                    </div>
                    <span className='min-w-0 flex-1 truncate' title={group}>
                      {group}
                    </span>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function AmountBonusVisualEditor({
  value,
  onChange,
  limitValue = '',
  onLimitChange,
  groupsValue = '',
  onGroupsChange,
}: AmountBonusVisualEditorProps) {
  const { t } = useTranslation()
  const [amount, setAmount] = useState('')
  const [bonusAmount, setBonusAmount] = useState('')
  const [claimLimit, setClaimLimit] = useState('')
  const [draftGroups, setDraftGroups] = useState<string[]>([])
  const [editData, setEditData] = useState<AmountBonusTier | null>(null)

  const tiers = useMemo(() => parseAmountBonusJson(value), [value])
  const limits = useMemo(
    () => parseAmountBonusLimitJson(limitValue),
    [limitValue]
  )
  const groupsByTier = useMemo(
    () => parseAmountBonusGroupsJson(groupsValue),
    [groupsValue]
  )

  // 可分配的用户组（user.Group 权威来源，与后端 GetUserGroup 同源）。
  const { data: userGroups = [] } = useQuery({
    queryKey: ['assignable-user-groups'],
    queryFn: async () => {
      const res = await getAssignableUserGroups()
      return res.data ?? []
    },
    staleTime: 5 * 60 * 1000,
  })

  const amountNumber = Number(amount)
  const bonusAmountNumber = Number(bonusAmount)
  const claimLimitNumber = claimLimit.trim() === '' ? 0 : Number(claimLimit)
  // 编辑某档位时把充值金额改成另一个「已存在」档位，会覆盖目标档位的赠送/限次/白名单，
  // 属于误操作——禁止保存。新增模式不算冲突：输入已存在金额是正常的 upsert（更新该档位）。
  const amountConflict =
    !!editData &&
    editData.amount !== amountNumber &&
    tiers.some((tier) => tier.amount === amountNumber)
  const canSave =
    Number.isInteger(amountNumber) &&
    amountNumber > 0 &&
    Number.isInteger(bonusAmountNumber) &&
    bonusAmountNumber > 0 &&
    Number.isInteger(claimLimitNumber) &&
    claimLimitNumber >= 0 &&
    !amountConflict

  const resetDraft = () => {
    setAmount('')
    setBonusAmount('')
    setClaimLimit('')
    setDraftGroups([])
    setEditData(null)
  }

  const handleSave = () => {
    if (!canSave) {
      return
    }

    onChange(
      upsertAmountBonusTier(value, editData, {
        amount: amountNumber,
        bonusAmount: bonusAmountNumber,
      })
    )
    // 编辑时若改了充值金额，先清掉旧金额遗留的限次/白名单 key，避免孤儿残留。
    let nextLimit = limitValue
    let nextGroups = groupsValue
    if (editData && editData.amount !== amountNumber) {
      nextLimit = setAmountBonusLimit(nextLimit, editData.amount, 0)
      nextGroups = removeAmountBonusGroups(nextGroups, editData.amount)
    }
    onLimitChange?.(setAmountBonusLimit(nextLimit, amountNumber, claimLimitNumber))
    // 用草稿里选好的用户组写入该档位白名单（新增/编辑统一）。
    onGroupsChange?.(setAmountBonusGroups(nextGroups, amountNumber, draftGroups))
    resetDraft()
  }

  const handleDelete = (tier: AmountBonusTier) => {
    onChange(
      serializeAmountBonusTiers(
        tiers.filter((item) => item.amount !== tier.amount)
      )
    )
    onLimitChange?.(setAmountBonusLimit(limitValue, tier.amount, 0))
    onGroupsChange?.(removeAmountBonusGroups(groupsValue, tier.amount))
    if (editData?.amount === tier.amount) {
      resetDraft()
    }
  }

  const handleEdit = (tier: AmountBonusTier) => {
    setEditData(tier)
    setAmount(String(tier.amount))
    setBonusAmount(String(tier.bonusAmount))
    const existingLimit = limits[tier.amount]
    setClaimLimit(existingLimit ? String(existingLimit) : '')
    setDraftGroups(groupsByTier[tier.amount] ?? [])
  }

  // 表格内「生效用户组」只读展示（编辑入口统一在下方添加/编辑区，避免双写冲突）。
  // opt-in 语义：空 = 不发放（红色提示）；含 all = 全部用户组；否则列出组名。
  const renderTierGroups = (tierAmount: number) => {
    const groups = groupsByTier[tierAmount]
    if (!groups || groups.length === 0) {
      return <Badge variant='destructive'>{t('No groups (not granted)')}</Badge>
    }
    if (groups.includes(AMOUNT_BONUS_GROUP_ALL)) {
      return <Badge variant='secondary'>{t('All user groups')}</Badge>
    }
    return (
      <div className='flex flex-wrap gap-1'>
        {groups.map((group) => (
          <Badge key={group} variant='outline'>
            {group}
          </Badge>
        ))}
      </div>
    )
  }

  return (
    <div className='space-y-4'>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Configure bonus credit for each recharge amount. Values use the same unit as recharge amounts.'
        )}
      </p>
      <p className='text-muted-foreground text-sm'>
        {t(
          'Bonus is granted only to the selected user groups. Leave groups empty to grant to nobody; pick "all" to grant to every group.'
        )}
      </p>

      {tiers.length === 0 ? (
        <div className='text-muted-foreground rounded-lg border border-dashed p-6 text-center text-sm'>
          {t(
            'No bonus tiers configured. Add a recharge amount and bonus amount below.'
          )}
        </div>
      ) : (
        <div className='rounded-md border'>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('Recharge Amount')}</TableHead>
                <TableHead>{t('Bonus Credit')}</TableHead>
                <TableHead>{t('Wallet Credit')}</TableHead>
                <TableHead>{t('Claim Limit')}</TableHead>
                <TableHead className='min-w-44'>
                  {t('Eligible user groups')}
                </TableHead>
                <TableHead className='text-right'>{t('Actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tiers.map((tier) => (
                <TableRow key={tier.amount}>
                  <TableCell className='font-mono'>{tier.amount}</TableCell>
                  <TableCell className='font-mono text-[#FF2D78]'>
                    +{tier.bonusAmount}
                  </TableCell>
                  <TableCell className='font-mono'>
                    {tier.amount + tier.bonusAmount}
                  </TableCell>
                  <TableCell className='font-mono'>
                    {limits[tier.amount] ? limits[tier.amount] : t('Unlimited')}
                  </TableCell>
                  <TableCell>{renderTierGroups(tier.amount)}</TableCell>
                  <TableCell className='text-right'>
                    <div className='flex justify-end gap-2'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleEdit(tier)
                        }}
                      >
                        <Pencil className='h-4 w-4' />
                      </Button>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        onClick={(event) => {
                          event.preventDefault()
                          event.stopPropagation()
                          handleDelete(tier)
                        }}
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className='grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end'>
        <div>
          <Label htmlFor='amount-bonus-recharge' className='mb-2 block'>
            {t('Recharge Amount')}
          </Label>
          <Input
            id='amount-bonus-recharge'
            type='number'
            step='1'
            min='1'
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder={t('e.g., 20')}
          />
          {amountConflict && (
            <p className='text-destructive mt-1 text-xs'>
              {t('A bonus tier with this recharge amount already exists.')}
            </p>
          )}
        </div>
        <div>
          <Label htmlFor='amount-bonus-credit' className='mb-2 block'>
            {t('Bonus Credit')}
          </Label>
          <Input
            id='amount-bonus-credit'
            type='number'
            step='1'
            min='1'
            value={bonusAmount}
            onChange={(event) => setBonusAmount(event.target.value)}
            placeholder={t('e.g., 5')}
          />
        </div>
        <div>
          <Label htmlFor='amount-bonus-limit' className='mb-2 block'>
            {t('Claim Limit')}
          </Label>
          <Input
            id='amount-bonus-limit'
            type='number'
            step='1'
            min='0'
            value={claimLimit}
            onChange={(event) => setClaimLimit(event.target.value)}
            placeholder={t('0 = unlimited')}
          />
        </div>
        <div>
          <Label className='mb-2 block'>{t('Eligible user groups')}</Label>
          <TierGroupSelect
            selected={draftGroups}
            options={userGroups}
            onChange={setDraftGroups}
          />
        </div>
        <Button
          type='button'
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleSave()
          }}
          disabled={!canSave}
          className='w-full sm:w-auto'
        >
          <Plus className='h-4 w-4 sm:mr-2' />
          <span>{editData ? t('Update') : t('Add')}</span>
        </Button>
      </div>
      <p className='text-muted-foreground text-xs'>
        {t(
          'Tip: pick eligible user groups here. To change a tier later, click edit on its row.'
        )}
      </p>
    </div>
  )
}
