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
import { Collapse, Typography } from '@douyinfe/semi-ui';
import { faqItems } from '../landingData';

const { Title, Text, Paragraph } = Typography;

const LandingFAQ = () => {
  return (
    <section id='landing-faq' className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto grid w-full max-w-7xl gap-7 lg:grid-cols-[0.7fr_1fr]'>
        <div>
          <Text className='!font-semibold !text-semi-color-primary'>FAQ</Text>
          <Title heading={2} className='!mb-3 !mt-2 !text-semi-color-text-0'>
            接入前常见问题
          </Title>
          <Paragraph className='!text-semi-color-text-1'>
            FAQ 仅用于解释常见接入方式，具体策略、模型和价格以当前站点配置为准。
          </Paragraph>
        </div>

        <Collapse accordion>
          {faqItems.map((item) => (
            <Collapse.Panel
              key={item.question}
              header={item.question}
              itemKey={item.question}
            >
              <Paragraph className='!mb-0 !leading-7 !text-semi-color-text-1'>
                {item.answer}
              </Paragraph>
            </Collapse.Panel>
          ))}
        </Collapse>
      </div>
    </section>
  );
};

export default LandingFAQ;
