import React, { useState, useEffect, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Form,
  Button,
  Select,
  Input,
  Typography,
  Empty,
} from '@douyinfe/semi-ui';
import { Plus, Trash2 } from 'lucide-react';
import { API, showSuccess, showError } from '../../../helpers';
import { StatusContext } from '../../../context/Status';
import {
  parseVideoModelConfig,
  normalizeVideoSize,
} from '../../../constants/videoPlayground.constants';

const { Text } = Typography;

const toOptions = (arr) => (arr || []).map((s) => ({ label: s, value: s }));

export default function SettingsVideoModels(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);

  // 留空表示“按模型类别自动兜底”（sora 像素/seconds，minimax 720P/duration）
  const [defaultSizes, setDefaultSizes] = useState([]);
  const [defaultDurations, setDefaultDurations] = useState([]);
  // [{ model, sizes:[], durations:[] }]
  const [modelRows, setModelRows] = useState([]);

  useEffect(() => {
    const cfg = parseVideoModelConfig(props.options?.VideoModelConfig);
    setDefaultSizes(cfg.default.sizes);
    setDefaultDurations(cfg.default.durations);
    setModelRows(
      Object.entries(cfg.models || {}).map(([model, c]) => ({
        model,
        sizes: c.sizes || [],
        durations: c.durations || [],
      })),
    );
  }, [props.options]);

  const addRow = () =>
    setModelRows((prev) => [...prev, { model: '', sizes: [], durations: [] }]);
  const updateRow = (idx, patch) =>
    setModelRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );
  const removeRow = (idx) =>
    setModelRows((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    setLoading(true);
    try {
      const normSizes = (l) =>
        Array.from(new Set((l || []).map(normalizeVideoSize).filter(Boolean)));
      const normDur = (l) =>
        Array.from(
          new Set((l || []).map((x) => String(x).trim()).filter(Boolean)),
        );
      const models = {};
      modelRows.forEach((r) => {
        const name = (r.model || '').trim();
        if (!name) return;
        models[name] = {
          sizes: normSizes(r.sizes),
          durations: normDur(r.durations),
        };
      });
      const value = JSON.stringify({
        default: {
          sizes: normSizes(defaultSizes),
          durations: normDur(defaultDurations),
        },
        models,
      });
      const res = await API.put('/api/option/', {
        key: 'VideoModelConfig',
        value,
      });
      if (res.data.success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: { ...statusState.status, VideoModelConfig: value },
        });
        if (props.refresh) await props.refresh();
      } else {
        showError(res.data.message);
      }
    } catch (e) {
      showError(t('保存失败，请重试'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Form.Section
        text={t('视频模型配置')}
        extraText={t(
          '声明哪些是视频模型，并为其配置可选尺寸与时长。默认与按模型均留空时，按模型类别自动兜底：sora 类用像素尺寸(720x1280)+秒数，其余(MiniMax 等)用分辨率档位(720P)。下拉支持输入自定义值。',
        )}
      >
        <div
          style={{
            display: 'flex',
            gap: 24,
            marginBottom: 24,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ flex: 1, minWidth: 220 }}>
            <Text strong>{t('默认尺寸')}</Text>
            <Select
              multiple
              filter
              allowCreate
              value={defaultSizes}
              optionList={toOptions(defaultSizes)}
              onChange={setDefaultSizes}
              placeholder={t('输入尺寸后回车，如 720P')}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 220 }}>
            <Text strong>{t('默认时长(秒)')}</Text>
            <Select
              multiple
              filter
              allowCreate
              value={defaultDurations}
              optionList={toOptions(defaultDurations)}
              onChange={setDefaultDurations}
              placeholder={t('输入秒数后回车，如 5')}
              style={{ width: '100%', marginTop: 8 }}
            />
          </div>
        </div>

        <Text strong>{t('按模型配置')}</Text>
        <div style={{ marginTop: 8 }}>
          {modelRows.length === 0 ? (
            <Empty
              description={
                <Text type='tertiary'>{t('暂无视频模型，请添加')}</Text>
              }
              style={{ padding: '16px 0' }}
            />
          ) : (
            modelRows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  gap: 8,
                  alignItems: 'flex-start',
                  marginBottom: 12,
                  flexWrap: 'wrap',
                }}
              >
                <Input
                  value={row.model}
                  onChange={(v) => updateRow(idx, { model: v })}
                  placeholder={t('模型名称')}
                  style={{ width: 200, flexShrink: 0 }}
                />
                <Select
                  multiple
                  filter
                  allowCreate
                  value={row.sizes}
                  optionList={toOptions(row.sizes)}
                  onChange={(v) => updateRow(idx, { sizes: v })}
                  placeholder={t('尺寸，如 720P')}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <Select
                  multiple
                  filter
                  allowCreate
                  value={row.durations}
                  optionList={toOptions(row.durations)}
                  onChange={(v) => updateRow(idx, { durations: v })}
                  placeholder={t('时长(秒)，如 5')}
                  style={{ flex: 1, minWidth: 140 }}
                />
                <Button
                  type='danger'
                  theme='borderless'
                  icon={<Trash2 size={16} />}
                  onClick={() => removeRow(idx)}
                />
              </div>
            ))
          )}
          <Button
            theme='outline'
            type='tertiary'
            icon={<Plus size={16} />}
            onClick={addRow}
            style={{ marginTop: 4 }}
          >
            {t('添加模型')}
          </Button>
        </div>

        <div style={{ marginTop: 24 }}>
          <Button type='primary' onClick={onSubmit} loading={loading}>
            {t('保存设置')}
          </Button>
        </div>
      </Form.Section>
    </Card>
  );
}
