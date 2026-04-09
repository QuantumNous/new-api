import React, { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Collapsible,
  Input,
  InputNumber,
  Select,
  Tag,
  Typography,
  Popconfirm,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconDelete,
  IconChevronDown,
  IconChevronUp,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

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

function GroupSection({ groupName, items, groupOptions, onUpdate, onRemove, onAdd, t }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      style={{
        border: '1px solid var(--semi-color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        className='flex items-center justify-between cursor-pointer'
        style={{
          padding: '8px 12px',
          background: 'var(--semi-color-fill-0)',
        }}
        onClick={() => setOpen(!open)}
      >
        <div className='flex items-center gap-2'>
          {open ? <IconChevronUp size='small' /> : <IconChevronDown size='small' />}
          <Text strong>{groupName}</Text>
          <Tag size='small' color='blue'>{items.length} {t('条规则')}</Tag>
        </div>
        <div className='flex items-center gap-1' onClick={(e) => e.stopPropagation()}>
          <Button
            icon={<IconPlus />}
            size='small'
            theme='borderless'
            onClick={() => onAdd(groupName)}
          />
          <Popconfirm
            title={t('确认删除该分组的所有规则？')}
            onConfirm={() => items.forEach((item) => onRemove(item._id))}
            position='left'
          >
            <Button
              icon={<IconDelete />}
              size='small'
              type='danger'
              theme='borderless'
            />
          </Popconfirm>
        </div>
      </div>
      <Collapsible isOpen={open} keepDOM>
        <div style={{ padding: '8px 12px' }}>
          {items.map((rule) => (
            <div
              key={rule._id}
              className='flex items-center gap-2'
              style={{ marginBottom: 6 }}
            >
              <Select
                size='small'
                filter
                value={rule.usingGroup || undefined}
                placeholder={t('选择使用分组')}
                optionList={groupOptions}
                onChange={(v) => onUpdate(rule._id, 'usingGroup', v)}
                style={{ flex: 1 }}
                allowCreate
                position='bottomLeft'
              />
              <InputNumber
                size='small'
                min={0}
                step={0.1}
                value={rule.ratio}
                style={{ width: 100 }}
                onChange={(v) => onUpdate(rule._id, 'ratio', v ?? 0)}
              />
              <Popconfirm
                title={t('确认删除该规则？')}
                onConfirm={() => onRemove(rule._id)}
                position='left'
              >
                <Button
                  icon={<IconDelete />}
                  type='danger'
                  theme='borderless'
                  size='small'
                />
              </Popconfirm>
            </div>
          ))}
        </div>
      </Collapsible>
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

  if (grouped.length === 0 && rules.length === 0) {
    return (
      <div>
        <Text type='tertiary' className='block text-center py-4'>
          {t('暂无规则，点击下方按钮添加')}
        </Text>
        <div className='mt-2 flex justify-center gap-2'>
          <Select
            size='small'
            filter
            allowCreate
            placeholder={t('选择用户分组')}
            optionList={groupOptions}
            value={newGroupName || undefined}
            onChange={setNewGroupName}
            style={{ width: 200 }}
            position='bottomLeft'
          />
          <Button icon={<IconPlus />} theme='outline' onClick={addNewGroup}>
            {t('添加分组规则')}
          </Button>
        </div>
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
      <div className='mt-3 flex justify-center gap-2'>
        <Select
          size='small'
          filter
          allowCreate
          placeholder={t('选择用户分组')}
          optionList={groupOptions}
          value={newGroupName || undefined}
          onChange={setNewGroupName}
          style={{ width: 200 }}
          position='bottomLeft'
        />
        <Button icon={<IconPlus />} theme='outline' onClick={addNewGroup}>
          {t('添加分组规则')}
        </Button>
      </div>
    </div>
  );
}
