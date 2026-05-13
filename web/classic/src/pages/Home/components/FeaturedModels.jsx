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
import { Button, Card, Tag, Typography } from '@douyinfe/semi-ui';
import { IconArrowRight } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { featuredModelCards } from '../landingData';

const { Text, Title, Paragraph } = Typography;

const FeaturedModels = ({ items }) => {
  const cards =
    Array.isArray(items) && items.length > 0 ? items : featuredModelCards;

  return (
    <section id='landing-models' className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-7xl'>
        <div className='mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
          <div>
            <Text className='!font-semibold !text-semi-color-primary'>
              热门能力
            </Text>
            <Title heading={2} className='!mb-0 !mt-2 !text-semi-color-text-0'>
              从常用模型能力开始接入
            </Title>
          </div>
          <Paragraph className='max-w-xl !text-semi-color-text-1'>
            这里展示的是静态能力分类。真实可用模型、权限和价格以站点后台配置为准。
          </Paragraph>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {cards.map((card) => (
            <Card
              key={card.title}
              bordered
              className='!h-full !rounded-3xl !border-semi-color-border !bg-semi-color-bg-1'
              bodyStyle={{ height: '100%' }}
            >
              <div className='flex h-full flex-col'>
                <div className='mb-5 flex items-start justify-between gap-3'>
                  <div>
                    <Text className='!text-xs !text-semi-color-text-2'>
                      {card.provider}
                    </Text>
                    <Title
                      heading={4}
                      className='!mb-0 !mt-1 !text-semi-color-text-0'
                    >
                      {card.title}
                    </Title>
                  </div>
                  <Tag color='green'>{card.status}</Tag>
                </div>

                <Paragraph className='!text-sm !leading-6 !text-semi-color-text-1'>
                  {card.description}
                </Paragraph>

                <div className='mt-auto flex flex-wrap gap-2 pt-5'>
                  {(Array.isArray(card.tags) ? card.tags : []).map((tag) => (
                    <Tag key={tag} color='blue' shape='circle'>
                      {tag}
                    </Tag>
                  ))}
                </div>

                <Link to='/console/token' className='mt-5'>
                  <Button
                    theme='borderless'
                    type='primary'
                    icon={<IconArrowRight />}
                    iconPosition='right'
                  >
                    前往令牌
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedModels;
