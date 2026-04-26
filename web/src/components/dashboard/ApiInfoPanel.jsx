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
import { Avatar, Button } from '@heroui/react';
import { EmptyState, Widget } from '@heroui-pro/react';
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
    <Widget className={CARD_PROPS?.className || ''}>
      <Widget.Header className='h-12'>
        <div className={`${FLEX_CENTER_GAP2} whitespace-nowrap`}>
          <Server size={16} className='shrink-0' />
          <Widget.Title>{t('API信息')}</Widget.Title>
        </div>
      </Widget.Header>
      <Widget.Content className='flex p-0'>
        {/* When the panel has API rows, defer to ScrollableContainer's
            scroll-with-fade behavior. When empty, render a flex wrapper that
            fills the Widget height so the EmptyState is vertically centered
            inside whatever the grid row stretches us to (matches the chart
            panel sitting next to it). `flex` on Widget.Content + `flex-1`
            on the inner wrapper is what propagates the row height down. */}
        {apiInfoData.length > 0 ? (
          <ScrollableContainer className='flex-1' maxHeight='24rem'>
            {apiInfoData.map((api) => (
              <React.Fragment key={api.id}>
                <div className='flex p-2 hover:bg-surface-secondary rounded-lg transition-colors cursor-pointer'>
                  <div className='flex-shrink-0 mr-3'>
                    <Avatar size='sm' color={api.color}>
                      <Avatar.Fallback>
                        {api.route.substring(0, 2)}
                      </Avatar.Fallback>
                    </Avatar>
                  </div>
                  <div className='flex-1'>
                    <div className='flex flex-wrap items-center justify-between mb-1 w-full gap-2'>
                      <span className='text-sm font-semibold text-foreground break-all'>
                        {api.route}
                      </span>
                      <div className='flex items-center gap-1 mt-1 lg:mt-0'>
                        <Button
                          size='sm'
                          variant='secondary'
                          onPress={() => handleSpeedTest(api.url)}
                        >
                          <Gauge size={12} />
                          {t('测速')}
                        </Button>
                        <Button
                          size='sm'
                          variant='secondary'
                          onPress={() =>
                            window.open(
                              api.url,
                              '_blank',
                              'noopener,noreferrer',
                            )
                          }
                        >
                          <ExternalLink size={12} />
                          {t('跳转')}
                        </Button>
                      </div>
                    </div>
                    <div className='flex items-center gap-1 mb-1'>
                      <span
                        className='text-sm text-primary break-all cursor-pointer hover:underline'
                        onClick={() => handleCopyUrl(api.url)}
                      >
                        {api.url}
                      </span>
                      <Copy
                        size={14}
                        className='flex-shrink-0 text-muted hover:text-primary cursor-pointer transition-colors'
                        onClick={() => handleCopyUrl(api.url)}
                      />
                    </div>
                    <div className='text-xs text-muted'>{api.description}</div>
                  </div>
                </div>
                <div className='h-px bg-border' />
              </React.Fragment>
            ))}
          </ScrollableContainer>
        ) : (
          <div className='flex flex-1 min-h-80 items-center justify-center'>
            <EmptyState size='sm'>
              <EmptyState.Header>
                <EmptyState.Media variant='icon'>
                  <Server />
                </EmptyState.Media>
                <EmptyState.Title>{t('暂无API信息')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('请联系管理员在系统设置中配置API信息')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          </div>
        )}
      </Widget.Content>
    </Widget>
  );
};

export default ApiInfoPanel;
