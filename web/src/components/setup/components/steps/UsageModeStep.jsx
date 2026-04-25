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
import { Description, Label } from '@heroui/react';
import { RadioButtonGroup } from '@heroui-pro/react';
import { Building2, Presentation, UserRound } from 'lucide-react';

const usageModes = [
  {
    value: 'external',
    icon: Building2,
    title: '对外运营模式',
    description: '适用于为多个用户提供服务的场景',
  },
  {
    value: 'self',
    icon: UserRound,
    title: '自用模式',
    description: '适用于个人使用的场景，不需要设置模型价格',
  },
  {
    value: 'demo',
    icon: Presentation,
    title: '演示站点模式',
    description: '适用于展示系统功能的场景，提供基础功能演示',
  },
];

/**
 * 使用模式选择步骤组件
 * 提供系统使用模式的选择界面
 */
const UsageModeStep = ({
  formData,
  handleUsageModeChange,
  renderNavigationButtons,
  t,
}) => {
  return (
    <>
      <RadioButtonGroup
        value={formData.usageMode}
        onChange={handleUsageModeChange}
        name='usage-mode-selection'
        layout='grid'
        variant='secondary'
        className='grid-cols-1 md:grid-cols-3'
        aria-label={t('使用模式选择')}
      >
        {usageModes.map(({ value, icon: Icon, title, description }) => {
          const selected = formData.usageMode === value;

          return (
            <RadioButtonGroup.Item
              key={value}
              value={value}
              className='min-h-40 rounded-3xl'
            >
              <RadioButtonGroup.Indicator />
              <RadioButtonGroup.ItemContent className='gap-4'>
                <RadioButtonGroup.ItemIcon
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                    selected
                      ? 'bg-sky-500 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  <Icon size={22} />
                </RadioButtonGroup.ItemIcon>
                <div>
                  <Label className='text-base font-semibold text-slate-950 dark:text-slate-50'>
                    {t(title)}
                  </Label>
                  <Description className='mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400'>
                    {t(description)}
                  </Description>
                </div>
              </RadioButtonGroup.ItemContent>
            </RadioButtonGroup.Item>
          );
        })}
      </RadioButtonGroup>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default UsageModeStep;
