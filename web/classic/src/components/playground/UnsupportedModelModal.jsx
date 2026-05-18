import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Button, Typography, Toast } from '@douyinfe/semi-ui';
import { IconCopy } from '@douyinfe/semi-icons';
import { copy } from '../../helpers';
import { buildCurlExample, getApiOrigin } from '../../helpers/playground';

const { Text } = Typography;

// 操练场暂不支持当前模型时弹出，提示用户改用直接 API 调用，
// 并给出可一键复制的 curl 示例。
const UnsupportedModelModal = ({ visible, onClose, model, endpoint, userPrompt }) => {
  const { t } = useTranslation();

  const curl = useMemo(() => {
    if (!endpoint) return '';
    return buildCurlExample(model, endpoint, userPrompt, getApiOrigin());
  }, [model, endpoint, userPrompt]);

  const handleCopy = async () => {
    if (!curl) return;
    const ok = await copy(curl);
    if (ok) {
      Toast.success(t('已复制到剪贴板'));
    } else {
      Toast.error(t('复制失败，请手动选择文本复制'));
    }
  };

  return (
    <Modal
      title={t('操练场暂不支持该模型')}
      visible={visible}
      onCancel={onClose}
      footer={
        <Button type='primary' onClick={onClose}>
          {t('我知道了')}
        </Button>
      }
      width={640}
    >
      <div style={{ marginBottom: 12 }}>
        <Text>
          {t('模型 ')}
          <Text strong code>
            {model}
          </Text>
          {endpoint
            ? t(' 属于「{{label}}」类，请直接调用 API：', {
                label: endpoint.label,
              })
            : t(' 不支持在操练场中调试，请直接调用 API。')}
        </Text>
      </div>

      {curl && (
        <div
          style={{
            position: 'relative',
            background: 'var(--semi-color-fill-0)',
            border: '1px solid var(--semi-color-border)',
            borderRadius: 6,
            padding: 12,
            paddingRight: 44,
          }}
        >
          <Button
            type='tertiary'
            size='small'
            icon={<IconCopy />}
            onClick={handleCopy}
            style={{ position: 'absolute', top: 8, right: 8 }}
            aria-label={t('复制')}
          />
          <pre
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 12,
              lineHeight: 1.55,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {curl}
          </pre>
        </div>
      )}
    </Modal>
  );
};

export default UnsupportedModelModal;
