import React from 'react';
import { Modal } from '@douyinfe/semi-ui';
import { REDEMPTION_ACTIONS } from '../../../../constants/redemption.constants';

const DeleteRedemptionModal = ({
  visible,
  onCancel,
  record,
  manageRedemption,
  refresh,
  redemptions,
  activePage,
  t,
}) => {
  const handleConfirm = async () => {
    await manageRedemption(record.id, REDEMPTION_ACTIONS.DELETE, record);
    await refresh();
    setTimeout(() => {
      if (redemptions.length === 0 && activePage > 1) {
        refresh(activePage - 1);
      }
    }, 100);
    onCancel(); // Close modal after success
  };

  return (
    <Modal
      title={t('确定是否要删除此兑换码？')}
      visible={visible}
      onCancel={onCancel}
      onOk={handleConfirm}
      type='warning'
    >
      {t('此修改将不可逆')}
    </Modal>
  );
};

export default DeleteRedemptionModal;
