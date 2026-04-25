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
import {
  Accordion,
  AccordionItem,
  Card,
} from '@heroui/react';
import { HelpCircle } from 'lucide-react';
import { marked } from 'marked';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const FaqPanel = ({
  faqData,
  CARD_PROPS,
  FLEX_CENTER_GAP2,
  ILLUSTRATION_SIZE,
  t,
}) => {
  return (
    <Card
      className={`shadow-sm !rounded-2xl lg:col-span-1 ${CARD_PROPS?.className || ''}`}
      shadow='none'
    >
      <div className='border-b border-border px-4 py-3'>
        <div className={FLEX_CENTER_GAP2}>
          <HelpCircle size={16} />
          {t('常见问答')}
        </div>
      </div>
      <div className='p-0'>
        <ScrollableContainer maxHeight='24rem'>
          {faqData.length > 0 ? (
            <Accordion selectionMode='multiple' variant='light'>
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
            <div className='flex flex-col items-center justify-center px-6 py-10 text-center'>
              <div
                className='mb-4 rounded-3xl bg-surface-secondary p-6 text-muted'
                style={ILLUSTRATION_SIZE}
              >
                <HelpCircle size={42} />
              </div>
              <div className='text-sm font-semibold text-foreground'>
                {t('暂无常见问答')}
              </div>
              <div className='mt-1 text-xs text-muted'>
                {t('请联系管理员在系统设置中配置常见问答')}
              </div>
            </div>
          )}
        </ScrollableContainer>
      </div>
    </Card>
  );
};

export default FaqPanel;
