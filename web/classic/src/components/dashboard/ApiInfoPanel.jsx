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
import { Card, Avatar, Tag, Divider, Empty } from '@douyinfe/semi-ui';
import { Server, Gauge, ExternalLink, Copy } from 'lucide-react';
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const ApiInfoPanel = ({
  apiInfoData,
  handleCopyUrl,
  handleSpeedTest,
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  ILLUSTRATION_SIZE,
  t,
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className='dashboard-api-panel !rounded-[2rem]'
      title={
        <div className='dashboard-panel-header'>
          <div className='dashboard-panel-eyebrow'>{t('端点')}</div>
          <div className={`dashboard-panel-title-row ${FLEX_CENTER_GAP2}`}>
            <Server size={16} />
            {t('API信息')}
          </div>
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer
        maxHeight='24rem'
        className='dashboard-panel-scroll-wrap'
        contentClassName='dashboard-panel-scroll'
        fadeIndicatorClassName='dashboard-panel-fade'
      >
        {apiInfoData.length > 0 ? (
          apiInfoData.map((api) => (
            <React.Fragment key={api.id}>
              <div className='dashboard-api-item'>
                <div className='dashboard-api-avatar-wrap'>
                  <Avatar size='extra-small' color={api.color}>
                    {api.route.substring(0, 2)}
                  </Avatar>
                </div>
                <div className='dashboard-api-copy'>
                  <div className='dashboard-api-topline'>
                    <span className='dashboard-api-route'>{api.route}</span>
                    <div className='dashboard-api-actions'>
                      <Tag
                        prefixIcon={<Gauge size={12} />}
                        size='small'
                        color='white'
                        shape='circle'
                        onClick={() => handleSpeedTest(api.url)}
                        className='dashboard-api-tag'
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
                        className='dashboard-api-tag'
                      >
                        {t('跳转')}
                      </Tag>
                    </div>
                  </div>
                  <div className='dashboard-api-url-row'>
                    <span
                      className='dashboard-api-url'
                      onClick={() => handleCopyUrl(api.url)}
                    >
                      {api.url}
                    </span>
                    <Copy
                      size={14}
                      className='dashboard-api-copy-icon'
                      onClick={() => handleCopyUrl(api.url)}
                    />
                  </div>
                  <div className='dashboard-api-description'>
                    {api.description}
                  </div>
                </div>
              </div>
              <Divider className='dashboard-api-divider' />
            </React.Fragment>
          ))
        ) : (
          <div className='dashboard-panel-empty min-h-[20rem] w-full'>
            <Empty
              image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
              darkModeImage={
                <IllustrationConstructionDark style={ILLUSTRATION_SIZE} />
              }
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
