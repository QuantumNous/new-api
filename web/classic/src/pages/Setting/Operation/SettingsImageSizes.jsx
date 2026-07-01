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
  parseImageSizeConfig,
  normalizeImageSize,
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
      Object.entries(cfg.models || {}).map(([model, sizes]) => ({
        model,
        sizes: Array.isArray(sizes) ? sizes : [],
      })),
    );
  }, [props.options]);

  const addRow = () =>
    setModelRows((prev) => [...prev, { model: '', sizes: [] }]);

  const updateRow = (idx, patch) =>
    setModelRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    );

  const removeRow = (idx) =>
    setModelRows((prev) => prev.filter((_, i) => i !== idx));

  const onSubmit = async () => {
    setLoading(true);
    try {
      const normList = (list) =>
        Array.from(
          new Set((list || []).map(normalizeImageSize).filter(Boolean)),
        );
      const models = {};
      modelRows.forEach((r) => {
        const name = (r.model || '').trim();
        const sizes = normList(r.sizes);
        if (name && sizes.length > 0) {
          models[name] = sizes;
        }
      });
      const value = JSON.stringify({
        default: normList(defaultSizes),
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
          '为图片模型配置可选尺寸。未单独配置的模型使用默认尺寸；下拉支持输入自定义尺寸（如 1024x1024）。',
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
                }}
              >
                <Input
                  value={row.model}
                  onChange={(v) => updateRow(idx, { model: v })}
                  placeholder={t('模型名称')}
                  style={{ width: 240, flexShrink: 0 }}
                />
                <Select
                  multiple
                  filter
                  allowCreate
                  value={row.sizes}
                  optionList={toSizeOptions(row.sizes)}
                  onChange={(v) => updateRow(idx, { sizes: v })}
                  placeholder={t('输入尺寸后回车，如 1024x1024')}
                  style={{ flex: 1 }}
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
