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
import { Card, Collapse, Empty } from '@douyinfe/semi-ui';
import { HelpCircle } from 'lucide-react';
import { IconPlus, IconMinus } from '@douyinfe/semi-icons';
import { marked } from 'marked';
import ScrollableContainer from '../common/ui/ScrollableContainer';

const FaqPanel = ({ faqData, CARD_PROPS, FLEX_CENTER_GAP2, t }) => {
  return (
    <Card
      {...CARD_PROPS}
      className='console-dashboard-card console-faq-card shadow-sm !rounded-2xl lg:col-span-3'
      title={
        <div className={`console-panel-title ${FLEX_CENTER_GAP2}`}>
          <HelpCircle size={16} />
          {t('常见问答')}
        </div>
      }
      bodyStyle={{ padding: 0 }}
    >
      <ScrollableContainer maxHeight='24rem'>
        {faqData.length > 0 ? (
          <Collapse
            accordion
            expandIcon={<IconPlus />}
            collapseIcon={<IconMinus />}
            className='console-faq-list'
          >
            {faqData.map((item, index) => (
              <Collapse.Panel
                key={index}
                header={
                  <span className='console-faq-question'>{item.question}</span>
                }
                itemKey={index.toString()}
              >
                <div
                  className='console-faq-answer'
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(item.answer || ''),
                  }}
                />
              </Collapse.Panel>
            ))}
          </Collapse>
        ) : (
          <div className='console-empty-state py-8'>
            <Empty
              image={null}
              imageStyle={{ display: 'none' }}
              title={t('暂无常见问答')}
              description={t('请联系管理员在系统设置中配置常见问答')}
            />
          </div>
        )}
      </ScrollableContainer>
    </Card>
  );
};

export default FaqPanel;
