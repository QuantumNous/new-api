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
import { Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';

/**
 * 步骤导航组件
 * 负责渲染上一步、下一步和完成按钮
 */
const StepNavigation = ({
  currentStep,
  steps,
  prev,
  next,
  onSubmit,
  loading,
  t,
}) => {
  return (
    <div className='mt-8 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between'>
      {/* 上一步按钮 */}
      {currentStep > 0 && (
        <Button
          variant='outline'
          className='h-11 rounded-full px-5'
          onPress={prev}
        >
          <ArrowLeft size={16} />
          {t('上一步')}
        </Button>
      )}

      {currentStep === 0 ? <div className='hidden sm:block' /> : null}

      {/* 下一步按钮 */}
      {currentStep < steps.length - 1 && (
        <Button
          variant='primary'
          className='h-11 rounded-full px-6'
          onPress={next}
        >
          {t('下一步')}
          <ArrowRight size={16} />
        </Button>
      )}

      {/* 完成按钮 */}
      {currentStep === steps.length - 1 && (
        <Button
          variant='primary'
          onPress={onSubmit}
          isPending={loading}
          className='h-11 rounded-full px-6'
        >
          <CheckCircle2 size={16} />
          {t('初始化系统')}
        </Button>
      )}
    </div>
  );
};

export default StepNavigation;
