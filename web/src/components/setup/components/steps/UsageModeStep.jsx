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
import { RadioGroup, Radio } from '@douyinfe/semi-ui';

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
      <RadioGroup
        value={formData.usageMode}
        onChange={handleUsageModeChange}
        type='card'
        direction='horizontal'
        className='mt-4'
        aria-label='使用模式选择'
        name='usage-mode-selection'
      >
        <Radio
          value='external'
          extra={t('适用于为多个用户提供服务的场景')}
          style={{ width: '30%', minWidth: 200 }}
        >
          {t('对外运营模式')}
        </Radio>
        <Radio
          value='self'
          extra={t('适用于个人使用的场景，不需要设置模型价格')}
          style={{ width: '30%', minWidth: 200 }}
        >
          {t('自用模式')}
        </Radio>
        <Radio
          value='demo'
          extra={t('适用于展示系统功能的场景，提供基础功能演示')}
          style={{ width: '30%', minWidth: 200 }}
        >
          {t('演示站点模式')}
        </Radio>
      </RadioGroup>
      {renderNavigationButtons && renderNavigationButtons()}
    </>
  );
};

export default UsageModeStep;
