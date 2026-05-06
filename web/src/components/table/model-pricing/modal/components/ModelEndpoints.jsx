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
import { IconLink } from '@douyinfe/semi-icons';

const { Text } = Typography;

const ModelEndpoints = ({ modelData, endpointMap = {}, t }) => {
  const renderAPIEndpoints = () => {
    if (!modelData) return null;

    const mapping = endpointMap;
    const types = modelData.supported_endpoint_types || [];

    if (types.length === 0) {
      return (
        <div className='model-detail-empty-state'>
          {t('暂无支持的接口端点')}
        </div>
      );
    }

    return types.map((type) => {
      const info = mapping[type] || {};
      let path = info.path || '';
      // 如果路径中包含 {model} 占位符，替换为真实模型名称
      if (path.includes('{model}')) {
        const modelName = modelData.model_name || modelData.modelName || '';
        path = path.replaceAll('{model}', modelName);
      }
      const method = info.method || 'POST';
      return (
        <div
          key={type}
          className='model-detail-endpoint-row'
        >
          <div className='model-detail-endpoint-main'>
            <span className='model-detail-endpoint-dot' />
            <span className='model-detail-endpoint-name'>{type}</span>
            {path && <span className='model-detail-endpoint-divider'>:</span>}
            {path && <span className='model-detail-endpoint-path'>{path}</span>}
          </div>
          {path && <span className='model-detail-endpoint-method'>{method}</span>}
        </div>
      );
    });
  };

  return (
    <Card className='model-detail-section-card'>
      <div className='model-detail-section-head'>
        <Avatar
          size='small'
          color='purple'
          className='model-detail-section-avatar model-detail-section-avatar-endpoint'
        >
          <IconLink size={16} />
        </Avatar>
        <div className='model-detail-section-copy'>
          <Text className='model-detail-section-title'>{t('API端点')}</Text>
          <div className='model-detail-section-description'>
            {t('模型支持的接口端点信息')}
          </div>
        </div>
      </div>
      <div className='model-detail-endpoint-list'>{renderAPIEndpoints()}</div>
    </Card>
  );
};

export default ModelEndpoints;
