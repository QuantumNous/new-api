/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';
import { Modal, Input, Typography } from '@douyinfe/semi-ui';

const BatchTagModal = ({
  showBatchSetTag,
  setShowBatchSetTag,
  batchSetChannelTag,
  batchSetTagValue,
  setBatchSetTagValue,
  selectedChannels,
  t
}) => {
  return (
    <Modal
      title={t('批量设置标签')}
      visible={showBatchSetTag}
      onOk={batchSetChannelTag}
      onCancel={() => setShowBatchSetTag(false)}
      maskClosable={false}
      centered={true}
      size="small"
      className="!rounded-lg"
    >
      <div className="mb-5">
        <Typography.Text>{t('请输入要设置的标签名称')}</Typography.Text>
      </div>
      <Input
        placeholder={t('请输入标签名称')}
        value={batchSetTagValue}
        onChange={(v) => setBatchSetTagValue(v)}
      />
      <div className="mt-4">
        <Typography.Text type='secondary'>
          {t('已选择 ${count} 个渠道').replace('${count}', selectedChannels.length)}
        </Typography.Text>
      </div>
    </Modal>
  );
};

export default BatchTagModal; 