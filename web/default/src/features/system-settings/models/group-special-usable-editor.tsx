import { useCallback, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/status-badge'

const OP_ADD = 'add' as const
const OP_REMOVE = 'remove' as const
const OP_APPEND = 'append' as const

type OpType = typeof OP_ADD | typeof OP_REMOVE | typeof OP_APPEND

type Rule = {
  _id: string
  userGroup: string
  op: OpType
  targetGroup: string
  description: string
}

let _idCounter = 0
function uid() {
  return `gsu_${++_idCounter}`
}

function parsePrefix(rawKey: string): { op: OpType; groupName: string } {
  if (rawKey.startsWith('+:')) return { op: OP_ADD, groupName: rawKey.slice(2) }
  if (rawKey.startsWith('-:'))
    return { op: OP_REMOVE, groupName: rawKey.slice(2) }
  return { op: OP_APPEND, groupName: rawKey }
}

function toRawKey(op: OpType, groupName: string): string {
  if (op === OP_ADD) return `+:${groupName}`
  if (op === OP_REMOVE) return `-:${groupName}`
  return groupName
}

function safeParseJson(str: string): Record<string, Record<string, string>> {
  if (!str || !str.trim()) return {}
  try {
    return JSON.parse(str) as Record<string, Record<string, string>>
  } catch {
    return {}
  }
}

function flattenRules(nested: Record<string, Record<string, string>>): Rule[] {
  const rules: Rule[] = []
  for (const [userGroup, inner] of Object.entries(nested)) {
    if (typeof inner !== 'object' || inner === null) continue
    for (const [rawKey, desc] of Object.entries(inner)) {
      const { op, groupName } = parsePrefix(rawKey)
      rules.push({
        _id: uid(),
        userGroup,
        op,
        targetGroup: groupName,
        description:
          op === OP_REMOVE ? 'remove' : typeof desc === 'string' ? desc : '',
      })
    }
  }
  return rules
}

function nestRules(rules: Rule[]): Record<string, Record<string, string>> {
  const result: Record<string, Record<string, string>> = {}
  for (const { userGroup, op, targetGroup, description } of rules) {
    if (!userGroup || !targetGroup) continue
    if (!result[userGroup]) result[userGroup] = {}
    result[userGroup][toRawKey(op, targetGroup)] = description
  }
  return result
}

function serializeRules(rules: Rule[]): string {
  const nested = nestRules(rules)
  return Object.keys(nested).length === 0
    ? '{}'
    : JSON.stringify(nested, null, 2)
}

const OP_BADGE_MAP: Record<
  OpType,
  { variant: 'info' | 'danger' | 'neutral'; label: string }
> = {
  [OP_ADD]: { variant: 'info', label: 'Add (+:)' },
  [OP_REMOVE]: { variant: 'danger', label: 'Remove (-:)' },
  [OP_APPEND]: { variant: 'neutral', label: 'Append' },
}

type GroupSpecialUsableRulesEditorProps = {
  value: string
  onChange: (value: string) => void
}

type GroupSectionProps = {
  groupName: string
  items: Rule[]
  onUpdate: (id: string, field: keyof Rule, val: string) => void
  onRemove: (id: string) => void
  onAdd: (groupName: string) => void
  onRemoveGroup: (groupName: string) => void
}

function GroupSection(props: GroupSectionProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className='rounded-lg border'>
        <div className='flex items-center justify-between p-3'>
          <div className='flex items-center gap-2'>
            <CollapsibleTrigger asChild>
              <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                {open ? (
                  <ChevronUp className='h-4 w-4' />
                ) : (
                  <ChevronDown className='h-4 w-4' />
                )}
              </Button>
            </CollapsibleTrigger>
            <span className='font-semibold'>{props.groupName}</span>
            <StatusBadge variant='neutral' copyable={false}>
              {props.items.length} {t('rules')}
            </StatusBadge>
          </div>
          <div className='flex items-center gap-1'>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 w-7 p-0'
              onClick={() => props.onAdd(props.groupName)}
            >
              <Plus className='h-4 w-4' />
            </Button>
            <Button
              variant='ghost'
              size='sm'
              className='text-destructive h-7 w-7 p-0'
              onClick={() => props.onRemoveGroup(props.groupName)}
            >
              <Trash2 className='h-4 w-4' />
            </Button>
          </div>
        </div>
        <CollapsibleContent>
          <div className='space-y-2 border-t p-3'>
            {props.items.map((rule) => (
              <div key={rule._id} className='flex items-center gap-2'>
                <Select
                  value={rule.op}
                  onValueChange={(v) => props.onUpdate(rule._id, 'op', v)}
                >
                  <SelectTrigger className='w-[130px]'>
                    <SelectValue>
                      <StatusBadge
                        label={t(OP_BADGE_MAP[rule.op].label)}
                        variant={OP_BADGE_MAP[rule.op].variant}
                        copyable={false}
                      />
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OP_ADD}>
                      <StatusBadge
                        label={t(OP_BADGE_MAP[OP_ADD].label)}
                        variant={OP_BADGE_MAP[OP_ADD].variant}
                        copyable={false}
                      />
                    </SelectItem>
                    <SelectItem value={OP_REMOVE}>
                      <StatusBadge
                        label={t(OP_BADGE_MAP[OP_REMOVE].label)}
                        variant={OP_BADGE_MAP[OP_REMOVE].variant}
                        copyable={false}
                      />
                    </SelectItem>
                    <SelectItem value={OP_APPEND}>
                      <StatusBadge
                        label={t(OP_BADGE_MAP[OP_APPEND].label)}
                        variant={OP_BADGE_MAP[OP_APPEND].variant}
                        copyable={false}
                      />
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  className='flex-1'
                  value={rule.targetGroup}
                  placeholder={t('Group name')}
                  onChange={(e) =>
                    props.onUpdate(rule._id, 'targetGroup', e.target.value)
                  }
                />
                {rule.op !== OP_REMOVE ? (
                  <Input
                    className='flex-1'
                    value={rule.description}
                    placeholder={t('Description')}
                    onChange={(e) =>
                      props.onUpdate(rule._id, 'description', e.target.value)
                    }
                  />
                ) : (
                  <div className='text-muted-foreground flex-1 px-3 text-sm'>
                    -
                  </div>
                )}
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-destructive h-8 w-8 p-0'
                  onClick={() => props.onRemove(rule._id)}
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  )
}

export function GroupSpecialUsableRulesEditor(
  props: GroupSpecialUsableRulesEditorProps
) {
  const { t } = useTranslation()
  const [rules, setRules] = useState<Rule[]>(() =>
    flattenRules(safeParseJson(props.value))
  )
  const [newGroupName, setNewGroupName] = useState('')

  const { onChange } = props
  const emitChange = useCallback(
    (newRules: Rule[]) => {
      setRules(newRules)
      onChange(serializeRules(newRules))
    },
    [onChange]
  )

  const updateRule = useCallback(
    (id: string, field: keyof Rule, val: string) => {
      emitChange(
        rules.map((r) => {
          if (r._id !== id) return r
          const updated = { ...r, [field]: val }
          if (field === 'op' && val === OP_REMOVE)
            updated.description = 'remove'
          else if (field === 'op' && r.op === OP_REMOVE && val !== OP_REMOVE) {
            if (updated.description === 'remove') updated.description = ''
          }
          return updated
        })
      )
    },
    [rules, emitChange]
  )

  const removeRule = useCallback(
    (id: string) => emitChange(rules.filter((r) => r._id !== id)),
    [rules, emitChange]
  )

  const removeGroup = useCallback(
    (groupName: string) =>
      emitChange(rules.filter((r) => r.userGroup !== groupName)),
    [rules, emitChange]
  )

  const addRuleToGroup = useCallback(
    (groupName: string) => {
      emitChange([
        ...rules,
        {
          _id: uid(),
          userGroup: groupName,
          op: OP_APPEND,
          targetGroup: '',
          description: '',
        },
      ])
    },
    [rules, emitChange]
  )

  const addNewGroup = useCallback(() => {
    const name = newGroupName.trim()
    if (!name) return
    emitChange([
      ...rules,
      {
        _id: uid(),
        userGroup: name,
        op: OP_APPEND,
        targetGroup: '',
        description: '',
      },
    ])
    setNewGroupName('')
  }, [rules, emitChange, newGroupName])

  const grouped = useMemo(() => {
    const map: Record<string, Rule[]> = {}
    const order: string[] = []
    for (const r of rules) {
      if (!r.userGroup) continue
      if (!map[r.userGroup]) {
        map[r.userGroup] = []
        order.push(r.userGroup)
      }
      map[r.userGroup].push(r)
    }
    return order.map((name) => ({ name, items: map[name] }))
  }, [rules])

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Special usable group rules')}</CardTitle>
        <CardDescription>
          {t(
            'Define per-group rules to add, remove, or append selectable groups for specific user groups.'
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className='space-y-3'>
          {grouped.length === 0 ? (
            <p className='text-muted-foreground py-4 text-center text-sm'>
              {t('No rules yet. Add a group below to get started.')}
            </p>
          ) : (
            grouped.map((group) => (
              <GroupSection
                key={group.name}
                groupName={group.name}
                items={group.items}
                onUpdate={updateRule}
                onRemove={removeRule}
                onAdd={addRuleToGroup}
                onRemoveGroup={removeGroup}
              />
            ))
          )}

          <div className='flex items-center justify-center gap-2 pt-2'>
            <Input
              className='w-[200px]'
              value={newGroupName}
              placeholder={t('User group name')}
              onChange={(e) => setNewGroupName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addNewGroup()
                }
              }}
            />
            <Button variant='outline' size='sm' onClick={addNewGroup}>
              <Plus className='mr-1 h-4 w-4' />
              {t('Add group rules')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
