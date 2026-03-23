import React from 'react';
import { Modal, Button, Space } from '@douyinfe/semi-ui';

const CopyTokensModal = ({
  visible,
  onCancel,
  batchCopyTokens,
  t,
}) => {
  // Handle copy with name and key format
  const handleCopyWithName = async () => {
    await batchCopyTokens('name+key');
    onCancel();
  };

  // Handle copy with key only format
  const handleCopyKeyOnly = async () => {
    await batchCopyTokens('key-only');
    onCancel();
  };

  return (
    <Modal
      title={t('复制令牌')}
      icon={null}
      visible={visible}
      onCancel={onCancel}
      footer={
        <Space>
          <Button type='tertiary' onClick={handleCopyWithName}>
            {t('名称+密钥')}
          </Button>
          <Button onClick={handleCopyKeyOnly}>{t('仅密钥')}</Button>
        </Space>
      }
    >
      {t('请选择你的复制方式')}
    </Modal>
  );
};

export default CopyTokensModal;
