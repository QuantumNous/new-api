import React, { useState, useCallback, useMemo } from 'react';
import {
  Button,
  InputNumber,
  Select,
  Typography,
  Popconfirm,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import CardTable from '../../../../components/common/ui/CardTable';

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

export default function GroupGroupRatioRules({
  value,
  groupNames = [],
  onChange,
}) {
  const { t } = useTranslation();

  const [rules, setRules] = useState(() => flattenRules(parseJSON(value)));

  const emitChange = useCallback(
    (newRules) => {
      setRules(newRules);
      onChange?.(serializeGroupGroupRatio(newRules));
    },
    [onChange],
  );

  const updateRule = useCallback(
    (id, field, val) => {
      const next = rules.map((r) =>
        r._id === id ? { ...r, [field]: val } : r,
      );
      emitChange(next);
    },
    [rules, emitChange],
  );

  const addRule = useCallback(() => {
    emitChange([
      ...rules,
      { _id: uid(), userGroup: '', usingGroup: '', ratio: 1 },
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

  const columns = useMemo(
    () => [
      {
        title: t('用户分组'),
        dataIndex: 'userGroup',
        key: 'userGroup',
        width: 200,
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
        title: t('使用分组'),
        dataIndex: 'usingGroup',
        key: 'usingGroup',
        width: 200,
        render: (_, record) => (
          <Select
            size='small'
            filter
            value={record.usingGroup || undefined}
            placeholder={t('选择使用分组')}
            optionList={groupOptions}
            onChange={(v) => updateRule(record._id, 'usingGroup', v)}
            style={{ width: '100%' }}
            allowCreate
            position='bottomLeft'
          />
        ),
      },
      {
        title: t('倍率'),
        dataIndex: 'ratio',
        key: 'ratio',
        width: 140,
        render: (_, record) => (
          <InputNumber
            size='small'
            min={0}
            step={0.1}
            value={record.ratio}
            style={{ width: '100%' }}
            onChange={(v) => updateRule(record._id, 'ratio', v ?? 0)}
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
    [t, groupOptions, updateRule, removeRule],
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
