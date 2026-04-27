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
import { Button, Tag } from '@douyinfe/semi-ui';
import { ArrowRight, Sparkles, BadgeDollarSign } from 'lucide-react';

const DashboardPromoBanner = ({ navigate, t }) => {
  return (
    <section className='dashboard-promo-banner mb-4'>
      <div className='dashboard-promo-glow dashboard-promo-glow-left' />
      <div className='dashboard-promo-glow dashboard-promo-glow-right' />

      <div className='dashboard-promo-main'>
        <div className='dashboard-promo-icon'>
          <Sparkles size={22} />
        </div>

        <div className='dashboard-promo-copy'>
          <div className='dashboard-promo-topline'>
            <span className='dashboard-promo-eyebrow'>{t('推荐')}</span>
            <Tag color='white' shape='circle' className='dashboard-promo-badge'>
              {t('热门模型')}
            </Tag>
          </div>

          <h3 className='dashboard-promo-title'>
            {t('更快比较模型价格，直接进入 Playground 开始测试')}
          </h3>
          <p className='dashboard-promo-subtitle'>
            {t(
              '先看价格结构，再快速验证调用效果，把选择和试用放在同一条工作流里。',
            )}
          </p>

          <div className='dashboard-promo-pills'>
            <span className='dashboard-promo-pill'>{t('模型定价')}</span>
            <span className='dashboard-promo-pill'>{t('即时测试')}</span>
            <span className='dashboard-promo-pill'>{t('成本对比')}</span>
          </div>
        </div>
      </div>

      <div className='dashboard-promo-actions'>
        <Button
          theme='solid'
          type='primary'
          icon={<BadgeDollarSign size={16} />}
          className='dashboard-promo-button dashboard-promo-button-primary'
          onClick={() => navigate('/pricing')}
        >
          {t('查看定价')}
        </Button>
        <Button
          theme='light'
          type='tertiary'
          icon={<ArrowRight size={16} />}
          className='dashboard-promo-button dashboard-promo-button-secondary'
          onClick={() => navigate('/console/playground')}
        >
          {t('打开 Playground')}
        </Button>
      </div>
    </section>
  );
};

export default DashboardPromoBanner;
