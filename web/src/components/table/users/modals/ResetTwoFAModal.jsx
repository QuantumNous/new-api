import React from 'react';
import { Modal } from '@douyinfe/semi-ui';

const ResetTwoFAModal = ({ visible, onCancel, onConfirm, user, t }) => {
  return (
    <Modal
      title={t('确认重置两步验证')}
      visible={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      type='warning'
    >
      {t(
        '此操作将禁用该用户当前的两步验证配置，下次登录将不再强制输入验证码，直到用户重新启用。',
      )}{' '}
      {user?.username
        ? t('目标用户：{{username}}', { username: user.username })
        : ''}
    </Modal>
  );
};

export default ResetTwoFAModal;
