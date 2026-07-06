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
import { Typography, Toast, Avatar } from '@douyinfe/semi-ui';
import { getLobeHubIcon } from '../../../../../helpers';

const { Paragraph } = Typography;

const CARD_STYLES = {
  container:
    'w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md',
  icon: 'w-8 h-8 flex items-center justify-center',
};

const ModelHeader = ({ modelData, vendorsMap = {}, t }) => {
  const vendorName =
    modelData?.vendor_name ||
    (modelData?.vendor_id && vendorsMap[modelData.vendor_id]?.name) ||
    t('未知供应商');
  const billingLabel =
    modelData?.billing_mode === 'tiered_expr'
      ? t('动态计费')
      : modelData?.quota_type === 0
        ? t('按量计费')
        : modelData?.quota_type === 1
          ? t('按次计费')
          : t('未知计费');

  // 获取模型图标（优先模型图标，其次供应商图标）
  const getModelIcon = () => {
    // 1) 优先使用模型自定义图标
    if (modelData?.icon) {
      return (
        <div className={`${CARD_STYLES.container} pricing-detail-model-icon`}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(modelData.icon, 32)}
          </div>
        </div>
      );
    }
    // 2) 退化为供应商图标
    if (modelData?.vendor_icon) {
      return (
        <div className={`${CARD_STYLES.container} pricing-detail-model-icon`}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(modelData.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    // 如果没有供应商图标，使用模型名称的前两个字符
    const avatarText = modelData?.model_name?.slice(0, 2).toUpperCase() || 'AI';
    return (
      <div className={`${CARD_STYLES.container} pricing-detail-model-icon`}>
        <Avatar
          size='large'
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 'bold',
          }}
        >
          {avatarText}
        </Avatar>
      </div>
    );
  };

  return (
    <div className='pricing-detail-header'>
      {getModelIcon()}
      <div className='pricing-detail-header-copy'>
        <Paragraph
          className='pricing-detail-title !mb-0'
          copyable={{
            content: modelData?.model_name || '',
            onCopy: () => Toast.success({ content: t('已复制模型名称') }),
          }}
        >
          <span>{modelData?.model_name || t('未知模型')}</span>
        </Paragraph>
        <div className='pricing-detail-subtitle'>
          <span>{vendorName}</span>
          <span className='pricing-detail-dot' />
          <span>{billingLabel}</span>
        </div>
      </div>
    </div>
  );
};

export default ModelHeader;
