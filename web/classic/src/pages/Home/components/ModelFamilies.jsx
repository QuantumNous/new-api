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
import { Card, Tag, Typography } from '@douyinfe/semi-ui';
import { modelFamilyCards } from '../landingData';

const { Text, Title, Paragraph } = Typography;

const ModelFamilies = () => {
  return (
    <section className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-7xl'>
        <div className='mb-7 max-w-3xl'>
          <Text className='!font-semibold !text-semi-color-primary'>
            模型家族
          </Text>
          <Title heading={2} className='!mb-3 !mt-2 !text-semi-color-text-0'>
            按能力分组组织接入入口
          </Title>
          <Paragraph className='!text-semi-color-text-1'>
            用更清晰的分类帮助开发者理解可接入方向，后续可逐步映射到真实模型数据。
          </Paragraph>
        </div>

        <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-5'>
          {modelFamilyCards.map((family) => (
            <Card
              key={family.title}
              bordered
              className='!rounded-3xl !border-semi-color-border !bg-semi-color-bg-1'
            >
              <Title heading={5} className='!mb-2 !text-semi-color-text-0'>
                {family.title}
              </Title>
              <Paragraph className='!text-sm !leading-6 !text-semi-color-text-1'>
                {family.description}
              </Paragraph>
              <div className='mt-4 flex flex-wrap gap-2'>
                {family.tags.map((tag) => (
                  <Tag key={tag} shape='circle'>
                    {tag}
                  </Tag>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ModelFamilies;
