import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@heroui/react';
import { Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';

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
      // eslint-disable-next-line no-alert
      if (typeof window !== 'undefined' && !window.confirm(t('确认移除？'))) {
        return;
      }
      emitChange(items.filter((i) => i._id !== id));
    },
    [items, emitChange, t],
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
        <div className='block py-4 text-center text-sm text-muted'>
          {t('暂无自动分组，点击下方按钮添加')}
        </div>
        <div className='mt-2 flex justify-center'>
          <Button
            variant='bordered'
            startContent={<Plus size={14} />}
            onPress={addItem}
            size='sm'
          >
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
          <div key={item._id} className='flex items-center gap-2'>
            <span className='inline-flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded-full bg-sky-100 px-1.5 text-xs font-semibold text-sky-700 dark:bg-sky-950/40 dark:text-sky-300'>
              {index + 1}
            </span>
            <input
              type='text'
              list={`autogroup-options-${item._id}`}
              value={item.name || ''}
              placeholder={t('选择分组')}
              onChange={(event) => updateItem(item._id, event.target.value)}
              aria-label={t('分组名称')}
              className='h-9 flex-1 rounded-lg border border-[color:var(--app-border)] bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary'
            />
            <datalist id={`autogroup-options-${item._id}`}>
              {groupOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </datalist>
            <Button
              isIconOnly
              variant='light'
              size='sm'
              isDisabled={index === 0}
              onPress={() => moveUp(index)}
              aria-label={t('上移')}
            >
              <ChevronUp size={14} />
            </Button>
            <Button
              isIconOnly
              variant='light'
              size='sm'
              isDisabled={index === items.length - 1}
              onPress={() => moveDown(index)}
              aria-label={t('下移')}
            >
              <ChevronDown size={14} />
            </Button>
            <Button
              isIconOnly
              variant='light'
              color='danger'
              size='sm'
              onPress={() => removeItem(item._id)}
              aria-label={t('移除')}
            >
              <Trash2 size={14} />
            </Button>
          </div>
        ))}
      </div>
      <div className='mt-3 flex justify-center'>
        <Button
          variant='bordered'
          startContent={<Plus size={14} />}
          onPress={addItem}
          size='sm'
        >
          {t('添加分组')}
        </Button>
      </div>
    </div>
  );
}
