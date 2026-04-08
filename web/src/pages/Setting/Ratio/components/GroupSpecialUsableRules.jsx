import React, { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Input,
  Select,
  Tag,
  Typography,
  Popconfirm,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import CardTable from '../../../../components/common/ui/CardTable';

const { Text } = Typography;

let _idCounter = 0;
const uid = () => `gsu_${++_idCounter}`;

const OP_ADD = 'add';
const OP_REMOVE = 'remove';
const OP_APPEND = 'append';

function parsePrefix(rawKey) {
  if (rawKey.startsWith('+:')) {
    return { op: OP_ADD, groupName: rawKey.slice(2) };
  }
  if (rawKey.startsWith('-:')) {
    return { op: OP_REMOVE, groupName: rawKey.slice(2) };
  }
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
        description: op === OP_REMOVE ? 'remove' : (typeof desc === 'string' ? desc : ''),
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
    const key = toRawKey(op, targetGroup);
    result[userGroup][key] = description;
  });
  return result;
}

export function serializeGroupSpecialUsable(rules) {
  const nested = nestRules(rules);
  return Object.keys(nested).length === 0
    ? ''
    : JSON.stringify(nested, null, 2);
}

const OP_TAG_MAP = {
  [OP_ADD]: { color: 'green', label: '添加 (+:)' },
  [OP_REMOVE]: { color: 'red', label: '移除 (-:)' },
  [OP_APPEND]: { color: 'blue', label: '追加' },
};

export default function GroupSpecialUsableRules({
  value,
  groupNames = [],
  onChange,
}) {
  const { t } = useTranslation();

  const [rules, setRules] = useState(() => flattenRules(parseJSON(value)));

  const emitChange = useCallback(
    (newRules) => {
      setRules(newRules);
      onChange?.(serializeGroupSpecialUsable(newRules));
    },
    [onChange],
  );

  const updateRule = useCallback(
    (id, field, val) => {
      const next = rules.map((r) => {
        if (r._id !== id) return r;
        const updated = { ...r, [field]: val };
        if (field === 'op' && val === OP_REMOVE) {
          updated.description = 'remove';
        } else if (field === 'op' && r.op === OP_REMOVE && val !== OP_REMOVE) {
          if (updated.description === 'remove') updated.description = '';
        }
        return updated;
      });
      emitChange(next);
    },
    [rules, emitChange],
  );

  const addRule = useCallback(() => {
    emitChange([
      ...rules,
      {
        _id: uid(),
        userGroup: '',
        op: OP_APPEND,
        targetGroup: '',
        description: '',
      },
    ]);
  }, [rules, emitChange]);

  const removeRule = useCallback(
    (id) => {
      emitChange(rules.filter((r) => r._id !== id));
    },
    [rules, emitChange],
  );

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

  const columns = useMemo(
    () => [
      {
        title: t('用户分组'),
        dataIndex: 'userGroup',
        key: 'userGroup',
        width: 180,
        render: (_, record) => (
          <Select
            size='small'
            filter
            value={record.userGroup || undefined}
            placeholder={t('选择用户分组')}
            optionList={groupOptions}
            onChange={(v) => updateRule(record._id, 'userGroup', v)}
            style={{ width: '100%' }}
            allowCreate
            position='bottomLeft'
          />
        ),
      },
      {
        title: t('操作'),
        dataIndex: 'op',
        key: 'op',
        width: 140,
        render: (_, record) => (
          <Select
            size='small'
            value={record.op}
            optionList={opOptions}
            onChange={(v) => updateRule(record._id, 'op', v)}
            style={{ width: '100%' }}
            renderSelectedItem={(optionNode) => {
              const tagInfo = OP_TAG_MAP[optionNode.value] || {};
              return (
                <Tag size='small' color={tagInfo.color}>
                  {optionNode.label}
                </Tag>
              );
            }}
          />
        ),
      },
      {
        title: t('目标分组'),
        dataIndex: 'targetGroup',
        key: 'targetGroup',
        width: 180,
        render: (_, record) => (
          <Input
            size='small'
            value={record.targetGroup}
            placeholder={t('分组名称')}
            onChange={(v) => updateRule(record._id, 'targetGroup', v)}
          />
        ),
      },
      {
        title: t('描述'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) =>
          record.op === OP_REMOVE ? (
            <Text type='tertiary' size='small'>-</Text>
          ) : (
            <Input
              size='small'
              value={record.description}
              placeholder={t('分组描述')}
              onChange={(v) => updateRule(record._id, 'description', v)}
            />
          ),
      },
      {
        title: '',
        key: 'actions',
        width: 50,
        render: (_, record) => (
          <Popconfirm
            title={t('确认删除该规则？')}
            onConfirm={() => removeRule(record._id)}
            position='left'
          >
            <Button
              icon={<IconDelete />}
              type='danger'
              theme='borderless'
              size='small'
            />
          </Popconfirm>
        ),
      },
    ],
    [t, groupOptions, opOptions, updateRule, removeRule],
  );

  return (
    <div>
      <CardTable
        columns={columns}
        dataSource={rules}
        rowKey='_id'
        hidePagination
        size='small'
        empty={
          <Text type='tertiary'>
            {t('暂无规则，点击下方按钮添加')}
          </Text>
        }
      />
      <div className='mt-3 flex justify-center'>
        <Button icon={<IconPlus />} theme='outline' onClick={addRule}>
          {t('添加规则')}
        </Button>
      </div>
    </div>
  );
}
