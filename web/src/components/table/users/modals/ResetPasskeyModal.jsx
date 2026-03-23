import React from 'react';
import { Modal } from '@douyinfe/semi-ui';

const ResetPasskeyModal = ({ visible, onCancel, onConfirm, user, t }) => {
  return (
    <Modal
      title={t('确认重置 Passkey')}
      visible={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      type='warning'
    >
      {t('此操作将解绑用户当前的 Passkey，下次登录需要重新注册。')}{' '}
      {user?.username
        ? t('目标用户：{{username}}', { username: user.username })
        : ''}
    </Modal>
  );
};

export default ResetPasskeyModal;
