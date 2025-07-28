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
import { Server, Gauge, ExternalLink } from 'lucide-react';
import { IllustrationConstruction, IllustrationConstructionDark } from '@douyinfe/semi-illustrations';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const ApiInfoPanel = ({
  apiInfoData,
  handleCopyUrl,
  handleSpeedTest,
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  ILLUSTRATION_SIZE,
  t
}) => {
  return (
    <Card
      {...CARD_PROPS}
      className="bg-gray-50 border-0 !rounded-2xl"
      title={
        <div className={FLEX_CENTER_GAP2}>
          <Server size={16} />
          {t('API信息')}
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer maxHeight="24rem">
        {apiInfoData.length > 0 ? (
          apiInfoData.map((api) => (
            <React.Fragment key={api.id}>
              <div className="flex p-2 hover:bg-white rounded-lg transition-colors cursor-pointer">
                <div className="flex-shrink-0 mr-3">
                  <Avatar
                    size="extra-small"
                    color={api.color}
                  >
                    {api.route.substring(0, 2)}
                  </Avatar>
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center justify-between mb-1 w-full gap-2">
                    <span className="text-sm font-medium text-gray-900 !font-bold break-all">
                      {api.route}
                    </span>
                    <div className="flex items-center gap-1 mt-1 lg:mt-0">
                      <Tag
                        prefixIcon={<Gauge size={12} />}
                        size="small"
                        color="white"
                        shape='circle'
                        onClick={() => handleSpeedTest(api.url)}
                        className="cursor-pointer hover:opacity-80 text-xs"
                      >
                        {t('测速')}
                      </Tag>
                      <Tag
                        prefixIcon={<ExternalLink size={12} />}
                        size="small"
                        color="white"
                        shape='circle'
                        onClick={() => window.open(api.url, '_blank', 'noopener,noreferrer')}
                        className="cursor-pointer hover:opacity-80 text-xs"
                      >
                        {t('跳转')}
                      </Tag>
                    </div>
                  </div>
                  <div
                    className="!text-semi-color-primary break-all cursor-pointer hover:underline mb-1"
                    onClick={() => handleCopyUrl(api.url)}
                  >
                    {api.url}
                  </div>
                  <div className="text-gray-500">
                    {api.description}
                  </div>
                </div>
              </div>
              <Divider />
            </React.Fragment>
          ))
        ) : (
          <div className="flex justify-center items-center py-8">
            <Empty
              image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
              darkModeImage={<IllustrationConstructionDark style={ILLUSTRATION_SIZE} />}
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