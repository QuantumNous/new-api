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
  FALLBACK_IMAGE_SIZES,
  IMAGE_CAPABILITIES,
  parseImageSizeConfig,
  normalizeSizeList,
  normalizeCapabilityList,
} from '../../../constants/imagePlayground.constants';

const { Text } = Typography;

// 把尺寸数组转成 Select 选项
const toSizeOptions = (sizes) =>
  (sizes || []).map((s) => ({ label: s, value: s }));

export default function SettingsImageSizes(props) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [statusState, statusDispatch] = useContext(StatusContext);

  const [defaultSizes, setDefaultSizes] = useState(FALLBACK_IMAGE_SIZES);
  // [{ model: 'xxx', sizes: ['1024x1024'] }]
  const [modelRows, setModelRows] = useState([]);

  // 从已存配置初始化
  useEffect(() => {
    const raw = props.options?.ImageModelSizeConfig;
    const cfg = parseImageSizeConfig(raw);
    setDefaultSizes(cfg.default);
    setModelRows(
      Object.entries(cfg.models || {}).map(([model, c]) => ({
        model,
        sizes: Array.isArray(c) ? c : c?.sizes || [],
        capabilities: Array.isArray(c) ? [] : c?.capabilities || [],
      })),
    );
  }, [props.options]);

  const addRow = () =>
    setModelRows((prev) => [...prev, { model: '', sizes: [], capabilities: [] }]);

  const updateRow = (idx, patch) =>
    setModelRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );

  const removeRow = (idx) =>
    setModelRows((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    setLoading(true);
    try {
      const models = {};
      modelRows.forEach((r) => {
        const name = (r.model || '').trim();
        // 与视频配置一致：只要填了模型名就保留该行（空尺寸走默认尺寸，
        // 且模型出现在配置里即可被文本体验区排除）。
        if (name) {
          models[name] = {
            sizes: normalizeSizeList(r.sizes),
            capabilities: normalizeCapabilityList(r.capabilities),
          };
        }
      });
      const value = JSON.stringify({
        default: normalizeSizeList(defaultSizes),
        models,
      });
      const res = await API.put('/api/option/', {
        key: 'ImageModelSizeConfig',
        value,
      });
      if (res.data.success) {
        showSuccess(t('保存成功'));
        statusDispatch({
          type: 'set',
          payload: {
            ...statusState.status,
            ImageModelSizeConfig: value,
          },
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
        text={t('图片模型尺寸配置')}
        extraText={t(
          '为图片模型配置可选尺寸与支持能力。支持两种输入：宽高比（如 16:9，主流模型推荐）或精确分辨率（如 1024x1024），两者都可配置、也可混用。注意：gpt-image 系列只支持精确分辨率（1024x1024/1536x1024/1024x1536）；Gemini、z-image、qwen 等主流模型支持宽高比。未单独配置的模型使用默认尺寸；仅勾选了「文生图」的模型会出现在文生图体验区，能力也会作为标签在模型广场展示。',
        )}
      >
        {/* 默认尺寸 */}
        <div style={{ marginBottom: 24 }}>
          <Text strong>{t('默认尺寸')}</Text>
          <Select
            multiple
            filter
            allowCreate
            value={defaultSizes}
            optionList={toSizeOptions(defaultSizes)}
            onChange={(v) => setDefaultSizes(v)}
            placeholder={t('输入尺寸后回车，如 1024x1024')}
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>

        {/* 按模型配置 */}
        <Text strong>{t('按模型配置')}</Text>
        <div style={{ marginTop: 8 }}>
          {modelRows.length === 0 ? (
            <Empty
              description={
                <Text type='tertiary'>{t('暂无按模型的尺寸配置')}</Text>
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
                  optionList={toSizeOptions(row.sizes)}
                  onChange={(v) => updateRow(idx, { sizes: v })}
                  placeholder={t('输入尺寸后回车，如 1024x1024')}
                  style={{ flex: 1, minWidth: 160 }}
                />
                <Select
                  multiple
                  filter
                  value={row.capabilities}
                  optionList={IMAGE_CAPABILITIES.map((c) => ({
                    label: t(c),
                    value: c,
                  }))}
                  onChange={(v) => updateRow(idx, { capabilities: v })}
                  placeholder={t('支持能力')}
                  style={{ flex: 1, minWidth: 160 }}
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
