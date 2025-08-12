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
  container: "w-12 h-12 rounded-2xl flex items-center justify-center relative shadow-md",
  icon: "w-8 h-8 flex items-center justify-center",
};

const ModelHeader = ({ modelData, vendorsMap = {}, t }) => {
  // 获取模型图标（优先模型图标，其次供应商图标）
  const getModelIcon = () => {
    // 1) 优先使用模型自定义图标
    if (modelData?.icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(modelData.icon, 32)}
          </div>
        </div>
      );
    }
    // 2) 退化为供应商图标
    if (modelData?.vendor_icon) {
      return (
        <div className={CARD_STYLES.container}>
          <div className={CARD_STYLES.icon}>
            {getLobeHubIcon(modelData.vendor_icon, 32)}
          </div>
        </div>
      );
    }

    // 如果没有供应商图标，使用模型名称的前两个字符
    const avatarText = modelData?.model_name?.slice(0, 2).toUpperCase() || 'AI';
    return (
      <div className={CARD_STYLES.container}>
        <Avatar
          size="large"
          style={{
            width: 48,
            height: 48,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 'bold'
          }}
        >
          {avatarText}
        </Avatar>
      </div>
    );
  };

  return (
    <div className="flex items-center">
      {getModelIcon()}
      <div className="ml-3 font-normal">
        <Paragraph
          className="!mb-0 !text-lg !font-medium"
          copyable={{
            content: modelData?.model_name || '',
            onCopy: () => Toast.success({ content: t('已复制模型名称') })
          }}
        >
          <span className="truncate max-w-60 font-bold">{modelData?.model_name || t('未知模型')}</span>
        </Paragraph>
      </div>
    </div>
  );
};

export default ModelHeader; 