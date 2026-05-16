import React, { useState, useCallback, useEffect } from 'react';
import {
  Button,
  Input,
  InputNumber,
  Typography,
  Popconfirm,
  Select,
  Spin,
} from '@douyinfe/semi-ui';
import { IconPlus, IconDelete } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../../../helpers';

const { Text } = Typography;

export default function AliasManager({ groupNames = [] }) {
  const { t } = useTranslation();
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(false);

  const groupOptions = groupNames.map((n) => ({ value: n, label: n }));

  const fetchAliases = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/group_alias/');
      if (res.data.success) {
        setAliases((res.data.data || []).map((a) => ({ ...a, _key: a._key ?? String(a.id) })));
      }
    } catch {
      showError(t('获取别名失败'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchAliases();
  }, [fetchAliases]);

  const addAlias = useCallback(async () => {
    const newAlias = {
      alias: '',
      target_group: groupNames[0] || '',
      ratio_override: null,
      id: 0,
      _isNew: true,
      _key: crypto.randomUUID(),
    };
    setAliases((prev) => [...prev, newAlias]);
  }, [groupNames]);

  const saveAlias = useCallback(async (alias) => {
    if (!alias.alias) {
      showError(t('别名不能为空'));
      return;
    }
    if (!alias.target_group) {
      showError(t('目标分组不能为空'));
      return;
    }
    try {
      if (alias._isNew) {
        const res = await API.post('/api/group_alias/', {
          alias: alias.alias,
          target_group: alias.target_group,
          ratio_override: alias.ratio_override,
        });
        if (res.data.success) {
          showSuccess(t('创建成功'));
          fetchAliases();
        } else {
          showError(res.data.message);
        }
      } else {
        const res = await API.put(`/api/group_alias/${alias.id}`, {
          alias: alias.alias,
          target_group: alias.target_group,
          ratio_override: alias.ratio_override,
        });
        if (res.data.success) {
          showSuccess(t('更新成功'));
          fetchAliases();
        } else {
          showError(res.data.message);
        }
      }
    } catch {
      showError(t('保存失败'));
    }
  }, [fetchAliases, t]);

  const removeAlias = useCallback(async (alias) => {
    if (alias._isNew || alias.id === 0) {
      setAliases((prev) => prev.filter((a) => a._key !== alias._key));
      return;
    }
    try {
      const res = await API.delete(`/api/group_alias/${alias.id}`);
      if (res.data.success) {
        setAliases((prev) => prev.filter((a) => a.id !== alias.id));
      } else {
        showError(res.data.message);
      }
    } catch {
      showError(t('删除失败'));
    }
  }, [t]);

  const updateLocal = useCallback((key, field, value) => {
    setAliases((prev) =>
      prev.map((a) => (a._key === key ? { ...a, [field]: value } : a)),
    );
  }, []);

  return (
    <Spin spinning={loading}>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm' style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr className='border-b' style={{ borderColor: 'var(--semi-color-border)' }}>
              <th style={{ width: 180, padding: '8px', textAlign: 'left' }}>{t('别名')}</th>
              <th style={{ width: 180, padding: '8px', textAlign: 'left' }}>{t('目标分组')}</th>
              <th style={{ width: 120, padding: '8px', textAlign: 'left' }}>{t('独立倍率')}</th>
              <th style={{ width: 100, padding: '8px' }}>{t('操作')}</th>
            </tr>
          </thead>
          <tbody>
            {aliases.map((alias) => (
              <tr key={alias._key} className='border-b' style={{ borderColor: 'var(--semi-color-border)' }}>
                <td style={{ padding: '6px 8px' }}>
                  <Input
                    size='small'
                    value={alias.alias}
                    placeholder={t('输入别名')}
                    onChange={(v) => updateLocal(alias._key, 'alias', v)}
                  />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <Select
                    size='small'
                    value={alias.target_group || undefined}
                    placeholder={t('选择目标分组')}
                    optionList={groupOptions}
                    onChange={(v) => updateLocal(alias._key, 'target_group', v)}
                    filter
                    style={{ width: '100%' }}
                  />
                </td>
                <td style={{ padding: '6px 8px' }}>
                  <InputNumber
                    size='small'
                    min={0}
                    step={0.1}
                    value={alias.ratio_override ?? undefined}
                    placeholder={t('留空使用目标倍率')}
                    style={{ width: '100%' }}
                    onChange={(v) => updateLocal(alias._key, 'ratio_override', v === '' || v === undefined ? null : v)}
                  />
                </td>
                <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <div className='flex items-center justify-center gap-1'>
                    <Button
                      size='small'
                      theme='solid'
                      onClick={() => saveAlias(alias)}
                    >
                      {t('保存')}
                    </Button>
                    <Popconfirm
                      title={t('确认删除该别名？')}
                      onConfirm={() => removeAlias(alias)}
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {aliases.length === 0 && !loading && (
          <div className='py-4 text-center'>
            <Text type='tertiary'>{t('暂无别名，点击下方按钮添加')}</Text>
          </div>
        )}
      </div>
      <div className='mt-3 flex justify-center'>
        <Button icon={<IconPlus />} theme='outline' onClick={addAlias}>
          {t('添加别名')}
        </Button>
      </div>
    </Spin>
  );
}
