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
import {
  Banner,
  Button,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Table,
  TextArea,
  Typography,
} from '@douyinfe/semi-ui';
import { IconCopy, IconDelete, IconPlus } from '@douyinfe/semi-icons';
import { useTranslation } from 'react-i18next';
import { API, copy, showError, showSuccess } from '../../../helpers';

const { Text } = Typography;

const OPTION_KEY = 'billing_setting.video_input_ratio';

const DEFAULT_RATIOS = {
  'doubao-seedance-2-0-260128': 28 / 46,
  'doubao-seedance-2-0-fast-260128': 22 / 37,
};

function rowsToObject(rows) {
  const ratios = {};
  for (const row of rows) {
    const model = row.model.trim();
    if (!model) continue;
    ratios[model] = Number(row.ratio) || 0;
  }
  return ratios;
}

function objectToRows(ratios) {
  return Object.entries(ratios).map(([model, ratio], i) => ({
    id: i,
    model,
    ratio,
  }));
}

export default function VideoInputRatioSettings({ options }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [mode, setMode] = useState('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ratios = {};
    try {
      const raw = options?.[OPTION_KEY];
      if (raw) {
        ratios = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch {
      ratios = {};
    }

    if (!ratios || Object.keys(ratios).length === 0) {
      ratios = { ...DEFAULT_RATIOS };
    }

    setRows(objectToRows(ratios));
    setJsonText(JSON.stringify(ratios, null, 2));
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
      if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) {
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
    syncToJson([...rows, { id: Date.now(), model: '', ratio: 1 }]);
  };

  const removeRow = (id) => {
    syncToJson(rows.filter((r) => r.id !== id));
  };

  const resetToDefault = () => {
    syncToJson(objectToRows(DEFAULT_RATIOS));
  };

  const currentRatios = useMemo(() => rowsToObject(rows), [rows]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await API.put('/api/option/', {
        key: OPTION_KEY,
        value: JSON.stringify(currentRatios),
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

  const columns = [
    {
      title: t('模型名称'),
      dataIndex: 'model',
      render: (text, record) => (
        <Input
          value={text}
          placeholder='doubao-seedance-2-0-260128'
          onChange={(val) => updateRow(record.id, 'model', val)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('视频参考折扣比例'),
      dataIndex: 'ratio',
      width: 180,
      render: (val, record) => (
        <InputNumber
          value={val}
          min={0}
          step={0.0001}
          onChange={(v) => updateRow(record.id, 'ratio', v ?? 0)}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('操作'),
      width: 60,
      render: (_, record) => (
        <Button
          icon={<IconDelete />}
          type='danger'
          theme='borderless'
          size='small'
          onClick={() => removeRow(record.id)}
        />
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 720 }}>
      <Banner
        type='info'
        description={
          <>
            <div>
              {t(
                '当视频生成请求包含视频参考输入（如 content 中的 video_url）时，计费会在 ModelRatio 上乘以此折扣比例。',
              )}
            </div>
            <div style={{ marginTop: 4 }}>
              {t(
                '请将 ModelRatio 设为「不含视频参考」的较高单价。比例 = 含视频单价 ÷ 不含视频单价（例如 28÷46 ≈ 0.6087）。',
              )}
            </div>
          </>
        }
        style={{ marginBottom: 16 }}
      />

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
            dataSource={rows}
            columns={columns}
            pagination={false}
            size='small'
            rowKey='id'
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <Button icon={<IconPlus />} onClick={addRow}>
              {t('添加')}
            </Button>
            <Button theme='borderless' onClick={resetToDefault}>
              {t('恢复默认')}
            </Button>
          </div>
        </>
      ) : (
        <>
          <TextArea
            value={jsonText}
            onChange={syncToVisual}
            autosize={{ minRows: 8, maxRows: 20 }}
            style={{ fontFamily: 'monospace', fontSize: 13 }}
          />
          {jsonError && (
            <Text type='danger' size='small' style={{ display: 'block', marginTop: 4 }}>
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

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
        <Button
          theme='solid'
          type='primary'
          loading={saving}
          disabled={mode === 'json' && !!jsonError}
          onClick={handleSave}
        >
          {t('保存视频参考计费比例')}
        </Button>
      </div>
    </div>
  );
}
