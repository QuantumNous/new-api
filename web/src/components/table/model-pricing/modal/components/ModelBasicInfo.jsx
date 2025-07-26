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
import { Card, Avatar, Typography } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';

const { Text } = Typography;

const ModelBasicInfo = ({ modelData, t }) => {
  // 获取模型描述
  const getModelDescription = () => {
    if (!modelData) return t('暂无模型描述');
    // 这里可以根据模型名称返回不同的描述
    if (modelData.model_name?.includes('gpt-4o-image')) {
      return t('逆向plus账号的可绘图的gpt-4o模型，由于OpenAI限制绘图数量，并非每次都能绘图成功，由于是逆向模型，只要请求成功，即使绘图失败也会扣费，请谨慎使用。推荐使用正式版的 gpt-image-1模型。');
    }
    return modelData.description || t('暂无模型描述');
  };

  return (
    <Card className="!rounded-2xl shadow-sm border-0 mb-6">
      <div className="flex items-center mb-4">
        <Avatar size="small" color="blue" className="mr-2 shadow-md">
          <IconInfoCircle size={16} />
        </Avatar>
        <div>
          <Text className="text-lg font-medium">{t('基本信息')}</Text>
          <div className="text-xs text-gray-600">{t('模型的详细描述和基本特性')}</div>
        </div>
      </div>
      <div className="text-gray-600">
        <p>{getModelDescription()}</p>
      </div>
    </Card>
  );
};

export default ModelBasicInfo; 