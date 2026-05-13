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
import { Card, Typography } from '@douyinfe/semi-ui';
import {
  IconHistogram,
  IconKey,
  IconSetting,
  IconServer,
} from '@douyinfe/semi-icons';
import { trustCards } from '../landingData';

const { Text, Title, Paragraph } = Typography;

const icons = [IconKey, IconSetting, IconServer, IconHistogram];

const WhyChooseSection = () => {
  return (
    <section id='landing-why' className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-7xl rounded-[2rem] border border-semi-color-border bg-semi-color-bg-1 px-5 py-8 sm:px-8 lg:px-10'>
        <div className='mb-7 grid gap-4 lg:grid-cols-[0.8fr_1fr] lg:items-end'>
          <div>
            <Text className='!font-semibold !text-semi-color-primary'>
              为什么选择
            </Text>
            <Title heading={2} className='!mb-0 !mt-2 !text-semi-color-text-0'>
              更适合二次开发的统一入口
            </Title>
          </div>
          <Paragraph className='!text-semi-color-text-1'>
            这里不做未经确认的可用性或节省比例承诺，只呈现当前项目适合承载的管理与接入能力。
          </Paragraph>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {trustCards.map((card, index) => {
            const TrustIcon = icons[index % icons.length];
            return (
              <Card
                key={card.title}
                bordered
                className='!rounded-3xl !border-semi-color-border !bg-semi-color-bg-0'
              >
                <div className='mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-semi-color-primary-light-default text-semi-color-primary'>
                  <TrustIcon size='large' />
                </div>
                <Title heading={5} className='!mb-2 !text-semi-color-text-0'>
                  {card.title}
                </Title>
                <Paragraph className='!mb-0 !text-sm !leading-6 !text-semi-color-text-1'>
                  {card.description}
                </Paragraph>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyChooseSection;
