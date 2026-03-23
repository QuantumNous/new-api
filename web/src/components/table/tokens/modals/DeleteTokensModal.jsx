import React from 'react';
import { Modal } from '@douyinfe/semi-ui';

const DeleteTokensModal = ({
  visible,
  onCancel,
  onConfirm,
  selectedKeys,
  t,
}) => {
  return (
    <Modal
      title={t('批量删除令牌')}
      visible={visible}
      onCancel={onCancel}
      onOk={onConfirm}
      type='warning'
    >
      <div>
        {t('确定要删除所选的 {{count}} 个令牌吗？', {
          count: selectedKeys.length,
        })}
      </div>
    </Modal>
  );
};

export default DeleteTokensModal;
