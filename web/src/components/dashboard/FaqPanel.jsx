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
import {
  IllustrationConstruction,
  IllustrationConstructionDark,
} from '@douyinfe/semi-illustrations';
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
      {...CARD_PROPS}
      className='dashboard-faq-panel !rounded-[2rem] lg:col-span-1'
      title={
        <div className='dashboard-panel-header'>
          <div className='dashboard-panel-eyebrow'>{t('帮助')}</div>
          <div className={`dashboard-panel-title-row ${FLEX_CENTER_GAP2}`}>
            <HelpCircle size={16} />
            {t('常见问答')}
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
        {faqData.length > 0 ? (
          <Collapse
            accordion
            expandIcon={<IconPlus />}
            collapseIcon={<IconMinus />}
            className='dashboard-faq-collapse'
          >
            {faqData.map((item, index) => (
              <Collapse.Panel
                key={index}
                header={item.question}
                itemKey={index.toString()}
                className='dashboard-faq-item'
              >
                <div
                  className='dashboard-faq-answer'
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(item.answer || ''),
                  }}
                />
              </Collapse.Panel>
            ))}
          </Collapse>
        ) : (
          <div className='dashboard-panel-empty py-8'>
            <Empty
              image={<IllustrationConstruction style={ILLUSTRATION_SIZE} />}
              darkModeImage={
                <IllustrationConstructionDark style={ILLUSTRATION_SIZE} />
              }
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
