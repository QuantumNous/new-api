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
import { Avatar, Typography, Badge } from '@douyinfe/semi-ui';
import { IconLink } from '@douyinfe/semi-icons';

const { Text } = Typography;

const ModelEndpoints = ({ modelData, endpointMap = {}, t }) => {
  const renderAPIEndpoints = () => {
    if (!modelData) return null;

    const mapping = endpointMap;
    const types = modelData.supported_endpoint_types || [];

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
        <div key={type} className='pricing-detail-endpoint-row'>
          <span className='pricing-detail-endpoint-main'>
            <Badge dot type='success' className='pricing-detail-endpoint-dot' />
            <span className='pricing-detail-endpoint-type'>{type}</span>
            {path && (
              <span className='pricing-detail-endpoint-path'>{path}</span>
            )}
          </span>
          {path && (
            <span className='pricing-detail-endpoint-method'>{method}</span>
          )}
        </div>
      );
    });
  };

  return (
    <div className='pricing-detail-block'>
      <div className='pricing-detail-block-header'>
        <Avatar
          size='small'
          color='purple'
          className='pricing-detail-block-icon'
        >
          <IconLink size={16} />
        </Avatar>
        <div>
          <Text className='pricing-detail-block-title'>{t('API端点')}</Text>
          <div className='pricing-detail-block-desc'>
            {t('模型支持的接口端点信息')}
          </div>
        </div>
      </div>
      <div className='pricing-detail-endpoints'>{renderAPIEndpoints()}</div>
    </div>
  );
};

export default ModelEndpoints;
