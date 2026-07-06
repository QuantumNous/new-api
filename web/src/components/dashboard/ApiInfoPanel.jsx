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
import { Card, Avatar, Tag, Empty } from '@douyinfe/semi-ui';
import { Server, Gauge, ExternalLink, Copy } from 'lucide-react';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const ApiInfoPanel = ({
  apiInfoData,
  handleCopyUrl,
  handleSpeedTest,
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  t,
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className='console-dashboard-card console-api-card bg-gray-50 border-0 !rounded-2xl lg:col-span-4 xl:col-span-3'
      title={
        <div className={`console-panel-title ${FLEX_CENTER_GAP2}`}>
          <span className='console-panel-icon'>
            <Server size={16} />
          </span>
          <span>{t('API信息')}</span>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer maxHeight='24rem'>
        {apiInfoData.length > 0 ? (
          <div className='console-api-list'>
            {apiInfoData.map((api) => (
              <div key={api.id || api.route} className='console-api-item'>
                <div className='console-api-avatar-wrap'>
                  <Avatar
                    size='extra-small'
                    color={api.color}
                    className='console-api-avatar'
                  >
                    {api.route.substring(0, 2)}
                  </Avatar>
                </div>
                <div className='console-api-main'>
                  <div className='console-api-head'>
                    <span className='console-api-route'>{api.route}</span>
                    <div className='console-api-actions'>
                      <Tag
                        prefixIcon={<Gauge size={12} />}
                        size='small'
                        color='white'
                        shape='circle'
                        onClick={() => handleSpeedTest(api.url)}
                        className='console-api-action-tag'
                      >
                        {t('测速')}
                      </Tag>
                      <Tag
                        prefixIcon={<ExternalLink size={12} />}
                        size='small'
                        color='white'
                        shape='circle'
                        onClick={() =>
                          window.open(api.url, '_blank', 'noopener,noreferrer')
                        }
                        className='console-api-action-tag'
                      >
                        {t('跳转')}
                      </Tag>
                    </div>
                  </div>
                  <div className='console-api-url-row'>
                    <span
                      className='console-api-url'
                      onClick={() => handleCopyUrl(api.url)}
                    >
                      {api.url}
                    </span>
                    <Copy
                      size={14}
                      className='console-api-copy flex-shrink-0 cursor-pointer transition-colors'
                      onClick={() => handleCopyUrl(api.url)}
                    />
                  </div>
                  <div className='console-api-desc'>{api.description}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className='console-empty-state min-h-[20rem]'>
            <Empty
              image={null}
              imageStyle={{ display: 'none' }}
              title={t('暂无API信息')}
              description={t('请联系管理员在系统设置中配置API信息')}
            />
          </div>
        )}
      </ScrollableContainer>
    </Card>
  );
};

export default ApiInfoPanel;
