/*
Copyright (C) 2025 QuantumNous

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
import React, { useState, useCallback, useMemo } from 'react';
import { Button, Input } from '@heroui/react';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

let _idCounter = 0;
const uid = () => `gsu_${++_idCounter}`;

const OP_ADD = 'add';
const OP_REMOVE = 'remove';
const OP_APPEND = 'append';

function parsePrefix(rawKey) {
  if (rawKey.startsWith('+:')) return { op: OP_ADD, groupName: rawKey.slice(2) };
  if (rawKey.startsWith('-:')) return { op: OP_REMOVE, groupName: rawKey.slice(2) };
  return { op: OP_APPEND, groupName: rawKey };
}

function toRawKey(op, groupName) {
  if (op === OP_ADD) return `+:${groupName}`;
  if (op === OP_REMOVE) return `-:${groupName}`;
  return groupName;
}

function parseJSON(str) {
  if (!str || !str.trim()) return {};
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}

function flattenRules(nested) {
  const rules = [];
  for (const [userGroup, inner] of Object.entries(nested)) {
    if (typeof inner !== 'object' || inner === null) continue;
    for (const [rawKey, desc] of Object.entries(inner)) {
      const { op, groupName } = parsePrefix(rawKey);
      rules.push({
        _id: uid(),
        userGroup,
        op,
        targetGroup: groupName,
        description:
          op === OP_REMOVE ? 'remove' : typeof desc === 'string' ? desc : '',
      });
    }
  }
  return rules;
}

function nestRules(rules) {
  const result = {};
  rules.forEach(({ userGroup, op, targetGroup, description }) => {
    if (!userGroup || !targetGroup) return;
    if (!result[userGroup]) result[userGroup] = {};
    result[userGroup][toRawKey(op, targetGroup)] = description;
  });
  return result;
}

export function serializeGroupSpecialUsable(rules) {
  const nested = nestRules(rules);
  return Object.keys(nested).length === 0
    ? ''
    : JSON.stringify(nested, null, 2);
}

const inputClass =
  'h-8 w-full rounded-md border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary';

const opStyles = {
  [OP_ADD]:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  [OP_REMOVE]:
    'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  [OP_APPEND]:
    'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
};

function UsableGroupSection({
  groupName,
  items,
  opOptions,
  onUpdate,
  onRemove,
  onAdd,
  t,
}) {
  const [open, setOpen] = useState(false);

  const removeAll = () => {
    if (typeof window !== 'undefined' && !window.confirm(t('确认删除该分组的所有规则？'))) {
      return;
    }
    items.forEach((item) => onRemove(item._id));
  };

  const removeOne = (id) => {
    if (typeof window !== 'undefined' && !window.confirm(t('确认删除该规则？'))) {
      return;
    }
    onRemove(id);
  };

  return (
    <div className='overflow-hidden rounded-lg border border-[color:var(--app-border)]'>
      <div
        className='flex cursor-pointer items-center justify-between bg-[color:var(--app-background)] px-3 py-2'
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className='flex items-center gap-2'>
          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          <span className='text-sm font-semibold text-foreground'>
            {groupName}
          </span>
          <span className='inline-flex items-center rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'>
            {items.length} {t('条规则')}
          </span>
        </div>
        <div
          className='flex items-center gap-1'
          onClick={(event) => event.stopPropagation()}
        >
          <Button
            isIconOnly
            variant='light'
            size='sm'
            aria-label={t('添加')}
            onPress={() => onAdd(groupName)}
          >
            <Plus size={14} />
          </Button>
          <Button
            isIconOnly
            variant='light'
            color='danger'
            size='sm'
            aria-label={t('删除该分组')}
            onPress={removeAll}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>
      {open ? (
        <div className='space-y-1.5 px-3 py-2'>
          {items.map((rule) => {
            const opStyle = opStyles[rule.op] || '';
            return (
              <div key={rule._id} className='flex items-center gap-2'>
                <div className='relative w-32'>
                  <select
                    value={rule.op}
                    onChange={(event) =>
                      onUpdate(rule._id, 'op', event.target.value)
                    }
                    aria-label={t('操作')}
                    className={`h-8 w-full appearance-none rounded-md border border-[color:var(--app-border)] bg-background px-2 text-xs font-medium text-foreground outline-none transition focus:border-primary ${opStyle}`}
                  >
                    {opOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Input
                  type='text'
                  value={rule.targetGroup || ''}
                  placeholder={t('分组名称')}
                  onChange={(event) =>
                    onUpdate(rule._id, 'targetGroup', event.target.value)
                  }
                  aria-label={t('分组名称')}
                  className={`${inputClass} flex-1`}
                />
                {rule.op !== OP_REMOVE ? (
                  <Input
                    type='text'
                    value={rule.description || ''}
                    placeholder={t('分组描述')}
                    onChange={(event) =>
                      onUpdate(rule._id, 'description', event.target.value)
                    }
                    aria-label={t('分组描述')}
                    className={`${inputClass} flex-1`}
                  />
                ) : (
                  <div className='flex-1 text-sm text-muted'>-</div>
                )}
                <Button
                  isIconOnly
                  variant='light'
                  color='danger'
                  size='sm'
                  aria-label={t('删除该规则')}
                  onPress={() => removeOne(rule._id)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

export default function GroupSpecialUsableRules({
  value,
  groupNames = [],
  onChange,
}) {
  const { t } = useTranslation();
  const [rules, setRules] = useState(() => flattenRules(parseJSON(value)));
  const [newGroupName, setNewGroupName] = useState('');

  const emitChange = useCallback(
    (newRules) => {
      setRules(newRules);
      onChange?.(serializeGroupSpecialUsable(newRules));
    },
    [onChange],
  );

  const updateRule = useCallback(
    (id, field, val) => {
      emitChange(
        rules.map((r) => {
          if (r._id !== id) return r;
          const updated = { ...r, [field]: val };
          if (field === 'op' && val === OP_REMOVE) updated.description = 'remove';
          else if (field === 'op' && r.op === OP_REMOVE && val !== OP_REMOVE) {
            if (updated.description === 'remove') updated.description = '';
          }
          return updated;
        }),
      );
    },
    [rules, emitChange],
  );

  const removeRule = useCallback(
    (id) => emitChange(rules.filter((r) => r._id !== id)),
    [rules, emitChange],
  );

  const addRuleToGroup = useCallback(
    (groupName) => {
      emitChange([
        ...rules,
        {
          _id: uid(),
          userGroup: groupName,
          op: OP_APPEND,
          targetGroup: '',
          description: '',
        },
      ]);
    },
    [rules, emitChange],
  );

  const addNewGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    emitChange([
      ...rules,
      {
        _id: uid(),
        userGroup: name,
        op: OP_APPEND,
        targetGroup: '',
        description: '',
      },
    ]);
    setNewGroupName('');
  }, [rules, emitChange, newGroupName]);

  const groupOptions = useMemo(
    () => groupNames.map((n) => ({ value: n, label: n })),
    [groupNames],
  );

  const opOptions = useMemo(
    () => [
      { value: OP_ADD, label: t('添加 (+:)') },
      { value: OP_REMOVE, label: t('移除 (-:)') },
      { value: OP_APPEND, label: t('追加') },
    ],
    [t],
  );

  const grouped = useMemo(() => {
    const map = {};
    const order = [];
    rules.forEach((r) => {
      if (!r.userGroup) return;
      if (!map[r.userGroup]) {
        map[r.userGroup] = [];
        order.push(r.userGroup);
      }
      map[r.userGroup].push(r);
    });
    return order.map((name) => ({ name, items: map[name] }));
  }, [rules]);

  const newGroupListId = 'group-special-usable-new-options';

  const adder = (
    <div className='mt-3 flex justify-center gap-2'>
      <input
        type='text'
        list={newGroupListId}
        value={newGroupName}
        onChange={(event) => setNewGroupName(event.target.value)}
        placeholder={t('选择用户分组')}
        aria-label={t('用户分组')}
        className='h-8 w-52 rounded-md border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary'
      />
      <datalist id={newGroupListId}>
        {groupOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </datalist>
      <Button
        variant='bordered'
        startContent={<Plus size={14} />}
        onPress={addNewGroup}
        size='sm'
      >
        {t('添加分组规则')}
      </Button>
    </div>
  );

  if (grouped.length === 0 && rules.length === 0) {
    return (
      <div>
        <div className='block py-4 text-center text-sm text-muted'>
          {t('暂无规则，点击下方按钮添加')}
        </div>
        {adder}
      </div>
    );
  }

  return (
    <div className='space-y-2'>
      {grouped.map((group) => (
        <UsableGroupSection
          key={group.name}
          groupName={group.name}
          items={group.items}
          opOptions={opOptions}
          onUpdate={updateRule}
          onRemove={removeRule}
          onAdd={addRuleToGroup}
          t={t}
        />
      ))}
      {adder}
    </div>
  );
}
