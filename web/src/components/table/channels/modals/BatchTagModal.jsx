import React from 'react';
import { Modal, Input, Typography } from '@douyinfe/semi-ui';

const BatchTagModal = ({
  showBatchSetTag,
  setShowBatchSetTag,
  batchSetChannelTag,
  batchSetTagValue,
  setBatchSetTagValue,
  selectedChannels,
  t,
}) => {
  return (
    <Modal
      title={t('批量设置标签')}
      visible={showBatchSetTag}
      onOk={batchSetChannelTag}
      onCancel={() => setShowBatchSetTag(false)}
      maskClosable={false}
      centered={true}
      size='small'
      className='!rounded-lg'
    >
      <div className='mb-5'>
        <Typography.Text>{t('请输入要设置的标签名称')}</Typography.Text>
      </div>
      <Input
        placeholder={t('请输入标签名称')}
        value={batchSetTagValue}
        onChange={(v) => setBatchSetTagValue(v)}
      />
      <div className='mt-4'>
        <Typography.Text type='secondary'>
          {t('已选择 ${count} 个渠道').replace(
            '${count}',
            selectedChannels.length,
          )}
        </Typography.Text>
      </div>
    </Modal>
  );
};

export default BatchTagModal;
