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
import { Accordion, AccordionItem } from '@heroui/react';
import { EmptyState, Widget } from '@heroui-pro/react';
import { HelpCircle } from 'lucide-react';
import { marked } from 'marked';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const FaqPanel = ({ faqData, CARD_PROPS, FLEX_CENTER_GAP2, t }) => {
  return (
    <Widget className={`lg:col-span-1 ${CARD_PROPS?.className || ''}`}>
      <Widget.Header className='h-12'>
        <div className={`${FLEX_CENTER_GAP2} whitespace-nowrap`}>
          <HelpCircle size={16} className='shrink-0' />
          <Widget.Title>{t('常见问答')}</Widget.Title>
        </div>
      </Widget.Header>
      <Widget.Content className='p-0'>
        <ScrollableContainer maxHeight='24rem'>
          {faqData.length > 0 ? (
            <Accordion selectionMode='multiple' variant='tertiary'>
              {faqData.map((item, index) => (
                <AccordionItem
                  key={index.toString()}
                  aria-label={item.question}
                  title={item.question}
                >
                  <div
                    className='prose prose-sm max-w-none dark:prose-invert'
                    dangerouslySetInnerHTML={{
                      __html: marked.parse(item.answer || ''),
                    }}
                  />
                </AccordionItem>
              ))}
            </Accordion>
          ) : (
            <EmptyState size='sm'>
              <EmptyState.Header>
                <EmptyState.Media variant='icon'>
                  <HelpCircle />
                </EmptyState.Media>
                <EmptyState.Title>{t('暂无常见问答')}</EmptyState.Title>
                <EmptyState.Description>
                  {t('请联系管理员在系统设置中配置常见问答')}
                </EmptyState.Description>
              </EmptyState.Header>
            </EmptyState>
          )}
        </ScrollableContainer>
      </Widget.Content>
    </Widget>
  );
};

export default FaqPanel;
