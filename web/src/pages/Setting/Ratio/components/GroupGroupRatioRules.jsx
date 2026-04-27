import React, { useState, useCallback, useMemo } from 'react';
import { Button, Input } from '@heroui/react';
import { Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

let _idCounter = 0;
const uid = () => `ggr_${++_idCounter}`;

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
    for (const [usingGroup, ratio] of Object.entries(inner)) {
      rules.push({
        _id: uid(),
        userGroup,
        usingGroup,
        ratio: typeof ratio === 'number' ? ratio : 1,
      });
    }
  }
  return rules;
}

function nestRules(rules) {
  const result = {};
  rules.forEach(({ userGroup, usingGroup, ratio }) => {
    if (!userGroup || !usingGroup) return;
    if (!result[userGroup]) result[userGroup] = {};
    result[userGroup][usingGroup] = ratio;
  });
  return result;
}

export function serializeGroupGroupRatio(rules) {
  const nested = nestRules(rules);
  return Object.keys(nested).length === 0
    ? ''
    : JSON.stringify(nested, null, 2);
}

const inputClass =
  'h-8 w-full rounded-md border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary';

function GroupSection({
  groupName,
  items,
  groupOptions,
  onUpdate,
  onRemove,
  onAdd,
  t,
}) {
  const [open, setOpen] = useState(false);

  const removeAll = () => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(t('确认删除该分组的所有规则？'))
    ) {
      return;
    }
    items.forEach((item) => onRemove(item._id));
  };

  const removeOne = (id) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(t('确认删除该规则？'))
    ) {
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
            variant='tertiary'
            size='sm'
            aria-label={t('添加')}
            onPress={() => onAdd(groupName)}
          >
            <Plus size={14} />
          </Button>
          <Button
            isIconOnly
            variant='tertiary'
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
          {items.map((rule) => (
            <div key={rule._id} className='flex items-center gap-2'>
              <div className='flex-1'>
                <input
                  type='text'
                  list={`group-options-${rule._id}`}
                  value={rule.usingGroup || ''}
                  placeholder={t('选择使用分组')}
                  onChange={(event) =>
                    onUpdate(rule._id, 'usingGroup', event.target.value)
                  }
                  aria-label={t('使用分组')}
                  className={inputClass}
                />
                <datalist id={`group-options-${rule._id}`}>
                  {groupOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </datalist>
              </div>
              <Input
                type='number'
                value={
                  rule.ratio === '' || rule.ratio == null
                    ? ''
                    : String(rule.ratio)
                }
                min={0}
                step={0.1}
                onChange={(event) => {
                  const v = event.target.value;
                  onUpdate(rule._id, 'ratio', v === '' ? 0 : Number(v));
                }}
                aria-label={t('倍率')}
                className='h-8 w-24 rounded-md border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary'
              />
              <Button
                isIconOnly
                variant='tertiary'
                color='danger'
                size='sm'
                aria-label={t('删除该规则')}
                onPress={() => removeOne(rule._id)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function GroupGroupRatioRules({
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
      onChange?.(serializeGroupGroupRatio(newRules));
    },
    [onChange],
  );

  const updateRule = useCallback(
    (id, field, val) => {
      emitChange(rules.map((r) => (r._id === id ? { ...r, [field]: val } : r)));
    },
    [rules, emitChange],
  );

  const removeRule = useCallback(
    (id) => {
      emitChange(rules.filter((r) => r._id !== id));
    },
    [rules, emitChange],
  );

  const addRuleToGroup = useCallback(
    (groupName) => {
      emitChange([
        ...rules,
        { _id: uid(), userGroup: groupName, usingGroup: '', ratio: 1 },
      ]);
    },
    [rules, emitChange],
  );

  const addNewGroup = useCallback(() => {
    const name = newGroupName.trim();
    if (!name) return;
    emitChange([
      ...rules,
      { _id: uid(), userGroup: name, usingGroup: '', ratio: 1 },
    ]);
    setNewGroupName('');
  }, [rules, emitChange, newGroupName]);

  const groupOptions = useMemo(
    () => groupNames.map((n) => ({ value: n, label: n })),
    [groupNames],
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

  const newGroupListId = 'group-group-ratio-new-options';

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
      <Button variant='secondary' onPress={addNewGroup} size='sm'>
        <Plus size={14} />
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
        <GroupSection
          key={group.name}
          groupName={group.name}
          items={group.items}
          groupOptions={groupOptions}
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
