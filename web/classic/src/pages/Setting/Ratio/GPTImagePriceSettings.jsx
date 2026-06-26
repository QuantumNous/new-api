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
import React, { useEffect, useState } from 'react';
import {
  Banner,
  Button,
  InputNumber,
  Radio,
  RadioGroup,
  Switch,
  Table,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

const PRICES_KEY = 'gpt_image1_price_setting.prices';
const DEFAULT_PRICE_KEY = 'gpt_image1_price_setting.default_price';
const USE_GROUP_RATIO_KEY = 'gpt_image1_price_setting.use_group_ratio';

const QUALITIES = ['low', 'medium', 'high'];
const SIZES = ['1024x1024', '1024x1536', '1536x1024'];

const DEFAULT_GRID = {
  low: { '1024x1024': 0.011, '1024x1536': 0.016, '1536x1024': 0.016 },
  medium: { '1024x1024': 0.042, '1024x1536': 0.063, '1536x1024': 0.063 },
  high: { '1024x1024': 0.167, '1024x1536': 0.25, '1536x1024': 0.25 },
};
const DEFAULT_DEFAULT_PRICE = 0.042;
const DEFAULT_USE_GROUP_RATIO = false;

function cloneGrid(grid) {
  const out = {};
  for (const q of Object.keys(grid)) out[q] = { ...grid[q] };
  return out;
}

function parseGrid(raw) {
  let parsed = null;
  try {
    if (raw) parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    parsed = null;
  }
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const result = {};
    for (const [q, sizes] of Object.entries(parsed)) {
      if (sizes && typeof sizes === 'object' && !Array.isArray(sizes)) {
        result[q] = { ...sizes };
      }
    }
    if (Object.keys(result).length > 0) return result;
  }
  return cloneGrid(DEFAULT_GRID);
}

export default function GPTImagePriceSettings({ options }) {
  const { t } = useTranslation();
  const [grid, setGrid] = useState(cloneGrid(DEFAULT_GRID));
  const [mode, setMode] = useState('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [defaultPrice, setDefaultPrice] = useState(DEFAULT_DEFAULT_PRICE);
  const [useGroupRatio, setUseGroupRatio] = useState(DEFAULT_USE_GROUP_RATIO);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const parsed = parseGrid(options?.[PRICES_KEY]);
    setGrid(parsed);
    setJsonText(JSON.stringify(parsed, null, 2));
    setJsonError('');

    const dpRaw = options?.[DEFAULT_PRICE_KEY];
    const dp =
      dpRaw === undefined || dpRaw === ''
        ? DEFAULT_DEFAULT_PRICE
        : Number(dpRaw);
    setDefaultPrice(Number.isFinite(dp) && dp > 0 ? dp : DEFAULT_DEFAULT_PRICE);

    const ugrRaw = options?.[USE_GROUP_RATIO_KEY];
    setUseGroupRatio(ugrRaw === true || ugrRaw === 'true' || ugrRaw === '1');
  }, [options]);

  const syncFromGrid = (next) => {
    setGrid(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError('');
  };

  const handleJsonChange = (text) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setJsonError(t('JSON 必须是对象'));
        return;
      }
      const next = {};
      for (const [q, sizes] of Object.entries(parsed)) {
        if (sizes && typeof sizes === 'object' && !Array.isArray(sizes)) {
          next[q] = { ...sizes };
        }
      }
      setGrid(next);
      setJsonError('');
    } catch (e) {
      setJsonError(e.message);
    }
  };

  const updateCell = (quality, size, value) => {
    const next = cloneGrid(grid);
    if (!next[quality]) next[quality] = {};
    next[quality][size] = value ?? 0;
    syncFromGrid(next);
  };

  const resetToDefault = () => {
    syncFromGrid(cloneGrid(DEFAULT_GRID));
    setDefaultPrice(DEFAULT_DEFAULT_PRICE);
    setUseGroupRatio(DEFAULT_USE_GROUP_RATIO);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: PRICES_KEY, value: JSON.stringify(grid) },
        { key: DEFAULT_PRICE_KEY, value: String(defaultPrice) },
        { key: USE_GROUP_RATIO_KEY, value: String(useGroupRatio) },
      ];
      for (const u of updates) {
        const res = await API.put('/api/option/', u);
        if (!res.data.success) {
          showError(res.data.message || t('保存失败'));
          return;
        }
      }
      showSuccess(t('保存成功'));
    } catch (e) {
      showError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: t('画质'),
      dataIndex: 'quality',
      width: 120,
      render: (q) => <Text strong>{q}</Text>,
    },
    ...SIZES.map((size) => ({
      title: size,
      dataIndex: size,
      width: 160,
      render: (_, record) => (
        <InputNumber
          value={grid[record.quality]?.[size] ?? 0}
          min={0}
          step={0.001}
          onChange={(v) => updateCell(record.quality, size, v)}
          style={{ width: '100%' }}
        />
      ),
    })),
  ];
  const dataSource = QUALITIES.map((q) => ({ key: q, quality: q }));

  return (
    <div style={{ maxWidth: 760 }}>
      <Banner
        type='info'
        description={
          <>
            <div>
              {t('配置 GPT 图像生成的每次调用单价（$/次），按画质和尺寸索引。')}
            </div>
            <div style={{ marginTop: 4 }}>
              {t(
                '关闭分组倍率开关时，生图附加费不乘分组倍率，可避免低价分组倒亏；开启则恢复旧行为。',
              )}
            </div>
          </>
        }
        style={{ marginBottom: 16 }}
      />

      <div
        style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginBottom: 12 }}
      >
        <div>
          <div style={{ marginBottom: 4 }}>
            {t('默认单价（quality/size 缺失时兜底）')}
          </div>
          <InputNumber
            value={defaultPrice}
            min={0}
            step={0.001}
            onChange={(v) => setDefaultPrice(v ?? 0)}
            style={{ width: 180 }}
          />
        </div>
        <div>
          <div style={{ marginBottom: 4 }}>
            {t('生图附加费乘分组倍率（开启恢复旧行为）')}
          </div>
          <Switch
            checked={useGroupRatio}
            onChange={(v) => setUseGroupRatio(v)}
          />
        </div>
      </div>

      <RadioGroup
        type='button'
        size='small'
        value={mode}
        onChange={(e) => setMode(e.target.value)}
        style={{ marginBottom: 12 }}
      >
        <Radio value='visual'>{t('可视化')}</Radio>
        <Radio value='json'>JSON</Radio>
      </RadioGroup>

      {mode === 'visual' ? (
        <>
          <Table
            dataSource={dataSource}
            columns={columns}
            pagination={false}
            size='small'
            rowKey='key'
          />
          <div style={{ marginTop: 12 }}>
            <Button theme='borderless' onClick={resetToDefault}>
              {t('恢复默认')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <TextArea
            value={jsonText}
            onChange={handleJsonChange}
            autosize={{ minRows: 8, maxRows: 20 }}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          {jsonError && (
            <Text
              type='danger'
              size='small'
              style={{ display: 'block', marginTop: 4 }}
            >
              {jsonError}
            </Text>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <Button
              icon={<IconCopy />}
              size='small'
              theme='borderless'
              onClick={() => {
                copy(jsonText, t('JSON'));
              }}
            >
              {t('复制')}
            </Button>
            <Button size='small' theme='borderless' onClick={resetToDefault}>
              {t('恢复默认')}
            </Button>
          </div>
        </>
      )}

      <div
        style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}
      >
        <Button
          theme='solid'
          type='primary'
          loading={saving}
          disabled={mode === 'json' && !!jsonError}
          onClick={handleSave}
        >
          {t('保存')}
        </Button>
      </div>
    </div>
  );
}
