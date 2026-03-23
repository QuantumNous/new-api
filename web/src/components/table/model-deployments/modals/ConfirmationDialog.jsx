import React, { useState, useEffect } from 'react';
import { Modal, Typography, Input } from '@douyinfe/semi-ui';

const { Text } = Typography;

const ConfirmationDialog = ({
  visible,
  onCancel,
  onConfirm,
  title,
  type = 'danger',
  deployment,
  t,
  loading = false,
}) => {
  const [confirmText, setConfirmText] = useState('');

  useEffect(() => {
    if (!visible) {
      setConfirmText('');
    }
  }, [visible]);

  const requiredText = deployment?.container_name || deployment?.id || '';
  const isConfirmed = Boolean(requiredText) && confirmText === requiredText;

  const handleCancel = () => {
    setConfirmText('');
    onCancel();
  };

  const handleConfirm = () => {
    if (isConfirmed) {
      onConfirm();
      handleCancel();
    }
  };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={handleCancel}
      onOk={handleConfirm}
      okText={t('确认')}
      cancelText={t('取消')}
      okButtonProps={{
        disabled: !isConfirmed,
        type: type === 'danger' ? 'danger' : 'primary',
        loading,
      }}
      width={480}
    >
      <div className='space-y-4'>
        <Text type='danger' strong>
          {t('此操作具有风险，请确认要继续执行')}。
        </Text>
        <Text>
          {t('请输入部署名称以完成二次确认')}：
          <Text code className='ml-1'>
            {requiredText || t('未知部署')}
          </Text>
        </Text>
        <Input
          value={confirmText}
          onChange={setConfirmText}
          placeholder={t('再次输入部署名称')}
          autoFocus
        />
        {!isConfirmed && confirmText && (
          <Text type='danger' size='small'>
            {t('部署名称不匹配，请检查后重新输入')}
          </Text>
        )}
      </div>
    </Modal>
  );
};

export default ConfirmationDialog;
