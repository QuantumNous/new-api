import React, { useState, useCallback, useMemo, useRef } from 'react';
import { Button, Input } from '@heroui/react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import CardTable from '../../../../components/common/ui/CardTable';

let _idCounter = 0;
const uid = () => `gr_${++_idCounter}`;

function parseJSON(str, fallback) {
  if (!str || !str.trim()) return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function buildRows(groupRatioStr, userUsableGroupsStr) {
  const ratioMap = parseJSON(groupRatioStr, {});
  const usableMap = parseJSON(userUsableGroupsStr, {});

  const allNames = new Set([
    ...Object.keys(ratioMap),
    ...Object.keys(usableMap),
  ]);

  return Array.from(allNames).map((name) => ({
    _id: uid(),
    name,
    ratio: ratioMap[name] ?? 1,
    selectable: name in usableMap,
    description: usableMap[name] ?? '',
  }));
}

export function serializeGroupTable(rows) {
  const groupRatio = {};
  const userUsableGroups = {};

  rows.forEach((row) => {
    if (!row.name) return;
    groupRatio[row.name] = row.ratio;
    if (row.selectable) {
      userUsableGroups[row.name] = row.description;
    }
  });

  return {
    GroupRatio: JSON.stringify(groupRatio, null, 2),
    UserUsableGroups: JSON.stringify(userUsableGroups, null, 2),
  };
}

const baseInputClass =
  'h-8 w-full rounded-md border border-[color:var(--app-border)] bg-background px-2 text-sm text-foreground outline-none transition focus:border-primary';

export default function GroupTable({ groupRatio, userUsableGroups, onChange }) {
  const { t } = useTranslation();

  const [rows, setRows] = useState(() =>
    buildRows(groupRatio, userUsableGroups),
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const emitAndSet = useCallback((updater) => {
    setRows((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      onChangeRef.current?.(serializeGroupTable(next));
      return next;
    });
  }, []);

  const updateRow = useCallback(
    (id, field, value) => {
      emitAndSet((prev) =>
        prev.map((r) => (r._id === id ? { ...r, [field]: value } : r)),
      );
    },
    [emitAndSet],
  );

  const addRow = useCallback(() => {
    emitAndSet((prev) => {
      const existingNames = new Set(prev.map((r) => r.name));
      let counter = 1;
      let newName = `group_${counter}`;
      while (existingNames.has(newName)) {
        counter++;
        newName = `group_${counter}`;
      }
      return [
        ...prev,
        {
          _id: uid(),
          name: newName,
          ratio: 1,
          selectable: true,
          description: '',
        },
      ];
    });
  }, [emitAndSet]);

  const removeRow = useCallback(
    (id) => {
      // eslint-disable-next-line no-alert
      if (
        typeof window !== 'undefined' &&
        !window.confirm(t('确认删除该分组？'))
      ) {
        return;
      }
      emitAndSet((prev) => prev.filter((r) => r._id !== id));
    },
    [emitAndSet, t],
  );

  const groupNames = useMemo(() => rows.map((r) => r.name), [rows]);

  const duplicateNames = useMemo(() => {
    const counts = {};
    groupNames.forEach((n) => {
      counts[n] = (counts[n] || 0) + 1;
    });
    return new Set(Object.keys(counts).filter((k) => counts[k] > 1));
  }, [groupNames]);

  const duplicateNamesRef = useRef(duplicateNames);
  duplicateNamesRef.current = duplicateNames;

  const columns = useMemo(
    () => [
      {
        title: t('分组名称'),
        dataIndex: 'name',
        key: 'name',
        width: 180,
        render: (_, record) => {
          const isDup = duplicateNamesRef.current.has(record.name);
          return (
            <Input
              type='text'
              value={record.name}
              onChange={(event) =>
                updateRow(record._id, 'name', event.target.value)
              }
              aria-label={t('分组名称')}
              className={`${baseInputClass} ${
                isDup ? 'border-amber-400 focus:border-amber-500' : ''
              }`}
            />
          );
        },
      },
      {
        title: t('倍率'),
        dataIndex: 'ratio',
        key: 'ratio',
        width: 120,
        render: (_, record) => (
          <Input
            type='number'
            value={
              record.ratio === '' || record.ratio == null
                ? ''
                : String(record.ratio)
            }
            min={0}
            step={0.1}
            onChange={(event) => {
              const v = event.target.value;
              updateRow(record._id, 'ratio', v === '' ? 0 : Number(v));
            }}
            aria-label={t('倍率')}
            className={baseInputClass}
          />
        ),
      },
      {
        title: t('用户可选'),
        dataIndex: 'selectable',
        key: 'selectable',
        width: 90,
        align: 'center',
        render: (_, record) => (
          <input
            type='checkbox'
            checked={!!record.selectable}
            onChange={(event) =>
              updateRow(record._id, 'selectable', event.target.checked)
            }
            aria-label={t('用户可选')}
            className='h-4 w-4 accent-primary'
          />
        ),
      },
      {
        title: t('描述'),
        dataIndex: 'description',
        key: 'description',
        render: (_, record) =>
          record.selectable ? (
            <Input
              type='text'
              value={record.description || ''}
              placeholder={t('分组描述')}
              onChange={(event) =>
                updateRow(record._id, 'description', event.target.value)
              }
              aria-label={t('分组描述')}
              className={baseInputClass}
            />
          ) : (
            <span className='text-sm text-muted'>-</span>
          ),
      },
      {
        title: '',
        key: 'actions',
        width: 50,
        render: (_, record) => (
          <Button
            isIconOnly
            variant='tertiary'
            color='danger'
            size='sm'
            onPress={() => removeRow(record._id)}
            aria-label={t('删除该分组')}
          >
            <Trash2 size={14} />
          </Button>
        ),
      },
    ],
    [t, updateRow, removeRow],
  );

  return (
    <div>
      <CardTable
        columns={columns}
        dataSource={rows}
        rowKey='_id'
        hidePagination
        size='small'
        empty={
          <span className='text-sm text-muted'>
            {t('暂无分组，点击下方按钮添加')}
          </span>
        }
      />
      <div className='mt-3 flex justify-center'>
        <Button variant='secondary' onPress={addRow} size='sm'>
          <Plus size={14} />
          {t('添加分组')}
        </Button>
      </div>
      {duplicateNames.size > 0 && (
        <div className='mt-2 text-xs text-amber-600 dark:text-amber-300'>
          {t('存在重复的分组名称：')}
          {Array.from(duplicateNames).join(', ')}
        </div>
      )}
    </div>
  );
}
