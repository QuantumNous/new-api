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
  IconCode,
  IconComment,
  IconImage,
  IconLayers,
  IconSend,
  IconVideo,
} from '@douyinfe/semi-icons';
import { apiScenarioCards } from '../landingData';

const { Text, Title, Paragraph } = Typography;

const icons = [
  IconComment,
  IconImage,
  IconVideo,
  IconCode,
  IconLayers,
  IconSend,
];

const ApiScenarios = () => {
  return (
    <section id='landing-scenarios' className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-7xl'>
        <div className='mb-7 grid gap-4 lg:grid-cols-[0.75fr_1fr] lg:items-end'>
          <div>
            <Text className='!font-semibold !text-semi-color-primary'>
              API 场景
            </Text>
            <Title heading={2} className='!mb-0 !mt-2 !text-semi-color-text-0'>
              面向应用集成的能力入口
            </Title>
          </div>
          <Paragraph className='!text-semi-color-text-1'>
            从对话、图像到企业网关，把模型能力封装进自己的产品、脚本和工作流中。
          </Paragraph>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
          {apiScenarioCards.map((scenario, index) => {
            const ScenarioIcon = icons[index % icons.length];
            return (
              <Card
                key={scenario.title}
                bordered
                className='!overflow-hidden !rounded-3xl !border-semi-color-border !bg-semi-color-bg-1'
                bodyStyle={{ padding: 0 }}
              >
                <div className={`bg-gradient-to-br ${scenario.accent} p-5`}>
                  <div className='mb-5 flex h-11 w-11 items-center justify-center rounded-2xl bg-semi-color-bg-0 text-semi-color-primary shadow-sm'>
                    <ScenarioIcon size='large' />
                  </div>
                  <Title heading={4} className='!mb-2 !text-semi-color-text-0'>
                    {scenario.title}
                  </Title>
                  <Paragraph className='!mb-0 !text-sm !leading-6 !text-semi-color-text-1'>
                    {scenario.description}
                  </Paragraph>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default ApiScenarios;
