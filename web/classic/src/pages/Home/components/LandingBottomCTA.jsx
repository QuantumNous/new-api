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
import { Button, Typography } from '@douyinfe/semi-ui';
import { IconFile, IconPlay } from '@douyinfe/semi-icons';
import { Link } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const LandingBottomCTA = ({ docsLink, user, isSelfUseMode }) => {
  const primaryPath = user
    ? '/console'
    : isSelfUseMode
      ? '/login'
      : '/register';
  const primaryText = user
    ? '进入控制台'
    : isSelfUseMode
      ? '登录使用'
      : '开始接入';

  return (
    <section className='px-4 py-12 sm:px-6 lg:px-8'>
      <div className='mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-6 rounded-[2rem] border border-semi-color-border bg-gradient-to-br from-semi-color-primary-light-default to-semi-color-bg-1 p-6 md:flex-row md:items-center lg:p-10'>
        <div className='max-w-2xl'>
          <Title heading={2} className='!mb-3 !text-semi-color-text-0'>
            准备把模型能力接入你的应用？
          </Title>
          <Paragraph className='!mb-0 !text-semi-color-text-1'>
            从创建令牌、配置 Base URL
            开始，把统一中转能力接入现有产品或内部工具。
          </Paragraph>
        </div>
        <div className='flex flex-wrap gap-3'>
          <Link to={primaryPath}>
            <Button
              size='large'
              theme='solid'
              type='primary'
              icon={<IconPlay />}
            >
              {primaryText}
            </Button>
          </Link>
          {docsLink && (
            <Button
              size='large'
              icon={<IconFile />}
              onClick={() => window.open(docsLink, '_blank')}
            >
              查看文档
            </Button>
          )}
        </div>
      </div>
    </section>
  );
};

export default LandingBottomCTA;
