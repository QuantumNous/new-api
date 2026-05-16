import React, { useState, useCallback, useMemo } from 'react';
import {
  Button,
  Select,
  Typography,
  Popconfirm,
  Tag,
} from '@douyinfe/semi-ui';
import {
  IconPlus,
  IconDelete,
  IconChevronUp,
  IconChevronDown,
} from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

let _idCounter = 0;
const uid = () => `ag_${++_idCounter}`;

function parseAutoGroups(str) {
  if (!str || !str.trim()) return [];
  try {
    const parsed = JSON.parse(str);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => typeof item === 'string')
      .map((name) => ({ _id: uid(), name }));
  } catch {
    return [];
  }
}

function serializeAutoGroups(items) {
  const names = items.map((i) => i.name).filter(Boolean);
  return names.length === 0 ? '' : JSON.stringify(names);
}

export default function AutoGroupList({ value, groupNames = [], onChange }) {
  const { t } = useTranslation();

  const [items, setItems] = useState(() => parseAutoGroups(value));

  const emitChange = useCallback(
    (newItems) => {
      setItems(newItems);
      onChange?.(serializeAutoGroups(newItems));
    },
    [onChange],
  );

  const groupOptions = useMemo(
    () => groupNames.map((n) => ({ value: n, label: n })),
    [groupNames],
  );

  const addItem = useCallback(() => {
    emitChange([...items, { _id: uid(), name: '' }]);
  }, [items, emitChange]);

  const removeItem = useCallback(
    (id) => {
      emitChange(items.filter((i) => i._id !== id));
    },
    [items, emitChange],
  );

  const updateItem = useCallback(
    (id, name) => {
      emitChange(items.map((i) => (i._id === id ? { ...i, name } : i)));
    },
    [items, emitChange],
  );

  const moveUp = useCallback(
    (index) => {
      if (index <= 0) return;
      const next = [...items];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      emitChange(next);
    },
    [items, emitChange],
  );

  const moveDown = useCallback(
    (index) => {
      if (index >= items.length - 1) return;
      const next = [...items];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      emitChange(next);
    },
    [items, emitChange],
  );

  if (items.length === 0) {
    return (
      <div>
        <Text type='tertiary' className='block text-center py-4'>
          {t('暂无自动分组，点击下方按钮添加')}
        </Text>
        <div className='mt-2 flex justify-center'>
          <Button icon={<IconPlus />} theme='outline' onClick={addItem}>
            {t('添加分组')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className='space-y-2'>
        {items.map((item, index) => (
          <div
            key={item._id}
            className='flex items-center gap-2'
          >
            <Tag size='small' color='blue' className='shrink-0'>
              {index + 1}
            </Tag>
            <Select
              size='small'
              filter
              value={item.name || undefined}
              placeholder={t('选择分组')}
              optionList={groupOptions}
              onChange={(v) => updateItem(item._id, v)}
              style={{ flex: 1 }}
              allowCreate
              position='bottomLeft'
            />
            <Button
              icon={<IconChevronUp />}
              theme='borderless'
              size='small'
              disabled={index === 0}
              onClick={() => moveUp(index)}
            />
            <Button
              icon={<IconChevronDown />}
              theme='borderless'
              size='small'
              disabled={index === items.length - 1}
              onClick={() => moveDown(index)}
            />
            <Popconfirm
              title={t('确认移除？')}
              onConfirm={() => removeItem(item._id)}
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
      <div className='mt-3 flex justify-center'>
        <Button icon={<IconPlus />} theme='outline' onClick={addItem}>
          {t('添加分组')}
        </Button>
      </div>
    </div>
  );
}
