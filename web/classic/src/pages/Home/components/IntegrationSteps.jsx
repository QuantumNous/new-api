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
import { Button, Card, Typography } from '@douyinfe/semi-ui';
import { IconArrowRight } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';
import { integrationSteps } from '../landingData';

const { Text, Title, Paragraph } = Typography;

const IntegrationSteps = ({ docsLink, user, isSelfUseMode }) => {
  const primaryPath = user
    ? '/console/token'
    : isSelfUseMode
      ? '/login'
      : '/register';

  return (
    <section id='landing-steps' className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto w-full max-w-7xl'>
        <div className='mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between'>
          <div>
            <Text className='!font-semibold !text-semi-color-primary'>
              四步集成
            </Text>
            <Title heading={2} className='!mb-0 !mt-2 !text-semi-color-text-0'>
              从账号到第一次兼容请求
            </Title>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Link to={primaryPath}>
              <Button theme='solid' type='primary'>
                开始配置
              </Button>
            </Link>
            {docsLink && (
              <Button
                icon={<IconArrowRight />}
                iconPosition='right'
                onClick={() => window.open(docsLink, '_blank')}
              >
                查看文档
              </Button>
            )}
          </div>
        </div>

        <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-4'>
          {integrationSteps.map((step, index) => (
            <Card
              key={step.title}
              bordered
              className='!rounded-3xl !border-semi-color-border !bg-semi-color-bg-1'
            >
              <div className='mb-5 flex h-10 w-10 items-center justify-center rounded-full bg-semi-color-primary text-white'>
                {index + 1}
              </div>
              <Title heading={5} className='!mb-2 !text-semi-color-text-0'>
                {step.title}
              </Title>
              <Paragraph className='!mb-0 !text-sm !leading-6 !text-semi-color-text-1'>
                {step.description}
              </Paragraph>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IntegrationSteps;
