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
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Input, TextArea } from '@heroui/react';
import { Copy, Info, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../../helpers';

const inputClass =
  'h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition focus:border-primary disabled:cursor-not-allowed disabled:opacity-50';

const OPTION_KEY = 'tool_price_setting.prices';

const DEFAULT_PRICES = {
  web_search: 10.0,
  web_search_preview: 10.0,
  'web_search_preview:gpt-4o*': 25.0,
  'web_search_preview:gpt-4.1*': 25.0,
  'web_search_preview:gpt-4o-mini*': 25.0,
  'web_search_preview:gpt-4.1-mini*': 25.0,
  file_search: 2.5,
  google_search: 14.0,
};

function rowsToObject(rows) {
  const prices = {};
  for (const row of rows) {
    const k = row.key.trim();
    if (!k) continue;
    prices[k] = Number(row.price) || 0;
  }
  return prices;
}

function objectToRows(prices) {
  return Object.entries(prices).map(([key, price], i) => ({
    id: i,
    key,
    price,
  }));
}

// Mirror ModelPricingEditor.jsx so the two ratio-tab editors share the same
// info-banner palette without pulling a v2 Semi `<Banner>` shim.
function InfoBanner({ children }) {
  return (
    <div className='mb-4 flex items-start gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground'>
      <Info size={16} className='mt-0.5 shrink-0 text-primary' />
      <div className='flex-1'>{children}</div>
    </div>
  );
}

export default function ToolPriceSettings({ options }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let prices = {};
    try {
      const raw = options?.[OPTION_KEY];
      if (raw) {
        prices = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch {
      prices = {};
    }

    if (!prices || Object.keys(prices).length === 0) {
      prices = { ...DEFAULT_PRICES };
    }

    setRows(objectToRows(prices));
    setJsonText(JSON.stringify(prices, null, 2));
  }, [options]);

  const syncToJson = (nextRows) => {
    setRows(nextRows);
    setJsonText(JSON.stringify(rowsToObject(nextRows), null, 2));
    setJsonError('');
  };

  const syncToVisual = (text) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (
        typeof parsed !== 'object' ||
        Array.isArray(parsed) ||
        parsed === null
      ) {
        setJsonError(t('JSON 必须是对象'));
        return;
      }
      setRows(objectToRows(parsed));
      setJsonError('');
    } catch (e) {
      setJsonError(e.message);
    }
  };

  const updateRow = (id, field, value) => {
    syncToJson(rows.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    syncToJson([...rows, { id: Date.now(), key: '', price: 0 }]);
  };

  const removeRow = (id) => {
    syncToJson(rows.filter((r) => r.id !== id));
  };

  const resetToDefault = () => {
    syncToJson(objectToRows(DEFAULT_PRICES));
  };

  const currentPrices = useMemo(() => rowsToObject(rows), [rows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await API.put('/api/option/', {
        key: OPTION_KEY,
        value: JSON.stringify(currentPrices),
      });
      if (res.data.success) {
        showSuccess(t('保存成功'));
      } else {
        showError(res.data.message || t('保存失败'));
      }
    } catch (e) {
      showError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const isJsonInvalid = mode === 'json' && !!jsonError;

  return (
    <div className='max-w-[700px]'>
      <InfoBanner>
        <div>
          {t(
            '配置各工具的调用价格（$/1K次调用）。按次计费模型不额外收取工具费用。',
          )}
        </div>
        <div className='mt-1'>
          <span className='font-semibold'>{t('格式')}：</span>
          <code className='mx-1 rounded bg-surface-secondary px-1 py-0.5 text-xs'>
            web_search_preview
          </code>
          {t('为默认价格')}，
          <code className='mx-1 rounded bg-surface-secondary px-1 py-0.5 text-xs'>
            web_search_preview:gpt-4o*
          </code>
          {t('为模型前缀覆盖')}
        </div>
      </InfoBanner>

      {/*
        Mode toggle. Replaces the v2 Semi `<RadioGroup type='button'>`,
        which silently no-ops in v3 — there is no equivalent compound on
        the heroui RadioGroup. A pair of `outline` / `primary` Buttons
        gives the same pill-pair affordance and stays consistent with the
        SelectableButtonGroup pattern used elsewhere in /console.
      */}
      <div className='mb-3 inline-flex overflow-hidden rounded-xl border border-border'>
        <Button
          size='sm'
          variant={mode === 'visual' ? 'primary' : 'outline'}
          className='rounded-none border-0'
          onPress={() => setMode('visual')}
        >
          {t('可视化')}
        </Button>
        <Button
          size='sm'
          variant={mode === 'json' ? 'primary' : 'outline'}
          className='rounded-none border-0 border-l border-border'
          onPress={() => setMode('json')}
        >
          JSON
        </Button>
      </div>

      {mode === 'visual' ? (
        <>
          <div className='overflow-x-auto rounded-xl border border-border'>
            <table className='w-full text-left text-sm'>
              <thead className='bg-surface-secondary text-xs uppercase tracking-wide text-muted'>
                <tr>
                  <th className='px-3 py-2 font-medium'>{t('工具标识')}</th>
                  <th className='w-44 px-3 py-2 font-medium'>
                    {`${t('价格')} ($/1K${t('次')})`}
                  </th>
                  <th className='w-16 px-3 py-2 font-medium'>{t('操作')}</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-border'>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3}
                      className='px-3 py-6 text-center text-sm text-muted'
                    >
                      {t('暂无数据')}
                    </td>
                  </tr>
                ) : null}
                {rows.map((record) => (
                  <tr key={record.id} className='align-top'>
                    <td className='px-3 py-2'>
                      <Input
                        value={record.key}
                        placeholder='web_search_preview:gpt-4o*'
                        onChange={(event) =>
                          updateRow(record.id, 'key', event.target.value)
                        }
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <input
                        type='number'
                        value={record.price ?? 0}
                        min={0}
                        step={0.5}
                        onChange={(event) =>
                          updateRow(
                            record.id,
                            'price',
                            event.target.value === ''
                              ? 0
                              : Number(event.target.value) || 0,
                          )
                        }
                        className={inputClass}
                      />
                    </td>
                    <td className='px-3 py-2'>
                      <Button
                        isIconOnly
                        size='sm'
                        variant='ghost'
                        aria-label={t('删除')}
                        className='text-danger hover:bg-danger/10'
                        onPress={() => removeRow(record.id)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className='mt-3 flex gap-2'>
            <Button variant='secondary' size='sm' onPress={addRow}>
              <Plus size={14} />
              {t('添加')}
            </Button>
            <Button variant='ghost' size='sm' onPress={resetToDefault}>
              {t('恢复默认')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <TextArea
            value={jsonText}
            onChange={(event) => syncToVisual(event.target.value)}
            rows={10}
            className='font-mono text-xs'
          />
          {jsonError ? (
            <div className='mt-1 text-xs text-danger'>{jsonError}</div>
          ) : null}
          <div className='mt-2 flex gap-2'>
            <Button
              variant='ghost'
              size='sm'
              onPress={() => copy(jsonText, t('JSON'))}
            >
              <Copy size={14} />
              {t('复制')}
            </Button>
            <Button variant='ghost' size='sm' onPress={resetToDefault}>
              {t('恢复默认')}
            </Button>
          </div>
        </>
      )}

      <div className='mt-4 flex justify-end'>
        <Button
          variant='primary'
          isPending={saving}
          isDisabled={isJsonInvalid}
          onPress={handleSave}
        >
          {t('保存')}
        </Button>
      </div>
    </div>
  );
}
